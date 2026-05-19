import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { checkOrgRateLimit, rateLimitErrorResponse } from '@/lib/hubspot/org-rate-limiter';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

interface FieldSummary {
  field_name: string;
  records_affected: number;
}

interface RollbackPreviewResponse {
  records_affected: number;
  field_summary: FieldSummary[];
  expires_at: string;
  rollback_available: boolean;
  status: string;
}

/**
 * POST /api/normalize/runs/:runId/rollback/preview
 *
 * Returns what rollback would change without executing.
 * Auth: org:admin only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  // Auth check - admin only
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Rate limit check
  const rateLimitCheck = await checkOrgRateLimit(ctx.orgId, '/api/normalize/runs/:runId/rollback/preview');
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

    // Validate run can be rolled back
    if (!run.rollback_available) {
      return NextResponse.json(
        { error: 'Rollback not available for this run' },
        { status: 400 }
      );
    }

    if (run.status !== 'completed') {
      return NextResponse.json(
        { error: 'Can only rollback completed runs' },
        { status: 400 }
      );
    }

    const expiresAt = new Date(run.rollback_expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Rollback window has expired' },
        { status: 400 }
      );
    }

    // Get all changes that would be rolled back
    const { data: changes, error: changesError } = await supabase
      .from('normalization_changes')
      .select('hubspot_company_id, field_name')
      .eq('run_id', runId)
      .eq('org_id', ctx.orgId)
      .eq('status', 'applied');

    if (changesError) {
      captureWithOrgContext(changesError, ctx.orgId, { route: '/api/normalize/runs/:runId/rollback/preview' });
      console.error('Failed to get changes for preview:', changesError);
      return NextResponse.json(
        { error: 'Failed to preview rollback' },
        { status: 500 }
      );
    }

    // Calculate affected records
    const affectedRecords = new Set(changes?.map(c => c.hubspot_company_id) || []);

    // Calculate field summary
    const fieldMap = new Map<string, Set<string>>();
    for (const change of changes || []) {
      if (!fieldMap.has(change.field_name)) {
        fieldMap.set(change.field_name, new Set());
      }
      fieldMap.get(change.field_name)!.add(change.hubspot_company_id);
    }

    const fieldSummary: FieldSummary[] = Array.from(fieldMap.entries())
      .map(([field_name, records]) => ({
        field_name,
        records_affected: records.size,
      }))
      .sort((a, b) => b.records_affected - a.records_affected);

    const response: RollbackPreviewResponse = {
      records_affected: affectedRecords.size,
      field_summary: fieldSummary,
      expires_at: run.rollback_expires_at,
      rollback_available: run.rollback_available,
      status: run.status,
    };

    return NextResponse.json(response);
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/normalize/runs/:runId/rollback/preview' });
    console.error('Failed to preview rollback:', error);
    return NextResponse.json(
      { error: 'Failed to preview rollback' },
      { status: 500 }
    );
  }
}
