import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/history
 *
 * Returns enrichment runs with filtering and pagination.
 * Query params:
 * - provider: filter by provider name
 * - field: filter by field key
 * - status: filter by run status (completed, failed, running)
 * - dateRange: filter by date range (today, last7days, last30days, alltime)
 * - page: page number (default 1)
 * - limit: items per page (default 20)
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

    const searchParams = request.nextUrl.searchParams;
    const provider = searchParams.get('provider');
    const field = searchParams.get('field');
    const status = searchParams.get('status');
    const dateRange = searchParams.get('dateRange') || 'last30days';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    // Calculate date filter
    let dateFilter: Date | null = null;
    const now = new Date();
    if (dateRange === 'today') {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (dateRange === 'last7days') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateRange === 'last30days') {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Query arrangement_runs with arrangements
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
        error_message,
        arrangements!inner (
          id,
          name,
          field_configs
        )
      `, { count: 'exact' })
      .eq('org_id', ctx.orgId)
      .order('started_at', { ascending: false });

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Apply date filter
    if (dateFilter) {
      query = query.gte('started_at', dateFilter.toISOString());
    }

    // Fetch runs
    const { data: runs, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('Failed to fetch history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch history' },
        { status: 500 }
      );
    }

    // Post-process filtering for provider and field (since these are in JSONB)
    let filteredRuns = runs || [];

    if (provider || field) {
      filteredRuns = filteredRuns.filter((run: any) => {
        const fieldConfigs = run.arrangements?.field_configs || [];

        // Check provider filter
        if (provider) {
          const hasProvider = fieldConfigs.some((fc: any) =>
            fc.steps?.some((step: any) => step.provider === provider)
          );
          if (!hasProvider) return false;
        }

        // Check field filter
        if (field) {
          const hasField = fieldConfigs.some((fc: any) => fc.field_key === field);
          if (!hasField) return false;
        }

        return true;
      });
    }

    // Calculate summary stats (all runs, not just filtered)
    const { data: allRuns } = await supabase
      .from('arrangement_runs')
      .select('records_processed, fields_filled')
      .eq('org_id', ctx.orgId);

    const totalRuns = allRuns?.length || 0;
    const totalRecords = allRuns?.reduce((sum, r) => sum + (r.records_processed || 0), 0) || 0;

    let totalFilled = 0;
    allRuns?.forEach((r) => {
      if (r.fields_filled && typeof r.fields_filled === 'object') {
        totalFilled += Object.values(r.fields_filled as Record<string, number>).reduce((s, c) => s + c, 0);
      }
    });

    const avgFillsPerRun = totalRuns > 0 ? Math.round(totalFilled / totalRuns) : 0;

    // Transform runs for display
    const history = filteredRuns.map((run: any) => {
      const arrangement = run.arrangements;
      const fieldConfigs = arrangement?.field_configs || [];

      // Extract unique providers
      const providers: string[] = [];
      fieldConfigs.forEach((fc: any) => {
        fc.steps?.forEach((step: any) => {
          if (step.provider && !providers.includes(step.provider)) {
            providers.push(step.provider);
          }
        });
      });

      // Extract fields
      const fields = fieldConfigs.map((fc: any) => fc.field_key).filter(Boolean);

      // Calculate total fields filled
      const fieldsFilled = run.fields_filled || {};
      const totalFilledForRun = Object.values(fieldsFilled).reduce(
        (sum: number, count: any) => sum + (count || 0),
        0
      );

      // Calculate duration
      let durationSeconds = 0;
      if (run.started_at && run.completed_at) {
        const start = new Date(run.started_at).getTime();
        const end = new Date(run.completed_at).getTime();
        durationSeconds = Math.round((end - start) / 1000);
      }

      return {
        run_id: run.id,
        arrangement_id: run.arrangement_id,
        arrangement_name: arrangement?.name || 'Unknown',
        started_at: run.started_at,
        completed_at: run.completed_at,
        duration_seconds: durationSeconds,
        status: run.status,
        providers,
        fields,
        records_processed: run.records_processed || 0,
        fields_filled: totalFilledForRun,
      };
    });

    return NextResponse.json({
      runs: history,
      total: count || 0,
      summary: {
        totalRuns,
        totalRecords,
        totalFilled,
        avgFillsPerRun,
      },
    });
  } catch (error) {
    console.error('Failed to fetch history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
