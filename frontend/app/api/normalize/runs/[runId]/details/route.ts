/**
 * GET /api/normalize/runs/:runId/details
 *
 * Get detailed information about a normalization run.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  const runId = params.runId;

  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    );
  }

  try {
    // Get run details
    const { data: run, error: runError } = await supabase
      .from('normalization_runs')
      .select(`
        id,
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

    if (runError || !run) {
      console.error('[normalize] /details query error:', runError);
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Get list of field keys changed in this run
    const { data: changesData, error: changesError } = await supabase
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
