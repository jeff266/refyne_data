import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import type { DigestRun } from '@/lib/always-on/types';

/**
 * GET /api/always-on/runs/:id
 *
 * Returns a specific digest run by ID.
 * Auth: any role
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const runId = params.id;
    const orgId = request.headers.get('x-org-id') || 'default';

    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { data: run, error } = await supabase
      .from('digest_runs')
      .select('*')
      .eq('id', runId)
      .eq('org_id', orgId)
      .single();

    if (error) {
      console.error('Failed to fetch digest run:', error);
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      run: mapDigestRunFromDb(run),
    });
  } catch (error) {
    console.error('Failed to get digest run:', error);
    return NextResponse.json(
      { error: 'Failed to get run' },
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
