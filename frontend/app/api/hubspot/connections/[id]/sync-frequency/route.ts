import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

type SyncFrequency = 'manual' | 'nightly' | 'every_6h' | 'hourly';

/**
 * PUT /api/hubspot/connections/:id/sync-frequency
 *
 * Updates sync frequency for a connection.
 * Auth: org:admin only
 * Plan gate: 'every_6h' requires Growth+, 'hourly' requires Scale+
 */
export async function PUT(
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
    const { frequency } = await request.json();

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Validate frequency
    const validFrequencies: SyncFrequency[] = ['manual', 'nightly', 'every_6h', 'hourly'];
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { error: 'Invalid frequency' },
        { status: 400 }
      );
    }

    // TODO: Add plan gating
    // For now, allow all frequencies
    // In production:
    // - 'every_6h' requires Growth+
    // - 'hourly' requires Scale+

    // Fetch connection to verify ownership
    const { data: connection, error: fetchError } = await supabase
      .from('hubspot_connections')
      .select('org_id, portal_id, friendly_name, connection_status, last_active_at, created_at')
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

    // Update sync frequency
    const { data: updated, error: updateError } = await supabase
      .from('hubspot_connections')
      .update({ sync_frequency: frequency })
      .eq('id', connectionId)
      .select()
      .single();

    if (updateError) {
      console.error('[Sync Frequency] Failed to update:', updateError);
      captureWithOrgContext(updateError, ctx.orgId, { route: '/api/hubspot/connections/:id/sync-frequency' });
      return NextResponse.json(
        { error: 'Failed to update sync frequency' },
        { status: 500 }
      );
    }

    // TODO: Re-schedule BullMQ repeatable job for this connection
    // For now, just return success

    return NextResponse.json({
      connection: {
        id: updated.id,
        portalId: updated.portal_id,
        friendlyName: updated.friendly_name,
        connectionStatus: updated.connection_status,
        syncFrequency: updated.sync_frequency,
        lastActiveAt: updated.last_active_at,
        createdAt: updated.created_at,
      },
    });
  } catch (error) {
    console.error('[Sync Frequency] Unexpected error:', error);
    captureWithOrgContext(error, ctx.orgId, { route: '/api/hubspot/connections/:id/sync-frequency' });
    return NextResponse.json(
      { error: 'Failed to update sync frequency' },
      { status: 500 }
    );
  }
}
