import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { transformArray } from '@/lib/utils/transform';

/**
 * GET /api/arrangements/runs
 *
 * Returns unified list of all runs (enrichment + job segmentation).
 * Auth: org:operator or above
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

    // Parse query params
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '20', 10)));
    const arrangementId = searchParams.get('arrangement_id');
    const runType = searchParams.get('type'); // 'enrichment' | 'segmentation'
    const status = searchParams.get('status');

    // If filtering by arrangement_id, only return enrichment runs
    if (arrangementId) {
      let query = supabase
        .from('arrangement_runs')
        .select('*, arrangements(name)', { count: 'exact' })
        .eq('org_id', ctx.orgId)
        .eq('arrangement_id', arrangementId)
        .order('started_at', { ascending: false });

      if (status && ['queued', 'running', 'paused', 'completed', 'failed', 'cancelled'].includes(status)) {
        query = query.eq('status', status);
      }

      const offset = (page - 1) * perPage;
      query = query.range(offset, offset + perPage - 1);

      const { data: runs, count, error } = await query;

      if (error) {
        captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/runs' });
        console.error('Failed to get runs:', error);
        return NextResponse.json(
          { error: 'Failed to get runs' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        runs: transformArray(runs || []),
        total: count || 0,
        page,
        perPage,
      });
    }

    // Fetch both types of runs (without pagination for now, will sort and paginate later)
    const fetchEnrichmentRuns = async () => {
      if (runType === 'segmentation') return [];

      let query = supabase
        .from('arrangement_runs')
        .select('*, arrangements(name)')
        .eq('org_id', ctx.orgId)
        .order('started_at', { ascending: false })
        .limit(100); // Fetch more than needed for sorting

      if (status && ['queued', 'running', 'paused', 'completed', 'failed', 'cancelled'].includes(status)) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((run: any) => ({
        ...run,
        type: 'enrichment' as const,
        name: run.arrangements?.name || 'Unnamed arrangement',
      }));
    };

    const fetchSegmentationRuns = async () => {
      if (runType === 'enrichment') return [];

      let query = supabase
        .from('job_segmentation_runs')
        .select('*')
        .eq('org_id', ctx.orgId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (status && ['pending', 'running', 'completed', 'failed'].includes(status)) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((run: any) => ({
        ...run,
        type: 'segmentation' as const,
        name: `Job Segmentation ${new Date(run.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        // Map segmentation fields to match enrichment run structure
        total_records: run.processed_count || 0,
        records_processed: run.processed_count || 0,
      }));
    };

    // Fetch both in parallel
    const [enrichmentRuns, segmentationRuns] = await Promise.all([
      fetchEnrichmentRuns(),
      fetchSegmentationRuns(),
    ]);

    // Merge and sort by started_at/created_at
    const allRuns = [...enrichmentRuns, ...segmentationRuns].sort((a, b) => {
      const dateA = new Date(a.started_at || a.created_at).getTime();
      const dateB = new Date(b.started_at || b.created_at).getTime();
      return dateB - dateA; // Descending (newest first)
    });

    // Apply pagination
    const offset = (page - 1) * perPage;
    const paginatedRuns = allRuns.slice(offset, offset + perPage);

    return NextResponse.json({
      runs: transformArray(paginatedRuns),
      total: allRuns.length,
      page,
      perPage,
    });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/runs' });
    console.error('Failed to get runs:', error);
    return NextResponse.json(
      { error: 'Failed to get runs' },
      { status: 500 }
    );
  }
}
