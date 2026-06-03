import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { enqueueLiveRunJob } from '@/lib/queue/arrangement-queue';
import { estimateRunCost } from '@/lib/arrangements/estimate-cost';

/**
 * POST /api/arrangements/:id/run
 *
 * Starts a live run of the arrangement.
 * Processes all records and deducts credits.
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

    // Get total records from request body
    const body = await request.json();
    const totalRecords = body.totalRecords || 0;

    // Estimate cost
    const estimate = estimateRunCost(arrangement.enrichment_steps, totalRecords);

    // Check credits
    const { data: org } = await supabase
      .from('organizations')
      .select('credits_remaining')
      .eq('org_id', ctx.orgId)
      .single();

    if (org && org.credits_remaining < estimate.total_credits) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          estimated: estimate.total_credits,
          available: org.credits_remaining,
        },
        { status: 402 }
      );
    }

    // Create run record
    const { data: run, error: runError } = await supabase
      .from('arrangement_runs')
      .insert({
        arrangement_id: arrangement.id,
        org_id: ctx.orgId,
        run_type: 'live',
        status: 'queued',
        object_type: 'company',  // Default to company for backward compatibility
        source_snapshot: {
          type: arrangement.source_type,
          total_records: totalRecords,
        },
        total_records: totalRecords,
        estimated_credits: estimate.total_credits,
        initiated_by: ctx.userId,
      })
      .select()
      .single();

    if (runError || !run) {
      captureWithOrgContext(runError, ctx.orgId, { route: '/api/arrangements/:id/run' });
      return NextResponse.json(
        { error: 'Failed to create run' },
        { status: 500 }
      );
    }

    // Enqueue live run job
    const result = await enqueueLiveRunJob({
      arrangementId: arrangement.id,
      runId: run.id,
      orgId: ctx.orgId,
      config: arrangement,
      totalRecords,
    });

    if (!result.queued) {
      return NextResponse.json(
        { error: result.reason || 'Failed to queue run' },
        { status: 500 }
      );
    }

    // Store job_id for cancellation support
    if (result.jobId) {
      await supabase
        .from('arrangement_runs')
        .update({ job_id: result.jobId })
        .eq('id', run.id);
    }

    return NextResponse.json({
      success: true,
      runId: run.id,
      jobId: result.jobId,
      totalRecords,
      estimatedCredits: estimate.total_credits,
    });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/:id/run' });
    console.error('Failed to start run:', error);
    return NextResponse.json(
      { error: 'Failed to start run' },
      { status: 500 }
    );
  }
}
