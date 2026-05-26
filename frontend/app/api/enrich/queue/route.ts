/**
 * Enrich Queue API
 *
 * POST /api/enrich/queue
 *
 * Queues enrichment job for background processing on Railway worker.
 * For large batches (50+ records) to avoid Vercel serverless timeout.
 * Small batches (<20 records) should use /api/enrich/preview for instant results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { enqueueEnrichmentJob } from '@/lib/queue/enrichment-queue';

interface QueueRequest {
  fields: string[];
  providers: string[];
  write_policy: 'fill_empty' | 'overwrite';
  record_limit: number;
  source: {
    type: 'all' | 'list' | 'segment' | 'csv';
    list_id?: string;
    filters?: {
      missing_fields?: string[];
      lifecyclestage?: string;
      hubspot_owner_id?: string;
      industry?: string[];
    };
    domains?: string[];
  };
}

interface QueueResponse {
  run_id: string;
  status: 'queued';
  job_id: string;
  message: string;
}

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

    const body: QueueRequest = await req.json();

    // Validate request
    if (!body.fields || body.fields.length === 0) {
      return NextResponse.json({ error: 'No fields specified' }, { status: 400 });
    }

    if (!body.providers || body.providers.length === 0) {
      return NextResponse.json({ error: 'No providers specified' }, { status: 400 });
    }

    if (!body.source || !body.source.type) {
      return NextResponse.json({ error: 'Invalid source configuration' }, { status: 400 });
    }

    // Create enrichment_run record
    const { data: run, error: insertError } = await supabase
      .from('enrichment_runs')
      .insert({
        org_id: ctx.orgId,
        fields: body.fields,
        providers: body.providers,
        write_policy: body.write_policy,
        source_type: body.source.type,
        source_config: body.source,
        status: 'queued',
        total_records: body.record_limit,
        initiated_by: ctx.userId,
      })
      .select('id')
      .single();

    if (insertError || !run) {
      console.error('[Queue API] Failed to create enrichment_run:', insertError);
      return NextResponse.json(
        { error: 'Failed to create enrichment run' },
        { status: 500 }
      );
    }

    const runId = run.id;

    // Enqueue job to BullMQ
    const queueResult = await enqueueEnrichmentJob({
      runId,
      orgId: ctx.orgId,
      userId: ctx.userId,
      fields: body.fields,
      providers: body.providers,
      write_policy: body.write_policy,
      source: body.source,
      record_limit: body.record_limit,
    });

    if (!queueResult.queued) {
      // Job enqueue failed - update run to failed status
      await supabase
        .from('enrichment_runs')
        .update({
          status: 'failed',
          error_message: queueResult.reason || 'Failed to enqueue job',
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId);

      return NextResponse.json(
        { error: queueResult.reason || 'Failed to enqueue job' },
        { status: 500 }
      );
    }

    // Update run with job_id
    await supabase
      .from('enrichment_runs')
      .update({ job_id: queueResult.jobId })
      .eq('id', runId);

    console.log(`[Queue API] Enqueued enrichment job ${queueResult.jobId} for run ${runId}`);

    const response: QueueResponse = {
      run_id: runId,
      status: 'queued',
      job_id: queueResult.jobId!,
      message: `Enrichment job queued. Processing ${body.record_limit} records with ${body.providers.join(', ')}.`,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Queue API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to queue enrichment job',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/enrich/queue?run_id=xxx
 *
 * Get status of queued enrichment job.
 */
export async function GET(req: NextRequest) {
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

    const runId = req.nextUrl.searchParams.get('run_id');

    if (!runId) {
      return NextResponse.json({ error: 'Missing run_id parameter' }, { status: 400 });
    }

    // Fetch run status
    const { data: run, error } = await supabase
      .from('enrichment_runs')
      .select('*')
      .eq('id', runId)
      .eq('org_id', ctx.orgId)
      .single();

    if (error || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json({
      run_id: run.id,
      status: run.status,
      total_records: run.total_records,
      processed_records: run.processed_records,
      successful_records: run.successful_records,
      failed_records: run.failed_records,
      fields_enriched: run.fields_enriched,
      fields_skipped: run.fields_skipped,
      cost_usd: run.cost_usd,
      error_message: run.error_message,
      started_at: run.started_at,
      completed_at: run.completed_at,
      job_id: run.job_id,
    });
  } catch (error) {
    console.error('[Queue API] Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to get run status' },
      { status: 500 }
    );
  }
}
