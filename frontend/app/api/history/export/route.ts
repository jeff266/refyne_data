import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/history/export
 *
 * Exports all enrichment runs matching filters as CSV.
 * Filters: provider, field, status, dateRange
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');
    const field = searchParams.get('field');
    const status = searchParams.get('status');
    const dateRange = searchParams.get('dateRange') || 'last30days';

    // Build date filter
    const now = new Date();
    let startDate: Date | null = null;
    if (dateRange === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (dateRange === 'last7days') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateRange === 'last30days') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Fetch all runs
    let query = supabase
      .from('arrangement_runs')
      .select(`
        id,
        arrangement_id,
        status,
        records_processed,
        records_total,
        fields_filled,
        started_at,
        completed_at,
        arrangements!inner (
          id,
          name,
          provider,
          field_configs
        )
      `)
      .eq('org_id', ctx.orgId)
      .order('started_at', { ascending: false });

    if (startDate) {
      query = query.gte('started_at', startDate.toISOString());
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: runs, error } = await query;

    if (error) {
      console.error('Failed to fetch runs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch runs' },
        { status: 500 }
      );
    }

    // Apply post-query filters (provider, field)
    let filteredRuns = runs || [];

    if (provider && provider !== 'all') {
      filteredRuns = filteredRuns.filter((run: any) => {
        const arrangement = Array.isArray(run.arrangements)
          ? run.arrangements[0]
          : run.arrangements;
        return arrangement?.provider === provider;
      });
    }

    if (field && field !== 'all') {
      filteredRuns = filteredRuns.filter((run: any) => {
        const arrangement = Array.isArray(run.arrangements)
          ? run.arrangements[0]
          : run.arrangements;
        const fieldConfigs = arrangement?.field_configs || [];
        return fieldConfigs.some((fc: any) => fc.field_key === field);
      });
    }

    // Build CSV
    const csvRows: string[] = [];
    csvRows.push('Run ID,Arrangement,Provider,Started At,Completed At,Duration (s),Status,Records Processed,Fields Filled');

    filteredRuns.forEach((run: any) => {
      const arrangement = Array.isArray(run.arrangements)
        ? run.arrangements[0]
        : run.arrangements;

      const startedAt = run.started_at ? new Date(run.started_at).toISOString() : '';
      const completedAt = run.completed_at ? new Date(run.completed_at).toISOString() : '';

      let durationSeconds = 0;
      if (run.started_at && run.completed_at) {
        const start = new Date(run.started_at).getTime();
        const end = new Date(run.completed_at).getTime();
        durationSeconds = Math.round((end - start) / 1000);
      }

      const fieldsFilled = run.fields_filled || {};
      const totalFilled = Object.values(fieldsFilled).reduce(
        (sum: number, count: any) => sum + (count || 0),
        0
      );

      csvRows.push([
        run.id,
        arrangement?.name || 'Unknown',
        arrangement?.provider || 'Unknown',
        startedAt,
        completedAt,
        durationSeconds,
        run.status,
        run.records_processed || 0,
        totalFilled,
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','));
    });

    const csvContent = csvRows.join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="enrichment-history-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error('Failed to export history:', error);
    return NextResponse.json(
      { error: 'Failed to export history' },
      { status: 500 }
    );
  }
}
