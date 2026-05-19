/**
 * GET /api/normalize/runs/:runId/details
 *
 * Get detailed information about a normalization run.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { transformKeys } from '@/lib/utils/transform';

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
        created_at,
        created_by_email,
        records_changed,
        fields_changed,
        status
      `)
      .eq('id', runId)
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Get harmonies applied in this run
    const { data: harmonies, error: harmoniesError } = await supabase
      .from('normalization_changes')
      .select('harmony_id, harmony_name')
      .eq('run_id', runId)
      .not('harmony_id', 'is', null);

    if (harmoniesError) {
      console.error('Failed to fetch harmonies:', harmoniesError);
    }

    // Deduplicate harmonies
    const uniqueHarmonies = Array.from(
      new Map(
        (harmonies || []).map((h: any) => [h.harmony_id, { id: h.harmony_id, name: h.harmony_name }])
      ).values()
    );

    const transformedRun = transformKeys<Record<string, any>>(run);

    return NextResponse.json({
      ...transformedRun,
      harmonies: uniqueHarmonies,
    });

  } catch (error) {
    console.error('Failed to fetch run details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
