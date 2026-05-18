import { NextRequest, NextResponse } from 'next/server';
import { enqueueDigestJob } from '@/lib/queue/digest-queue';
import type { AlwaysOnTriggerRequest, AlwaysOnTriggerResponse } from '@/lib/always-on/types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * POST /api/always-on/trigger
 *
 * Manually triggers an Always On digest job.
 * Auth: admin only (TODO: implement auth check)
 */
export async function POST(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  try {
    const orgId = ctx.orgId;
    const body: AlwaysOnTriggerRequest = await request.json();

    const { connectionId } = body;

    // Enqueue digest job
    const result = await enqueueDigestJob(orgId, connectionId, 'manual');

    if (!result.queued) {
      return NextResponse.json(
        { error: result.reason || 'Failed to enqueue job' },
        { status: 500 }
      );
    }

    // Extract runId from jobId (format: "orgId:connectionId:timestamp" or "orgId:all:timestamp")
    // For now, we'll return the jobId as runId since the actual runId is created in the job
    return NextResponse.json({
      jobId: result.jobId!,
      runId: result.jobId!, // Will be replaced with actual runId in job
    } as AlwaysOnTriggerResponse);
  } catch (error) {
    console.error('Failed to trigger Always On digest:', error);
    return NextResponse.json(
      { error: 'Failed to trigger digest' },
      { status: 500 }
    );
  }
}
