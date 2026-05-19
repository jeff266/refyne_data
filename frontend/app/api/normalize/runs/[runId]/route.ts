import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { checkOrgRateLimit, rateLimitErrorResponse } from '@/lib/hubspot/org-rate-limiter';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { transformKeys, transformArray } from '@/lib/utils/transform';

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

interface NormalizationChange {
  id: string;
  run_id: string;
  org_id: string;
  hubspot_company_id: string;
  field_name: string;
  value_before: string | null;
  value_after: string | null;
  harmony_id: string | null;
  harmony_name: string | null;
  status: 'applied' | 'rolled_back' | 'skipped';
  applied_at: string;
  rolled_back_at: string | null;
}

interface FieldSummary {
  field_name: string;
  changes_count: number;
  rolled_back_count: number;
}

interface RunDetailsResponse {
  run: NormalizationRun;
  changes: NormalizationChange[];
  total_changes: number;
  page: number;
  per_page: number;
  field_summary: FieldSummary[];
}

/**
 * GET /api/normalize/runs/:runId
 *
 * Returns full run details with paginated changes.
 * Auth: org:admin or org:operator
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
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
  const rateLimitCheck = await checkOrgRateLimit(ctx.orgId, '/api/normalize/runs/:runId');
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

    const { runId } = params;
    const { searchParams } = new URL(request.url);

    // Parse query params
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(500, Math.max(1, parseInt(searchParams.get('per_page') || '100', 10)));
    const fieldNameFilter = searchParams.get('field_name');

    // Get run details
    const { data: run, error: runError } = await supabase
      .from('normalization_runs')
      .select('*')
      .eq('id', runId)
      .eq('org_id', ctx.orgId)
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Build changes query
    let changesQuery = supabase
      .from('normalization_changes')
      .select('*', { count: 'exact' })
      .eq('run_id', runId)
      .eq('org_id', ctx.orgId)
      .order('applied_at', { ascending: false });

    // Apply field name filter
    if (fieldNameFilter) {
      changesQuery = changesQuery.eq('field_name', fieldNameFilter);
    }

    // Apply pagination
    const offset = (page - 1) * perPage;
    changesQuery = changesQuery.range(offset, offset + perPage - 1);

    const { data: changes, count, error: changesError } = await changesQuery;

    if (changesError) {
      captureWithOrgContext(changesError, ctx.orgId, { route: '/api/normalize/runs/:runId' });
      console.error('Failed to get normalization changes:', changesError);
      return NextResponse.json(
        { error: 'Failed to get changes' },
        { status: 500 }
      );
    }

    // Get field summary
    const { data: allChanges } = await supabase
      .from('normalization_changes')
      .select('field_name, status')
      .eq('run_id', runId)
      .eq('org_id', ctx.orgId);

    const fieldSummaryMap = new Map<string, { changes_count: number; rolled_back_count: number }>();

    if (allChanges) {
      for (const change of allChanges) {
        if (!fieldSummaryMap.has(change.field_name)) {
          fieldSummaryMap.set(change.field_name, { changes_count: 0, rolled_back_count: 0 });
        }
        const summary = fieldSummaryMap.get(change.field_name)!;
        summary.changes_count++;
        if (change.status === 'rolled_back') {
          summary.rolled_back_count++;
        }
      }
    }

    const fieldSummary: FieldSummary[] = Array.from(fieldSummaryMap.entries())
      .map(([field_name, counts]) => ({
        field_name,
        ...counts,
      }))
      .sort((a, b) => b.changes_count - a.changes_count);

    const response: RunDetailsResponse = {
      run: transformKeys(run) as NormalizationRun,
      changes: transformArray(changes || []) as NormalizationChange[],
      totalChanges: count || 0,
      page,
      perPage,
      fieldSummary,
    };

    return NextResponse.json(response);
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/normalize/runs/:runId' });
    console.error('Failed to get run details:', error);
    return NextResponse.json(
      { error: 'Failed to get run details' },
      { status: 500 }
    );
  }
}
