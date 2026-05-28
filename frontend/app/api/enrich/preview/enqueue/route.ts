import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { enqueuePreviewJob } from '@/lib/queue/enrichment-queue';

/**
 * POST /api/enrich/preview/enqueue
 *
 * Enqueues a preview enrichment job without writing to HubSpot.
 * Returns immediately with jobId and runId for polling.
 */
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { source, fieldKeys, providerId, recordLimit, harmonyIds } = body;

    // Validate request
    if (!source || !fieldKeys || fieldKeys.length === 0 || !providerId) {
      return NextResponse.json(
        { error: 'Missing required fields: source, fieldKeys, providerId' },
        { status: 400 }
      );
    }

    // Create arrangement_runs record
    const { data: run, error: insertError } = await supabase
      .from('arrangement_runs')
      .insert({
        org_id: ctx.orgId,
        arrangement_id: null, // Enrich page runs have no parent arrangement
        run_type: 'live',
        status: 'queued',
        source_snapshot: {
          type: 'enrich_page_preview',
          source,
          fields: fieldKeys,
          provider: providerId,
          record_limit: recordLimit,
          harmony_ids: harmonyIds || [],
        },
        initiated_by: ctx.userId,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError || !run) {
      console.error('[Preview Enqueue] Failed to create run record:', insertError);
      return NextResponse.json(
        { error: 'Failed to create run record' },
        { status: 500 }
      );
    }

    // Enqueue job
    const { queued, jobId, reason } = await enqueuePreviewJob({
      runId: run.id,
      orgId: ctx.orgId,
      userId: ctx.userId,
      source,
      fieldKeys,
      providerId,
      recordLimit: recordLimit || 20,
      harmonyIds: harmonyIds || [],
    });

    if (!queued) {
      // Delete the run record if enqueue failed
      await supabase.from('arrangement_runs').delete().eq('id', run.id);

      return NextResponse.json(
        { error: `Failed to enqueue job: ${reason}` },
        { status: 503 }
      );
    }

    console.log(`[Preview Enqueue] Job ${jobId} queued for run ${run.id}`);

    // Estimate completion time (rough: ~0.5s per company)
    const estimatedSeconds = Math.ceil((recordLimit || 20) * 0.5);

    return NextResponse.json({
      jobId,
      runId: run.id,
      estimatedSeconds,
    });
  } catch (error) {
    console.error('[Preview Enqueue] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to enqueue preview',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
