import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/onboarding/scan-trigger
 *
 * Triggers compliance scan immediately after HubSpot connect
 * Auth: any role
 */
export async function POST(request: NextRequest) {
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

    // Check if org has a HubSpot connection
    const { data: connection, error: connError } = await supabase
      .from('hubspot_connections')
      .select('id, portal_id')
      .eq('org_id', ctx.orgId)
      .eq('connection_status', 'active')
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'No active HubSpot connection found' },
        { status: 404 }
      );
    }

    const runId = uuidv4();

    // Insert initial scan progress event
    const { error: eventError } = await supabase
      .from('scan_progress_events')
      .insert({
        org_id: ctx.orgId,
        run_id: runId,
        event_type: 'started',
        message: `Connected to Portal ${connection.portal_id}`,
      });

    if (eventError) {
      captureWithOrgContext(eventError, ctx.orgId, { route: '/api/onboarding/scan-trigger' });
      console.error('Failed to insert scan progress event:', eventError);
    }

    // TODO: Enqueue BullMQ compliance scan job
    // For now, we'll trigger it via HTTP call or direct function invocation
    // This will be implemented when the compliance scanner is refactored

    return NextResponse.json({ runId });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/onboarding/scan-trigger' });
    console.error('Failed to trigger scan:', error);
    return NextResponse.json(
      { error: 'Failed to trigger scan' },
      { status: 500 }
    );
  }
}
