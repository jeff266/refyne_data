import { NextRequest, NextResponse } from 'next/server';
import { getScore, getPreviousScore } from '@/lib/compliance';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase } from '@/lib/db/supabase';


/**
 * GET /api/compliance/score
 *
 * Returns overall compliance score, counts, and trend delta.
 */
export async function GET(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }
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
    const { searchParams } = new URL(request.url);
    const orgId = ctx.orgId;
    const portalId = searchParams.get('portalId'); // null = aggregated across all portals

    const score = await getScore(orgId);
    const previousScore = await getPreviousScore(orgId);

    const trendDelta = previousScore !== null
      ? Math.round((score.score - previousScore) * 100) / 100
      : null;

    // Calculate delta direction
    const delta = trendDelta !== null
      ? {
          score: trendDelta,
          direction: (trendDelta > 0 ? 'up' : trendDelta < 0 ? 'down' : 'stable') as 'up' | 'down' | 'stable',
        }
      : null;

    // Calculate breakpoint
    const scoreValue = score.score;
    let breakpoint: 'critical' | 'needs_work' | 'good' | 'great' | 'excellent';
    if (scoreValue < 50) {
      breakpoint = 'critical';
    } else if (scoreValue < 70) {
      breakpoint = 'needs_work';
    } else if (scoreValue < 85) {
      breakpoint = 'good';
    } else if (scoreValue < 95) {
      breakpoint = 'great';
    } else {
      breakpoint = 'excellent';
    }

    // Get benchmark data from workspace_entitlements
    let benchmark: { average: number; percentile: number } | null = null;
    if (supabase) {
      const { data: workspace } = await supabase
        .from('workspace_entitlements')
        .select('benchmark_score')
        .eq('org_id', orgId)
        .single();

      if (workspace?.benchmark_score) {
        // Calculate percentile (simplified - in production would compare against all orgs)
        // For now, approximate: if score > benchmark, percentile = 50 + ((score - benchmark) / 2)
        const benchmarkAvg = workspace.benchmark_score;
        const percentile = scoreValue > benchmarkAvg
          ? Math.min(99, 50 + ((scoreValue - benchmarkAvg) / 2))
          : Math.max(1, 50 - ((benchmarkAvg - scoreValue) / 2));

        benchmark = {
          average: benchmarkAvg,
          percentile: Math.round(percentile),
        };
      }
    }

    return NextResponse.json({
      score: score.score,
      compliant: score.compliant,
      stale: score.stale,
      unprocessed: score.unprocessed,
      total: score.total,
      lastComputedAt: score.lastComputedAt,
      trendDelta, // Keep for backwards compatibility
      delta,
      benchmark,
      breakpoint,
      portalId: portalId || null,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/compliance/score' });
    console.error('Failed to get compliance score:', error);
    return NextResponse.json(
      { error: 'Failed to get compliance score' },
      { status: 500 }
    );
  }
}
