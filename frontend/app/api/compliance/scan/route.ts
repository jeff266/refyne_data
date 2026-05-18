import { NextRequest, NextResponse } from 'next/server';
import { enqueueScan, runComplianceScan } from '@/lib/compliance';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * POST /api/compliance/scan
 *
 * Enqueues a compliance scan BullMQ job for this org.
 * Returns jobId. Non-blocking - returns immediately.
 *
 * Body: {
 *   accessToken: string,
 *   hasExportScope?: boolean,
 *   sync?: boolean  // If true, runs synchronously (for testing)
 * }
 */
export async function POST(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  try {
    const body = await request.json();
    const { accessToken, hasExportScope, sync } = body;
    const orgId = ctx.orgId;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Missing accessToken in request body' },
        { status: 400 }
      );
    }

    // If sync mode, run the scan directly (for testing)
    if (sync) {
      const result = await runComplianceScan(orgId, accessToken, hasExportScope);
      return NextResponse.json({ success: true, result });
    }

    // Otherwise, enqueue the scan job
    const { queued, jobId, reason } = await enqueueScan(
      orgId,
      accessToken,
      hasExportScope || false
    );

    if (!queued) {
      return NextResponse.json(
        { success: false, error: reason },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      jobId,
    });
  } catch (error) {
    console.error('Failed to enqueue compliance scan:', error);
    return NextResponse.json(
      { error: 'Failed to enqueue compliance scan' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/compliance/scan
 *
 * Health check for the scan endpoint.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    description: 'POST to this endpoint to enqueue a compliance scan',
  });
}
