import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import type { AlwaysOnRunsResponse, DigestRun } from '@/lib/always-on/types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * GET /api/always-on/runs
 *
 * Returns paginated list of digest runs.
 * Auth: any role
 */
export async function GET(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  try {
    const orgId = ctx.orgId;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('perPage') || '20');

    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({
        runs: [],
        total: 0,
        page,
        perPage,
      } as AlwaysOnRunsResponse);
    }

    // Get total count
    const { count } = await supabase
      .from('digest_runs')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    // Get paginated runs
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data: runs, error } = await supabase
      .from('digest_runs')
      .select('*')
      .eq('org_id', orgId)
      .order('run_at', { ascending: false })
      .range(from, to);

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/always-on/runs' });
      console.error('Failed to fetch digest runs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch runs' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      runs: (runs || []).map(mapDigestRunFromDb),
      total: count || 0,
      page,
      perPage,
    } as AlwaysOnRunsResponse);
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/always-on/runs' });
    console.error('Failed to get digest runs:', error);
    return NextResponse.json(
      { error: 'Failed to get runs' },
      { status: 500 }
    );
  }
}

/**
 * Map database digest run to API format
 */
function mapDigestRunFromDb(data: any): DigestRun {
  return {
    id: data.id,
    orgId: data.org_id,
    connectionId: data.connection_id,
    portalName: data.portal_name,
    runAt: data.run_at,
    triggeredBy: data.triggered_by,
    status: data.status,
    scoreBefore: data.score_before ? parseFloat(data.score_before) : null,
    scoreAfter: data.score_after ? parseFloat(data.score_after) : null,
    scoreDelta: data.score_delta ? parseFloat(data.score_delta) : null,
    newPairsDetected: data.new_pairs_detected,
    newInsights: data.new_insights,
    recordsScanned: data.records_scanned,
    digestSent: data.digest_sent,
    slackSent: data.slack_sent,
    skippedReason: data.skipped_reason,
    errorMessage: data.error_message,
    digestPayload: data.digest_payload,
    createdAt: data.created_at,
  };
}
