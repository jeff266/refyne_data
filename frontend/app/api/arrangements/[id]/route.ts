import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError, requireOperatorOrAbove } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { transformArray } from '@/lib/utils/transform';
import { cancelArrangementJobs } from '@/lib/queue/arrangement-queue';

/**
 * GET /api/arrangements/:id
 *
 * Returns full arrangement with config, last 10 runs, and schedule.
 * Auth: org:operator or above
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Fetch arrangement
    const { data: arrangement, error: arrError } = await supabase
      .from('arrangements')
      .select('*')
      .eq('id', params.id)
      .eq('org_id', ctx.orgId)
      .is('archived_at', null)
      .single();

    if (arrError || !arrangement) {
      return NextResponse.json(
        { error: 'Arrangement not found' },
        { status: 404 }
      );
    }

    // Fetch last 10 runs
    const { data: runs } = await supabase
      .from('arrangement_runs')
      .select('id, run_type, status, total_records, successful_records, started_at, completed_at')
      .eq('arrangement_id', params.id)
      .order('started_at', { ascending: false })
      .limit(10);

    // Calculate run stats (duration, fill rate)
    const runsWithStats = (runs || []).map((run) => {
      const duration = run.completed_at
        ? Math.floor((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)
        : null;

      const fillRate = run.total_records > 0
        ? Math.round((run.successful_records / run.total_records) * 100)
        : 0;

      return {
        ...run,
        duration_seconds: duration,
        fill_rate: fillRate,
      };
    });

    return NextResponse.json({
      arrangement: transformArray([arrangement])[0],
      runs: runsWithStats,
    });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: `/api/arrangements/${params.id}` });
    console.error('Failed to get arrangement:', error);
    return NextResponse.json(
      { error: 'Failed to get arrangement' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/arrangements/:id
 *
 * Updates arrangement configuration.
 * Auth: org:operator or above
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const body = await request.json();

    // Update arrangement
    const { data: arrangement, error } = await supabase
      .from('arrangements')
      .update({
        name: body.name,
        description: body.description,
        source_type: body.source_type,
        source_config: body.source_config,
        enrichment_steps: body.enrichment_steps,
        output_destination: body.output_destination,
        output_config: body.output_config,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('org_id', ctx.orgId)
      .select()
      .single();

    if (error || !arrangement) {
      captureWithOrgContext(error, ctx.orgId, { route: `/api/arrangements/${params.id}`, action: 'update' });
      console.error('Failed to update arrangement:', error);
      return NextResponse.json(
        { error: 'Failed to update arrangement' },
        { status: 500 }
      );
    }

    // TODO: If schedule changed, update BullMQ cron job

    return NextResponse.json({
      arrangement: transformArray([arrangement])[0]
    });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: `/api/arrangements/${params.id}`, action: 'update' });
    console.error('Failed to update arrangement:', error);
    return NextResponse.json(
      { error: 'Failed to update arrangement' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/arrangements/:id
 *
 * Soft deletes arrangement (sets archived_at timestamp).
 * Preserves run history.
 * Auth: org:operator or above
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Soft delete (set archived_at)
    const { error } = await supabase
      .from('arrangements')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('org_id', ctx.orgId);

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: `/api/arrangements/${params.id}`, action: 'delete' });
      console.error('Failed to delete arrangement:', error);
      return NextResponse.json(
        { error: 'Failed to delete arrangement' },
        { status: 500 }
      );
    }

    // Cancel any pending/active BullMQ jobs for this arrangement
    const cancelResult = await cancelArrangementJobs(params.id);
    if (cancelResult.cancelled > 0) {
      console.log(`[Arrangement Delete] Cancelled ${cancelResult.cancelled} jobs for arrangement ${params.id}`);
    } else if (cancelResult.reason) {
      console.warn(`[Arrangement Delete] Failed to cancel jobs: ${cancelResult.reason}`);
      // Don't fail the delete if job cancellation fails - log and continue
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: `/api/arrangements/${params.id}`, action: 'delete' });
    console.error('Failed to delete arrangement:', error);
    return NextResponse.json(
      { error: 'Failed to delete arrangement' },
      { status: 500 }
    );
  }
}
