import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { enqueueRehearsalJob } from '@/lib/queue/arrangement-queue';
import { estimateRunCost } from '@/lib/arrangements/estimate-cost';

/**
 * POST /api/arrangements/:id/rehearse
 *
 * Runs a rehearsal of the arrangement (demo or live mode).
 * Demo mode: uses synthetic data, no credits consumed.
 * Live mode: uses real API calls on sample data, credits consumed.
 * Auth: org:operator or above
 */
export async function POST(
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
    const mode = body.mode || 'demo'; // 'demo' or 'live'
    const sampleSize = Math.min(body.sampleSize || 10, 50); // Max 50 for rehearsal

    if (!['demo', 'live'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "demo" or "live"' },
        { status: 400 }
      );
    }

    // Get arrangement
    const { data: arrangement, error } = await supabase
      .from('arrangements')
      .select('*')
      .eq('id', params.id)
      .eq('org_id', ctx.orgId)
      .single();

    if (error || !arrangement) {
      return NextResponse.json(
        { error: 'Arrangement not found' },
        { status: 404 }
      );
    }

    // Estimate cost for rehearsal
    const estimate = estimateRunCost(arrangement.enrichment_steps, sampleSize);

    // Create run record
    const { data: run, error: runError } = await supabase
      .from('arrangement_runs')
      .insert({
        arrangement_id: arrangement.id,
        org_id: ctx.orgId,
        run_type: mode === 'demo' ? 'rehearsal_demo' : 'rehearsal_live',
        status: 'queued',
        object_type: 'company',  // Default to company for backward compatibility
        source_snapshot: {
          type: arrangement.source_type,
          total_records: sampleSize,
          sample_ids: [],
        },
        total_records: sampleSize,
        estimated_credits: mode === 'demo' ? 0 : estimate.total_credits,
        initiated_by: ctx.userId,
      })
      .select()
      .single();

    if (runError || !run) {
      captureWithOrgContext(runError, ctx.orgId, { route: '/api/arrangements/:id/rehearse' });
      return NextResponse.json(
        { error: 'Failed to create rehearsal run' },
        { status: 500 }
      );
    }

    // Enqueue rehearsal job
    const result = await enqueueRehearsalJob({
      arrangementId: arrangement.id,
      runId: run.id,
      orgId: ctx.orgId,
      config: arrangement,
      mode: mode as 'demo' | 'live',
      sampleSize,
    });

    if (!result.queued) {
      return NextResponse.json(
        { error: result.reason || 'Failed to queue rehearsal' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      runId: run.id,
      jobId: result.jobId,
      mode,
      sampleSize,
      estimatedCredits: mode === 'demo' ? 0 : estimate.total_credits,
    });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/:id/rehearse' });
    console.error('Failed to start rehearsal:', error);
    return NextResponse.json(
      { error: 'Failed to start rehearsal' },
      { status: 500 }
    );
  }
}
