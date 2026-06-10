/**
 * GET /api/normalize/runs/:runId/details
 *
 * Get detailed information about a normalization run.
 *
 * SECURITY: Requires authentication and run ownership verification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  // SECURITY: Require authentication
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runId = params.runId;

  try {
    // Get run details with org verification
    const { data: run, error: runError } = await supabaseAdmin
      .from('normalization_runs')
      .select(`
        id,
        org_id,
        started_at,
        completed_at,
        initiated_by,
        records_processed,
        records_changed,
        records_failed,
        harmonies_applied,
        status,
        error_message
      `)
      .eq('id', runId)
      .single();

    if (runError || !run || run.org_id !== ctx.orgId) {
      // Return 404 (not 403) to avoid confirming run existence
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Get list of field keys changed in this run
    const { data: changesData, error: changesError } = await supabaseAdmin
      .from('normalization_run_progress')
      .select('field_key')
      .eq('run_id', runId);

    if (changesError) {
      console.error('[normalize] Failed to fetch field keys:', changesError);
    }

    // Deduplicate field keys
    const uniqueFields = Array.from(
      new Set((changesData || []).map((c: any) => c.field_key))
    );

    // Get harmonies from run metadata (already stored in harmonies_applied column)
    const harmonies = (run.harmonies_applied || []).map((id: string) => ({
      id,
      name: id, // We don't store names separately, use ID as name
    }));

    return NextResponse.json({
      ...run,
      harmonies,
      fieldsChanged: uniqueFields,
    });

  } catch (error) {
    console.error('Failed to fetch run details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
