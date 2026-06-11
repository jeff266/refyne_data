import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { getRedisConnection } from '@/lib/queue/redis';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

interface LastNightStats {
  recordsNormalized: number;
  dupesFound: number;
  fieldsFilled: number;
  importsProcessed: number;
}

interface PendingAttentionItem {
  type: string;
  title: string;
  description: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
  href: string;
}

interface DashboardSummary {
  lastNight: LastNightStats;
  pendingAttention: PendingAttentionItem[];
}

/**
 * GET /api/dashboard/summary
 *
 * Returns dashboard summary with:
 * - lastNight: Stats from last 24 hours (records normalized, dupes found, fields filled, imports processed)
 * - pendingAttention: Action items (Grade A dupes, normalize issues, stale arrangements, unmatched imports)
 *
 * Redis cache: 15 min TTL
 * Cache key: dashboard:summary:${orgId}
 * Support ?refresh=true to bust cache
 */
export async function GET(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { orgId } = ctx;
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get('refresh') === 'true';

  try {
    // Check Redis cache first
    const redis = getRedisConnection();
    const cacheKey = `dashboard:summary:${orgId}`;

    if (!refresh && redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log('[dashboard/summary] Cache hit');
          return NextResponse.json(JSON.parse(cached));
        }
      } catch (err) {
        console.warn('[dashboard/summary] Redis get failed:', err);
      }
    }

    console.log('[dashboard/summary] Calculating fresh summary for org:', orgId);

    // Calculate 24 hour window
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Query 1: Records normalized (from normalization_runs)
    const { data: normRuns } = await supabaseAdmin
      .from('normalization_runs')
      .select('records_processed')
      .eq('org_id', orgId)
      .gte('completed_at', yesterday.toISOString())
      .not('completed_at', 'is', null);

    const recordsNormalized = (normRuns || []).reduce(
      (sum, run) => sum + (run.records_processed || 0),
      0
    );

    // Query 2: Dupes found (from dedup_clusters created in last 24h)
    const { count: dupesFound } = await supabaseAdmin
      .from('dedup_clusters')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', yesterday.toISOString());

    // Query 3: Fields filled (from arrangement_run_progress)
    const { data: arrangements } = await supabaseAdmin
      .from('arrangement_run_progress')
      .select('fields_updated')
      .eq('org_id', orgId)
      .gte('completed_at', yesterday.toISOString())
      .not('completed_at', 'is', null);

    const fieldsFilled = (arrangements || []).reduce(
      (sum, arr) => sum + (arr.fields_updated || 0),
      0
    );

    // Query 4: Imports processed (from event_imports)
    const { count: importsProcessed } = await supabaseAdmin
      .from('event_imports')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', yesterday.toISOString());

    const lastNight: LastNightStats = {
      recordsNormalized: recordsNormalized || 0,
      dupesFound: dupesFound || 0,
      fieldsFilled: fieldsFilled || 0,
      importsProcessed: importsProcessed || 0,
    };

    // Pending Attention Items

    const pendingAttention: PendingAttentionItem[] = [];

    // 1. Grade A duplicates (high confidence)
    const { data: gradeAPairs } = await supabaseAdmin
      .from('dedup_pairs')
      .select('id', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('grade', 'A')
      .eq('status', 'pending');

    const gradeACount = gradeAPairs?.length || 0;
    if (gradeACount > 0) {
      pendingAttention.push({
        type: 'grade_a_dupes',
        title: `${gradeACount} Grade A duplicates ready`,
        description: 'High-confidence matches — safe to merge',
        count: gradeACount,
        severity: 'high',
        href: '/dedup?grade=A',
      });
    }

    // 2. Normalize issues (failed normalization runs in last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const { count: failedNormRuns } = await supabaseAdmin
      .from('normalization_runs')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'failed')
      .gte('created_at', sevenDaysAgo.toISOString());

    if (failedNormRuns && failedNormRuns > 0) {
      pendingAttention.push({
        type: 'normalize_issues',
        title: `${failedNormRuns} failed normalization runs`,
        description: 'Review errors and retry',
        count: failedNormRuns,
        severity: 'medium',
        href: '/normalize',
      });
    }

    // 3. Stale arrangements (arrangements not run in 30+ days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const { data: arrangements30d } = await supabaseAdmin
      .from('arrangements')
      .select('id, name, last_run_at')
      .eq('org_id', orgId)
      .eq('enabled', true)
      .or(`last_run_at.is.null,last_run_at.lt.${thirtyDaysAgo.toISOString()}`);

    const staleCount = arrangements30d?.length || 0;
    if (staleCount > 0) {
      pendingAttention.push({
        type: 'stale_arrangements',
        title: `${staleCount} arrangements not run recently`,
        description: 'Data may be outdated',
        count: staleCount,
        severity: 'low',
        href: '/harmonies',
      });
    }

    // 4. Unmatched imports (event_imports with status=pending)
    const { count: unmatchedImports } = await supabaseAdmin
      .from('event_imports')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'pending');

    if (unmatchedImports && unmatchedImports > 0) {
      pendingAttention.push({
        type: 'unmatched_imports',
        title: `${unmatchedImports} unmatched event imports`,
        description: 'Review and match to companies',
        count: unmatchedImports,
        severity: 'medium',
        href: '/import',
      });
    }

    // Sort by severity (high > medium > low), then by count desc
    const severityOrder = { high: 0, medium: 1, low: 2 };
    pendingAttention.sort((a, b) => {
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return b.count - a.count;
    });

    // Take top 5
    const topAttentionItems = pendingAttention.slice(0, 5);

    const summary: DashboardSummary = {
      lastNight,
      pendingAttention: topAttentionItems,
    };

    // Cache for 15 minutes
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(summary), 'EX', 15 * 60);
      } catch (err) {
        console.warn('[dashboard/summary] Redis set failed:', err);
      }
    }

    return NextResponse.json(summary);
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/dashboard/summary' });
    console.error('Failed to get dashboard summary:', error);
    return NextResponse.json(
      { error: 'Failed to get dashboard summary' },
      { status: 500 }
    );
  }
}
