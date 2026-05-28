import { NextRequest, NextResponse } from 'next/server';
import { authError, requireOperatorOrAbove } from '@/lib/auth/clerk-helpers';
import { Queue } from 'bullmq';
import { createRedisConnection, isRedisConfigured } from '@/lib/queue/redis';

/**
 * GET /api/jobs/[jobId]/status
 *
 * Returns the current status and progress of a BullMQ job.
 * Checks both preview and apply queues.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { jobId } = params;

  if (!jobId) {
    return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
  }

  try {
    if (!isRedisConfigured()) {
      return NextResponse.json(
        { error: 'Queue not configured' },
        { status: 503 }
      );
    }

    const connection = createRedisConnection();

    // Try both preview and apply queues
    const previewQueue = new Queue('enrich-preview', { connection });
    const applyQueue = new Queue('enrich-apply', { connection });

    let job = await previewQueue.getJob(jobId);
    if (!job) {
      job = await applyQueue.getJob(jobId);
    }

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const state = await job.getState();
    const progress = job.progress as any;
    const failedReason = job.failedReason;

    // Map BullMQ state to our API state
    let status: 'queued' | 'processing' | 'completed' | 'failed';
    if (state === 'completed') {
      status = 'completed';
    } else if (state === 'failed') {
      status = 'failed';
    } else if (state === 'active') {
      status = 'processing';
    } else {
      status = 'queued';
    }

    return NextResponse.json({
      jobId,
      runId: job.data.runId,
      status,
      progress: progress || {
        completed: 0,
        total: 0,
        percentage: 0,
        currentCompany: null,
      },
      error: failedReason || null,
    });
  } catch (error) {
    console.error('[Job Status] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get job status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
