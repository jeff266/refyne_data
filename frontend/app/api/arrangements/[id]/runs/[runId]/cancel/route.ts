/**
 * Cancel Arrangement Run API
 *
 * POST /api/arrangements/[id]/runs/[runId]/cancel
 *
 * Cancels a running or queued enrichment job by:
 * 1. Removing the BullMQ job from the queue
 * 2. Updating run status to 'cancelled' in database
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getArrangementQueue } from '@/lib/queue/arrangement-queue';

interface RouteContext {
  params: { id: string; runId: string };
}

export async function POST(req: NextRequest, context: RouteContext) {
  let ctx;
  try {
    ctx = await getOrgContext();
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

    const { runId } = context.params;

    // Get the run and verify it belongs to this org
    const { data: run, error: runError } = await supabase
      .from('arrangement_runs')
      .select('*, arrangements!inner(org_id)')
      .eq('id', runId)
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // @ts-ignore - arrangements is joined
    if (run.arrangements.org_id !== ctx.orgId) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Check if run can be cancelled
    if (!['queued', 'running', 'paused'].includes(run.status)) {
      return NextResponse.json(
        { error: `Cannot cancel run with status: ${run.status}` },
        { status: 400 }
      );
    }

    // Cancel the BullMQ job if job_id exists
    if (run.job_id) {
      try {
        const queue = getArrangementQueue();
        if (queue) {
          const job = await queue.getJob(run.job_id);
          if (job) {
            await job.remove();
            console.log(`[Cancel Run] Removed BullMQ job ${run.job_id}`);
          }
        }
      } catch (queueError) {
        console.error('[Cancel Run] Failed to remove BullMQ job:', queueError);
        // Continue anyway - update database status even if queue removal fails
      }
    }

    // Update run status in database
    const { error: updateError } = await supabase
      .from('arrangement_runs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error_message: 'Cancelled by user',
      })
      .eq('id', runId);

    if (updateError) {
      console.error('[Cancel Run] Failed to update run status:', updateError);
      return NextResponse.json(
        { error: 'Failed to cancel run' },
        { status: 500 }
      );
    }

    console.log(`[Cancel Run] Successfully cancelled run ${runId}`);

    return NextResponse.json({
      success: true,
      message: 'Run cancelled successfully',
    });

  } catch (error) {
    console.error('[Cancel Run] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to cancel run',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
