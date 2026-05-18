import { NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';

/**
 * GET /api/hubspot/connections
 *
 * Fetch HubSpot connections for the current org.
 * Returns connection status, portal info, and last activity.
 *
 * Auth: requires org context
 */
export async function GET() {
  let ctx;
  try {
    ctx = getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    );
  }

  try {
    const { data: connections, error } = await supabase
      .from('hubspot_connections')
      .select('id, portal_id, connection_status, last_active_at, created_at')
      .eq('org_id', ctx.orgId);

    if (error) {
      console.error('Failed to fetch HubSpot connections:', error);
      return NextResponse.json(
        { error: 'Failed to fetch connections' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      connections: connections || [],
    });
  } catch (error) {
    console.error('Error fetching HubSpot connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}
