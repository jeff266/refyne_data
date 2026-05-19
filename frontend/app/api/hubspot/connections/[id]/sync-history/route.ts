import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * GET /api/hubspot/connections/:id/sync-history
 *
 * Returns last 10 sync events from digest_runs
 * + current API usage from hubspot_connections
 *
 * Auth: org:admin only
 */
export async function GET(
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

    // Fetch connection with API usage
    const { data: connection, error: connectionError } = await supabase
      .from('hubspot_connections')
      .select('org_id, api_calls_today, api_calls_month, last_sync_at, last_sync_status, last_sync_duration_ms, last_sync_error')
      .eq('id', connectionId)
      .single();

    if (connectionError || !connection) {
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

    // Fetch last 10 digest runs for this connection
    const { data: runs, error: runsError } = await supabase
      .from('digest_runs')
      .select('id, created_at, status, records_scanned, duration_ms, error_message')
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (runsError) {
      console.error('[Sync History] Failed to fetch runs:', runsError);
      // Return empty history if query fails
    }

    return NextResponse.json({
      history: (runs || []).map(run => ({
        runAt: run.created_at,
        status: run.status,
        recordsScanned: run.records_scanned,
        durationMs: run.duration_ms,
        errorMessage: run.error_message,
      })),
      apiUsage: {
        today: connection.api_calls_today || 0,
        month: connection.api_calls_month || 0,
        dailyLimit: 250000,
        monthlyLimit: null, // HubSpot has no monthly limit
      },
      lastSync: connection.last_sync_at ? {
        at: connection.last_sync_at,
        status: connection.last_sync_status,
        durationMs: connection.last_sync_duration_ms,
        error: connection.last_sync_error,
      } : null,
    });
  } catch (error) {
    console.error('[Sync History] Unexpected error:', error);
    captureWithOrgContext(error, ctx.orgId, { route: '/api/hubspot/connections/:id/sync-history' });
    return NextResponse.json(
      { error: 'Failed to fetch sync history' },
      { status: 500 }
    );
  }
}
