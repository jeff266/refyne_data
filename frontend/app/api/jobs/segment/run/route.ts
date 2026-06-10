/**
 * POST /api/jobs/segment/run
 *
 * Starts a new job segmentation run. Creates a run record in the database
 * and enqueues a job to the BullMQ worker.
 *
 * Body:
 * - dryRun: boolean (default: false) - If true, classifies but does not write to HubSpot
 * - batchSize: number (default: 100) - Number of contacts to process per batch
 *
 * Returns:
 * - runId: string - UUID of the created run
 * - status: string - Initial status ('pending')
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { jobSegmentationQueue } from '@/lib/queue/job-segmentation-worker';
import { decryptToken } from '@/lib/crypto/token-encryption';
import { getJobPriority } from '@/lib/billing/job-priority';

export async function POST(req: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const dryRun = body.dryRun ?? false;
    const batchSize = body.batchSize ?? 100;
    const levelField = body.levelField ?? 'refyne_job_level';
    const functionField = body.functionField ?? 'refyne_job_function';

    // Get HubSpot connection for this org
    const { data: connection } = await supabaseAdmin
      .from('hubspot_connections')
      .select('portal_id, access_token')
      .eq('org_id', orgId)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'No active HubSpot connection found' },
        { status: 400 }
      );
    }

    // Decrypt access token
    const accessToken = decryptToken(connection.access_token);

    // Create run record
    const { data: run, error: createError } = await supabaseAdmin
      .from('job_segmentation_runs')
      .insert({
        org_id: orgId,
        portal_id: connection.portal_id,
        status: 'pending',
        dry_run: dryRun,
        batch_size: batchSize,
        level_field: levelField,
        function_field: functionField,
      })
      .select()
      .single();

    if (createError || !run) {
      console.error('[JobSegmentation] Failed to create run:', createError);
      return NextResponse.json(
        { error: 'Failed to create run record' },
        { status: 500 }
      );
    }

    // Enqueue job with priority based on subscription tier
    const priority = await getJobPriority(orgId);
    await jobSegmentationQueue.add('segment-jobs', {
      runId: run.id,
      orgId,
      portalId: connection.portal_id,
      accessToken,
      dryRun,
      batchSize,
    }, {
      priority,
    });

    console.log(`[JobSegmentation] Run ${run.id} enqueued (dryRun: ${dryRun})`);

    return NextResponse.json({
      runId: run.id,
      status: run.status,
      dryRun: run.dry_run,
    });
  } catch (error) {
    console.error('[JobSegmentation] POST /api/jobs/segment/run failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
