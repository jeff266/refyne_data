import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';

export async function GET(_request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { orgId } = ctx;

    // Company count from company_dedup_index
    const { count: companyCount } = await supabaseAdmin
      .from('company_dedup_index')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    // Contact count from dedup_clusters (proxy)
    const { count: contactCount } = await supabaseAdmin
      .from('dedup_clusters')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('object_type', 'contact');

    // Open dedup clusters (companies only)
    const { count: openClusters } = await supabaseAdmin
      .from('dedup_clusters')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'open')
      .eq('object_type', 'company');

    // Grade A clusters
    const { count: gradeA } = await supabaseAdmin
      .from('dedup_clusters')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'open')
      .eq('grade', 'A');

    // Grade B = open clusters - grade A
    const gradeB = (openClusters || 0) - (gradeA || 0);

    // Last dedup scan
    const { data: lastScan } = await supabaseAdmin
      .from('dedup_scan_runs')
      .select('started_at')
      .eq('org_id', orgId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    // Last normalize run
    const { data: lastNormalize } = await supabaseAdmin
      .from('normalization_runs')
      .select('started_at, id')
      .eq('org_id', orgId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    // Normalize issue counts - query from most recent run
    let normalizeData = {
      issueCount: 0,
      lastRunAt: lastNormalize?.started_at || null,
      topIssues: [] as Array<{ field: string; label: string; count: number }>
    };

    if (lastNormalize) {
      // Query normalization_run_progress for pending issues from the last run
      const { data: issuesByField } = await supabaseAdmin
        .from('normalization_run_progress')
        .select('field_key')
        .eq('run_id', lastNormalize.id)
        .eq('status', 'pending');

      if (issuesByField) {
        // Count issues by field_key
        const fieldCounts: Record<string, number> = {};
        issuesByField.forEach((row: any) => {
          fieldCounts[row.field_key] = (fieldCounts[row.field_key] || 0) + 1;
        });

        // Convert to array and sort by count
        const topFields = Object.entries(fieldCounts)
          .map(([field, count]) => ({
            field,
            label: field.replace(/_/g, ' '),
            count
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        normalizeData.issueCount = issuesByField.length;
        normalizeData.topIssues = topFields;
      }
    }

    // Recent activity from audit_log
    const { data: recentActivity } = await supabaseAdmin
      .from('audit_log')
      .select('action, object_label, metadata, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Billing from org_billing
    let { data: billing } = await supabaseAdmin
      .from('org_billing')
      .select('subscription_tier, trial_ends_at, trial_merges_used, trial_normalize_writes_used, trial_enrich_credits_used, current_period_start')
      .eq('org_id', orgId)
      .single();

    // If no billing record, return trial defaults
    if (!billing) {
      const fourteenDaysFromNow = new Date();
      fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

      billing = {
        subscription_tier: 'trial',
        trial_ends_at: fourteenDaysFromNow.toISOString(),
        trial_merges_used: 0,
        trial_normalize_writes_used: 0,
        trial_enrich_credits_used: 0,
        current_period_start: new Date().toISOString()
      };
    }

    // Calculate days remaining
    let daysRemaining: number | null = null;
    if (billing.subscription_tier === 'trial' && billing.trial_ends_at) {
      const now = new Date();
      const trialEnd = new Date(billing.trial_ends_at);
      const diffTime = trialEnd.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    // Credits used this period from org_usage
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: usageData } = await supabaseAdmin
      .from('org_usage')
      .select('credits_used')
      .eq('org_id', orgId)
      .in('provider', ['refyne_search', 'graphiq_managed'])
      .gte('created_at', billing?.current_period_start ?? thirtyDaysAgo.toISOString());

    const creditsUsed = usageData?.reduce((sum, row) => sum + (row.credits_used || 0), 0) || 0;

    // Enrich gaps - query from cache
    let enrichData = {
      creditsUsed,
      creditsIncluded: 500,
      topGaps: [] as Array<{ field: string; missing: number; coverage: number }>
    };

    // Get portal_id for cache lookup
    const { data: connection } = await supabaseAdmin
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', orgId)
      .single();

    if (connection) {
      const cacheKey = `${orgId}:${connection.portal_id}:enrich:gaps:company`;
      const { data: cached } = await supabaseAdmin
        .from('cache')
        .select('value, expires_at')
        .eq('key', cacheKey)
        .single();

      const isCached = cached && new Date(cached.expires_at) > new Date();

      if (isCached && cached.value?.field_gaps) {
        // Sort by missing count and take top 3
        const topGaps = (cached.value.field_gaps || [])
          .sort((a: any, b: any) => b.missing - a.missing)
          .slice(0, 3)
          .map((gap: any) => ({
            field: gap.field,
            missing: gap.missing,
            coverage: gap.coverage
          }));

        enrichData.topGaps = topGaps;
      }
    }

    // Trial limits (only for trial tier, not exempt)
    const trialLimits = billing.subscription_tier === 'trial' ? {
      mergesUsed: billing.trial_merges_used || 0,
      mergesLimit: 10,
      writesUsed: billing.trial_normalize_writes_used || 0,
      writesLimit: 500,
      creditsUsed: billing.trial_enrich_credits_used || 0,
      creditsLimit: 500
    } : null;

    // Calculate Data Health Score
    const totalRecords = (companyCount || 0) + (contactCount || 0);
    const totalIssues = (normalizeData.issueCount || 0) + (openClusters || 0);
    let dataHealthScore = 100;

    if (totalRecords > 0) {
      const issueRate = totalIssues / totalRecords;
      dataHealthScore = Math.max(0, Math.min(100, Math.round(100 - (issueRate * 100))));
    }

    // Get historical snapshot for week-over-week delta
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoDate = sevenDaysAgo.toISOString().split('T')[0];

    const { data: historicalSnapshot } = await supabaseAdmin
      .from('data_health_snapshots')
      .select('data_health_score')
      .eq('org_id', orgId)
      .lte('snapshot_date', sevenDaysAgoDate)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    const dataHealthDelta = historicalSnapshot
      ? dataHealthScore - historicalSnapshot.data_health_score
      : 0;

    return NextResponse.json({
      portal: {
        companyCount: companyCount === 0 ? null : companyCount,
        contactCount: contactCount === 0 ? null : contactCount
      },
      dataHealth: {
        score: dataHealthScore,
        delta: dataHealthDelta
      },
      normalize: normalizeData,
      dedup: {
        openClusters: openClusters || 0,
        gradeA: gradeA || 0,
        gradeB: gradeB || 0,
        lastScanAt: lastScan?.started_at || null
      },
      enrich: enrichData,
      recentActivity: (recentActivity || []).map(a => ({
        action: a.action,
        objectLabel: a.object_label,
        metadata: a.metadata,
        createdAt: a.created_at
      })),
      billing: {
        planType: billing.subscription_tier || 'trial',
        daysRemaining,
        trialLimits
      }
    });

  } catch (error) {
    console.error('[Dashboard] Error fetching summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
