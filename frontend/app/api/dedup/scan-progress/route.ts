import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getCompanyDedupScanQueue } from '@/lib/dedup/company-dedup-scanner';

/**
 * GET /api/dedup/scan-progress?jobId=xxx
 *
 * Gets the progress of a company dedup scan job.
 */
export async function GET(request: NextRequest) {
  // Add auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Feature gate: dedup
  try {
    await requireFeature(ctx.orgId, 'dedup');
  } catch (error) {
    const gateError = parseFeatureGateError(error);
    if (gateError) {
      return NextResponse.json(
        { error: 'feature_gated', feature: gateError.feature, currentPlan: gateError.currentPlan },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    // Get jobId from query params
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId query parameter is required' },
        { status: 400 }
      );
    }

    // Get the queue
    const queue = getCompanyDedupScanQueue();
    if (!queue) {
      return NextResponse.json(
        { error: 'Queue not configured' },
        { status: 503 }
      );
    }

    // Get the job
    const job = await queue.getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Verify the job belongs to this org
    if (job.data.orgId !== ctx.orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get job state
    const state = await job.getState();

    // Map BullMQ states to our response format
    let phase: 'started' | 'progress' | 'completed' | 'failed';
    let completed = false;
    let error: string | undefined;
    let pairsFound = 0;
    let progress = 0;

    switch (state) {
      case 'waiting':
      case 'delayed':
        phase = 'started';
        progress = 0;
        break;

      case 'active':
        phase = 'progress';
        // BullMQ progress is a number between 0-100
        progress = job.progress as number || 0;
        // Check if job has stored partial results in data
        if (job.returnvalue) {
          pairsFound = job.returnvalue.pairsDetected || 0;
        }
        break;

      case 'completed':
        phase = 'completed';
        completed = true;
        progress = 100;
        if (job.returnvalue) {
          pairsFound = job.returnvalue.pairsDetected || 0;
        }
        break;

      case 'failed':
        phase = 'failed';
        completed = true;
        error = job.failedReason || 'Unknown error';
        break;

      default:
        phase = 'started';
        progress = 0;
    }

    return NextResponse.json({
      phase,
      progress,
      pairsFound,
      completed,
      error,
    });
  } catch (err) {
    captureWithOrgContext(err, ctx.orgId, { route: '/api/dedup/scan-progress' });
    console.error('Failed to get scan progress:', err);
    return NextResponse.json(
      { error: 'Failed to get scan progress' },
      { status: 500 }
    );
  }
}
