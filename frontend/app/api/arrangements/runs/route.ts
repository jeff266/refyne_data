import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/arrangements/runs
 *
 * Returns paginated list of arrangement runs.
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
    const status = searchParams.get('status');

    // Build query
    let query = supabase
      .from('arrangement_runs')
      .select('*, arrangements(name)', { count: 'exact' })
      .eq('org_id', ctx.orgId)
      .order('started_at', { ascending: false });

    if (arrangementId) {
      query = query.eq('arrangement_id', arrangementId);
    }

    if (status && ['queued', 'running', 'paused', 'completed', 'failed', 'cancelled'].includes(status)) {
      query = query.eq('status', status);
    }

    // Apply pagination
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
      runs,
      total: count || 0,
      page,
      per_page: perPage,
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
