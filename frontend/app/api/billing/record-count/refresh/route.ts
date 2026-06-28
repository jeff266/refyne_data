import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { enqueueRecordCountJob } from '@/lib/queue/record-count-queue';
import { getAccessToken } from '@/lib/hubspot/get-access-token';

export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/record-count/refresh
 *
 * Manually trigger a refresh of HubSpot record counts for the authenticated org.
 * Enqueues a background job to fetch latest counts from HubSpot API.
 *
 * Response:
 * {
 *   success: boolean;
 *   jobId?: string;
 *   reason?: string;
 * }
 */
export async function POST(req: NextRequest) {
  // 1. Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // 2. Get HubSpot connection for this org
  const { data: connection, error: connectionError } = await supabaseAdmin
    .from('hubspot_connections')
    .select('portal_id')
    .eq('org_id', ctx.orgId)
    .eq('connection_status', 'active')
    .maybeSingle();

  if (connectionError || !connection) {
    return NextResponse.json(
      { success: false, reason: 'No active HubSpot connection found' },
      { status: 404 }
    );
  }

  // 3. Get access token
  let accessToken: string;
  try {
    accessToken = await getAccessToken(ctx.orgId);
  } catch (error) {
    console.error('[RecordCount Refresh] Failed to get access token:', error);
    return NextResponse.json(
      { success: false, reason: 'Failed to get HubSpot access token' },
      { status: 500 }
    );
  }

  // 4. Enqueue record count job
  try {
    const enqueueResult = await enqueueRecordCountJob(
      ctx.orgId,
      connection.portal_id,
      accessToken
    );

    if (enqueueResult.queued) {
      return NextResponse.json({
        success: true,
        jobId: enqueueResult.jobId,
      });
    } else {
      return NextResponse.json({
        success: false,
        reason: enqueueResult.reason || 'Job not enqueued',
      });
    }
  } catch (error) {
    console.error('[RecordCount Refresh] Failed to enqueue job:', error);
    return NextResponse.json(
      { success: false, reason: 'Failed to enqueue record count job' },
      { status: 500 }
    );
  }
}
