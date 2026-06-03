import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { enqueueApplyJob } from '@/lib/queue/enrichment-queue';
import { createClient } from 'redis';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * POST /api/enrich/apply/enqueue?objectType=company|contact
 *
 * Enqueues an apply job to write cached preview results to HubSpot.
 * Validates that preview results exist and are fresh.
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

    const { searchParams } = new URL(req.url);
    const objectType = searchParams.get('objectType') ?? 'company';

    const body = await req.json();
    const { jobId: previewJobId, runId: previewRunId, selectedRecordIds } = body;

    // Validate request
    if (!previewJobId || !selectedRecordIds || selectedRecordIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: jobId, selectedRecordIds' },
        { status: 400 }
      );
    }

    // Check if preview results exist in cache
    if (REDIS_URL && REDIS_TOKEN) {
      const url = new URL(REDIS_URL);
      const redis = createClient({
        url: REDIS_URL,
        password: REDIS_TOKEN,
      });

      await redis.connect();
      const cached = await redis.get(`preview:${previewJobId}:results`);
      await redis.quit();

      if (!cached) {
        return NextResponse.json(
          { error: 'Preview results expired. Run preview again.' },
          { status: 410 } // 410 Gone
        );
      }
    }

    // Create arrangement_runs record for apply
    const { data: run, error: insertError } = await supabase
      .from('arrangement_runs')
      .insert({
        org_id: ctx.orgId,
        arrangement_id: null,
        run_type: 'live',
        status: 'queued',
        object_type: objectType,
        source_snapshot: {
          type: 'enrich_page_apply',
          preview_job_id: previewJobId,
          preview_run_id: previewRunId,
          selected_count: selectedRecordIds.length,
        },
        initiated_by: ctx.userId,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError || !run) {
      console.error('[Apply Enqueue] Failed to create run record:', insertError);
      return NextResponse.json(
        { error: 'Failed to create run record' },
        { status: 500 }
      );
    }

    // Enqueue apply job
    const { queued, jobId, reason } = await enqueueApplyJob({
      runId: run.id,
      orgId: ctx.orgId,
      userId: ctx.userId,
      objectType,
      previewJobId,
      selectedRecordIds,
    });

    if (!queued) {
      // Delete the run record if enqueue failed
      await supabase.from('arrangement_runs').delete().eq('id', run.id);

      return NextResponse.json(
        { error: `Failed to enqueue job: ${reason}` },
        { status: 503 }
      );
    }

    console.log(`[Apply Enqueue] Job ${jobId} queued for run ${run.id}`);

    return NextResponse.json({
      jobId,
      runId: run.id,
    });
  } catch (error) {
    console.error('[Apply Enqueue] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to enqueue apply',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
