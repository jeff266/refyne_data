import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { enqueueScan } from '@/lib/compliance/compliance-scanner';
import { getAccessToken } from '@/lib/hubspot/get-access-token';

/**
 * POST /api/hubspot/connections/:id/sync
 *
 * Triggers immediate compliance scan for this connection.
 * Updates last_sync_at, last_sync_status = 'running'
 * Enqueues BullMQ scan job.
 *
 * Auth: org:admin only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const connectionId = params.id;

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Fetch connection to verify ownership
    const { data: connection, error: fetchError } = await supabase
      .from('hubspot_connections')
      .select('org_id, last_sync_status, has_export_scope')
      .eq('id', connectionId)
      .single();

    if (fetchError || !connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Verify org ownership
    if (connection.org_id !== ctx.orgId) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }

    // Check if sync is already running
    if (connection.last_sync_status === 'running') {
      return NextResponse.json(
        { error: 'Sync already in progress' },
        { status: 409 }
      );
    }

    // Get valid access token (handles token refresh)
    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Failed to get access token' },
        { status: 500 }
      );
    }

    // Update sync status to 'running'
    const { error: updateError } = await supabase
      .from('hubspot_connections')
      .update({
        last_sync_status: 'running',
        last_sync_at: new Date().toISOString(),
        last_sync_error: null,
      })
      .eq('id', connectionId);

    if (updateError) {
      console.error('[Sync] Failed to update status:', updateError);
      captureWithOrgContext(updateError, ctx.orgId, { route: '/api/hubspot/connections/:id/sync' });
      return NextResponse.json(
        { error: 'Failed to start sync' },
        { status: 500 }
      );
    }

    // Enqueue BullMQ compliance scan job
    const scanResult = await enqueueScan(
      ctx.orgId,
      accessToken,
      connection.has_export_scope || false
    );

    if (!scanResult.queued) {
      // Failed to enqueue - revert status
      await supabase
        .from('hubspot_connections')
        .update({
          last_sync_status: 'failed',
          last_sync_error: scanResult.reason || 'Failed to enqueue scan job',
        })
        .eq('id', connectionId);

      return NextResponse.json(
        { error: scanResult.reason || 'Failed to enqueue scan' },
        { status: 500 }
      );
    }

    const jobId = scanResult.jobId;
    console.log(`[Sync] Enqueued compliance scan job ${jobId} for connection ${connectionId}`);

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('[Sync] Unexpected error:', error);
    captureWithOrgContext(error, ctx.orgId, { route: '/api/hubspot/connections/:id/sync' });
    return NextResponse.json(
      { error: 'Failed to start sync' },
      { status: 500 }
    );
  }
}
