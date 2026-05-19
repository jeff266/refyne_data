import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { checkOrgRateLimit, rateLimitErrorResponse } from '@/lib/hubspot/org-rate-limiter';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { transformArray } from '@/lib/utils/transform';

interface NormalizationRun {
  id: string;
  org_id: string;
  connection_id: string;
  initiated_by: string;
  status: 'running' | 'completed' | 'failed' | 'rolled_back' | 'rolling_back';
  scope: {
    type: 'all' | 'list' | 'filter';
    listId?: string;
    filters?: unknown;
  };
  harmonies_applied: string[];
  records_scanned: number;
  records_changed: number;
  records_failed: number;
  rollback_available: boolean;
  rollback_expires_at: string;
  rolled_back_at: string | null;
  rolled_back_by: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

interface RunsListResponse {
  runs: NormalizationRun[];
  total: number;
  page: number;
  perPage: number;
  summary: {
    totalCompleted: number;
    totalRolledBack: number;
    totalFailed: number;
    totalRunning: number;
  };
}

/**
 * GET /api/normalize/runs
 *
 * Returns paginated list of normalization runs with filtering.
 * Auth: org:admin or org:operator
 */
export async function GET(request: NextRequest) {
  // Auth check - require operator or above
  let ctx;
  try {
    ctx = await getOrgContext();
    if (ctx.orgRole === 'org:viewer') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Rate limit check
  const rateLimitCheck = await checkOrgRateLimit(ctx.orgId, '/api/normalize/runs');
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      rateLimitErrorResponse(rateLimitCheck.resetAt!, rateLimitCheck.remaining!),
      { status: 429 }
    );
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
    const status = searchParams.get('status');

    // Build base query
    let query = supabase
      .from('normalization_runs')
      .select('*', { count: 'exact' })
      .eq('org_id', ctx.orgId)
      .order('started_at', { ascending: false });

    // Apply status filter
    if (status && ['running', 'completed', 'failed', 'rolled_back', 'rolling_back'].includes(status)) {
      query = query.eq('status', status);
    }

    // Apply pagination
    const offset = (page - 1) * perPage;
    query = query.range(offset, offset + perPage - 1);

    const { data: runs, count, error } = await query;

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/normalize/runs' });
      console.error('Failed to get normalization runs:', error);
      return NextResponse.json(
        { error: 'Failed to get runs' },
        { status: 500 }
      );
    }

    // Get summary counts
    const { data: allRuns } = await supabase
      .from('normalization_runs')
      .select('status')
      .eq('org_id', ctx.orgId);

    const summary = {
      totalCompleted: 0,
      totalRolledBack: 0,
      totalFailed: 0,
      totalRunning: 0,
    };

    if (allRuns) {
      for (const run of allRuns) {
        if (run.status === 'completed') summary.totalCompleted++;
        else if (run.status === 'rolled_back') summary.totalRolledBack++;
        else if (run.status === 'failed') summary.totalFailed++;
        else if (run.status === 'running' || run.status === 'rolling_back') summary.totalRunning++;
      }
    }

    const response: RunsListResponse = {
      runs: transformArray(runs || []) as NormalizationRun[],
      total: count || 0,
      page,
      perPage,
      summary,
    };

    return NextResponse.json(response);
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/normalize/runs' });
    console.error('Failed to get normalization runs:', error);
    return NextResponse.json(
      { error: 'Failed to get runs' },
      { status: 500 }
    );
  }
}
