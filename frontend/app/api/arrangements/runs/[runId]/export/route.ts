import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/arrangements/runs/:runId/export
 *
 * Exports run results as CSV.
 * Auth: org:operator or above
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Get run
    const { data: run, error: runError } = await supabase
      .from('arrangement_runs')
      .select('*, arrangements(name)')
      .eq('id', params.runId)
      .eq('org_id', ctx.orgId)
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Get all progress records
    const { data: progress, error: progressError } = await supabase
      .from('arrangement_run_progress')
      .select('*')
      .eq('run_id', params.runId)
      .order('completed_at', { ascending: true });

    if (progressError) {
      captureWithOrgContext(progressError, ctx.orgId, { route: '/api/arrangements/runs/:runId/export' });
      return NextResponse.json(
        { error: 'Failed to get progress data' },
        { status: 500 }
      );
    }

    // Generate CSV
    const csvRows: string[] = [];

    // Header
    const headers = ['Record ID', 'Status', 'Enriched Data', 'Credits Used', 'Error', 'Completed At'];
    csvRows.push(headers.join(','));

    // Data rows
    for (const record of progress || []) {
      const row = [
        record.record_id,
        record.status,
        JSON.stringify(record.enrichment_results || {}),
        String(record.credits_used || 0),
        record.error_message || '',
        record.completed_at || '',
      ];
      csvRows.push(row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','));
    }

    const csv = csvRows.join('\n');

    // Return CSV file
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="arrangement-run-${params.runId}.csv"`,
      },
    });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/runs/:runId/export' });
    console.error('Failed to export run:', error);
    return NextResponse.json(
      { error: 'Failed to export run' },
      { status: 500 }
    );
  }
}
