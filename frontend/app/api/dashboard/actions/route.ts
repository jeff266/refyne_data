import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase } from '@/lib/db/supabase';
import { getBreakdownByHarmony } from '@/lib/compliance';

interface DashboardAction {
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  href: string;
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
 * 1. Priority (high > medium > low)
 * 2. Count (descending, as tiebreaker)
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
          type: 'harmony_unmatched',
          priority: 'medium',
          title: `${harmony.harmonyName || harmony.harmonyId} has ${harmony.recordsAffected} unmatched values`,
          description: `${harmony.recordsAffected} records with unknown ${harmony.harmonyId} are dragging your compliance score down`,
          href: harmony.actionRoute || `/harmonies?harmony=${harmony.harmonyId}`,
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
      actions.push({
        type: 'grade_a_duplicates',
        priority: 'high',
        title: `${gradeACount} high-confidence duplicates ready to review`,
        description: 'Grade A clusters — safe to merge with one click',
        href: '/dedup?grade=A',
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
        type: 'quarantine_pending',
        priority: 'high',
        title: `${quarantineCount} records pending quarantine review`,
        description: 'Flagged for manual approval before pushing to HubSpot',
        href: '/quarantine',
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
            type: 'enrichment_available',
            priority: 'low',
            title: `${recordsProcessed} normalized records ready to push`,
            description: 'Apply enriched data to your HubSpot portal',
            href: `/normalize/runs/${latestRun.id}`,
            count: recordsProcessed,
          });
        }
      }
    }

    // Sort by priority (high > medium > low), then by count (descending)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    actions.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return (b.count || 0) - (a.count || 0);
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
