import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { checkOrgRateLimit, rateLimitErrorResponse } from '@/lib/hubspot/org-rate-limiter';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { getConnection } from '@/lib/hubspot';
import { executeRollback } from '@/lib/normalize/rollback';

interface RollbackResponse {
  success: boolean;
  rolledBack: number;
  failed: number;
  errors: Array<{
    recordId: string;
    field: string;
    error: string;
  }>;
}

/**
 * POST /api/normalize/runs/:runId/rollback
 *
 * Execute rollback for a normalization run.
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
  const rateLimitCheck = await checkOrgRateLimit(ctx.orgId, '/api/normalize/runs/:runId/rollback');
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

    // Mark run as rolling back
    await supabase
      .from('normalization_runs')
      .update({ status: 'rolling_back' })
      .eq('id', runId);

    // Get HubSpot connection
    const connection = await getConnection(ctx.orgId);
    if (!connection) {
      await supabase
        .from('normalization_runs')
        .update({
          status: 'failed',
          error_message: 'HubSpot connection not found',
        })
        .eq('id', runId);

      return NextResponse.json(
        { error: 'HubSpot not connected' },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken(ctx.orgId);

    // Execute rollback
    const result = await executeRollback(
      runId,
      ctx.orgId,
      accessToken,
      connection.portalId
    );

    // Update run status
    await supabase
      .from('normalization_runs')
      .update({
        status: 'rolled_back',
        rolled_back_at: new Date().toISOString(),
        rolled_back_by: ctx.userId,
      })
      .eq('id', runId);

    const response: RollbackResponse = {
      success: result.success,
      rolledBack: result.rolled_back,
      failed: result.failed,
      errors: result.errors.map(err => ({
        recordId: err.record_id,
        field: err.field,
        error: err.error,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/normalize/runs/:runId/rollback' });
    console.error('Failed to execute rollback:', error);

    // Mark run as failed
    if (supabase) {
      await supabase
        .from('normalization_runs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', params.runId)
        .eq('org_id', ctx.orgId);
    }

    return NextResponse.json(
      { error: 'Failed to execute rollback' },
      { status: 500 }
    );
  }
}
