import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * GET /api/dedup/scan-runs
 *
 * Retrieve scan run history for an organization.
 * Query params:
 * - portalId?: string - Filter by portal ID
 * - limit?: number - Max runs to return (default 10)
 */
export async function GET(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Feature gate: dedup
  try {
    await requireFeature(ctx.orgId, 'dedup');
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
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const portalId = searchParams.get('portalId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Build query
    let query = supabase
      .from('dedup_scan_runs')
      .select('*')
      .eq('org_id', ctx.orgId)
      .order('started_at', { ascending: false })
      .limit(Math.min(limit, 50)); // Cap at 50

    if (portalId) {
      query = query.eq('portal_id', portalId);
    }

    const { data: runs, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch scan runs: ${error.message}`);
    }

    // Format runs for response
    const formattedRuns = (runs || []).map((run) => {
      const durationMs = run.completed_at
        ? new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
        : null;

      return {
        id: run.id,
        scanType: run.scan_type,
        status: run.status,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        recordsScanned: run.records_scanned,
        newPairsFound: run.new_pairs_found,
        newClustersFound: run.new_clusters_found,
        durationMs,
        errorMessage: run.error_message,
      };
    });

    return NextResponse.json({ runs: formattedRuns });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/dedup/scan-runs' });
    console.error('Failed to fetch scan runs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scan runs' },
      { status: 500 }
    );
  }
}
