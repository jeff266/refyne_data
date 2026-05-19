import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase } from '@/lib/db/supabase';
import { getBreakdownByHarmony } from '@/lib/compliance';

interface DashboardAction {
  type: 'fix_harmony' | 'review_dedup' | 'quarantine' | 'enrich';
  label: string;
  description: string;
  estimatedMinutes: number;
  estimatedScoreImpact: number;
  route: string;
  primaryCta: string;
  count?: number;
}

/**
 * GET /api/dashboard/actions
 *
 * Returns prioritized action list aggregated from:
 * - compliance breakdown (harmonies below threshold)
 * - dedup_pairs (pending Grade A pairs)
 * - quarantine_records (pending review count)
 * - normalization_runs (recently available actions)
 *
 * Returns top 3 actions sorted by:
 * 1. Estimated score impact (highest first)
 * 2. Time to complete (quickest first as tiebreaker)
 */
export async function GET(request: NextRequest) {
  // Add auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Feature gate: compliance
  try {
    await requireFeature(ctx.orgId, 'compliance');
  } catch (error) {
    const gateError = parseFeatureGateError(error);
    if (gateError) {
      return NextResponse.json(
        { error: 'feature_gated', feature: gateError.feature, currentPlan: gateError.currentPlan },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    const orgId = ctx.orgId;
    const actions: DashboardAction[] = [];

    if (!supabase) {
      return NextResponse.json({ actions: [] });
    }

    // 1. Get harmonies that need fixing (score < 60%)
    const harmonies = await getBreakdownByHarmony(orgId);
    for (const harmony of harmonies) {
      if (harmony.rate < 60 && harmony.actionable && harmony.recordsAffected > 0) {
        actions.push({
          type: 'fix_harmony',
          label: `Fix ${harmony.harmonyName || harmony.harmonyId} (${Math.round(harmony.rate)}%)`,
          description: `${harmony.recordsAffected} records would be fixed · ${harmony.description || 'Apply harmony normalization'}`,
          estimatedMinutes: Math.min(5, Math.ceil(harmony.recordsAffected / 50)), // 1 min per 50 records, max 5
          estimatedScoreImpact: harmony.estimatedScoreImpact,
          route: harmony.actionRoute || `/harmonies?harmony=${harmony.harmonyId}`,
          primaryCta: 'Edit harmony',
          count: harmony.recordsAffected,
        });
      }
    }

    // 2. Get pending Grade A duplicates
    const { data: dedupPairs } = await supabase
      .from('dedup_pairs')
      .select('grade', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .eq('grade', 'A');

    const gradeACount = dedupPairs?.length || 0;
    if (gradeACount > 0) {
      // Estimate: each Grade A pair is ~1 point of score impact (if 100 total records = 1%)
      const estimatedImpact = Math.round((gradeACount / 100) * 100) / 100;
      actions.push({
        type: 'review_dedup',
        label: `Review ${gradeACount} Grade A duplicates`,
        description: `High confidence matches · ~${Math.ceil(gradeACount * 0.5)} min`,
        estimatedMinutes: Math.ceil(gradeACount * 0.5), // 30 sec per pair
        estimatedScoreImpact: Math.max(1, estimatedImpact),
        route: '/dedup?grade=A',
        primaryCta: 'Review duplicates',
        count: gradeACount,
      });
    }

    // 3. Get quarantine records pending review
    const { count: quarantineCount } = await supabase
      .from('quarantine_records')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'pending');

    if (quarantineCount && quarantineCount > 0) {
      actions.push({
        type: 'quarantine',
        label: `Review ${quarantineCount} quarantined records`,
        description: `Records flagged for manual review · ~${Math.ceil(quarantineCount * 1)} min`,
        estimatedMinutes: Math.ceil(quarantineCount * 1), // 1 min per record
        estimatedScoreImpact: 2, // Moderate impact
        route: '/quarantine',
        primaryCta: 'Review records',
        count: quarantineCount,
      });
    }

    // 4. Get recent normalize runs that completed successfully (enrichment opportunities)
    const { data: recentRuns } = await supabase
      .from('normalization_runs')
      .select('id, records_processed, status, completed_at')
      .eq('org_id', orgId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1);

    if (recentRuns && recentRuns.length > 0) {
      const latestRun = recentRuns[0];
      const recordsProcessed = latestRun.records_processed || 0;
      if (recordsProcessed > 0) {
        // Only show if run completed in last 24 hours
        const completedAt = new Date(latestRun.completed_at);
        const hoursSince = (Date.now() - completedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 24) {
          actions.push({
            type: 'enrich',
            label: `Push ${recordsProcessed} normalized records`,
            description: `Apply enriched data to HubSpot · ~${Math.ceil(recordsProcessed / 100)} min`,
            estimatedMinutes: Math.max(1, Math.ceil(recordsProcessed / 100)), // 1 min per 100 records
            estimatedScoreImpact: 5, // Good impact
            route: `/normalize/runs/${latestRun.id}`,
            primaryCta: 'Push to HubSpot',
            count: recordsProcessed,
          });
        }
      }
    }

    // Sort by score impact (descending), then by time (ascending)
    actions.sort((a, b) => {
      if (b.estimatedScoreImpact !== a.estimatedScoreImpact) {
        return b.estimatedScoreImpact - a.estimatedScoreImpact;
      }
      return a.estimatedMinutes - b.estimatedMinutes;
    });

    // Return top 3
    return NextResponse.json({
      actions: actions.slice(0, 3),
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/dashboard/actions' });
    console.error('Failed to get dashboard actions:', error);
    return NextResponse.json(
      { error: 'Failed to get dashboard actions' },
      { status: 500 }
    );
  }
}
