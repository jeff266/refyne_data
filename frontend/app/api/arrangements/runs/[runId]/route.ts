import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { transformKeys, transformArray } from '@/lib/utils/transform';

/**
 * GET /api/arrangements/runs/:runId
 *
 * Returns detailed information about a run.
 * Auth: org:operator or above
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
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

    // Get run with arrangement details
    const { data: run, error } = await supabase
      .from('arrangement_runs')
      .select('*, arrangements(*)')
      .eq('id', params.runId)
      .eq('org_id', ctx.orgId)
      .single();

    if (error || !run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Get progress details
    const { data: progress } = await supabase
      .from('arrangement_run_progress')
      .select('*')
      .eq('run_id', params.runId)
      .order('completed_at', { ascending: false })
      .limit(100);

    return NextResponse.json({
      run: transformKeys(run),
      progress: transformArray(progress || []),
    });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/runs/:runId' });
    console.error('Failed to get run:', error);
    return NextResponse.json(
      { error: 'Failed to get run' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/arrangements/runs/:runId
 *
 * Controls a run (pause, resume, cancel).
 * Auth: org:operator or above
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { runId: string } }
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
    const action = body.action; // 'pause', 'resume', 'cancel'

    if (!['pause', 'resume', 'cancel'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "pause", "resume", or "cancel"' },
        { status: 400 }
      );
    }

    // Get current run
    const { data: run, error: runError } = await supabase
      .from('arrangement_runs')
      .select('*')
      .eq('id', params.runId)
      .eq('org_id', ctx.orgId)
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Validate state transitions
    const updates: Record<string, unknown> = {};

    if (action === 'pause') {
      if (run.status !== 'running') {
        return NextResponse.json(
          { error: 'Can only pause running runs' },
          { status: 400 }
        );
      }
      updates.status = 'paused';
      updates.paused_at = new Date().toISOString();
    }

    if (action === 'resume') {
      if (run.status !== 'paused') {
        return NextResponse.json(
          { error: 'Can only resume paused runs' },
          { status: 400 }
        );
      }
      updates.status = 'running';
      updates.resumed_at = new Date().toISOString();
    }

    if (action === 'cancel') {
      if (!['queued', 'running', 'paused'].includes(run.status)) {
        return NextResponse.json(
          { error: 'Can only cancel queued, running, or paused runs' },
          { status: 400 }
        );
      }
      updates.status = 'cancelled';
      updates.completed_at = new Date().toISOString();
    }

    // Update run
    const { data: updatedRun, error: updateError } = await supabase
      .from('arrangement_runs')
      .update(updates)
      .eq('id', params.runId)
      .eq('org_id', ctx.orgId)
      .select()
      .single();

    if (updateError || !updatedRun) {
      return NextResponse.json(
        { error: 'Failed to update run' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      run: transformKeys(updatedRun),
    });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/runs/:runId', action: 'control' });
    console.error('Failed to control run:', error);
    return NextResponse.json(
      { error: 'Failed to control run' },
      { status: 500 }
    );
  }
}
