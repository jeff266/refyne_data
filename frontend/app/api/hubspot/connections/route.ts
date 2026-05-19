import { NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { checkOrgRateLimit, rateLimitErrorResponse } from '@/lib/hubspot/org-rate-limiter';

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
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Check org rate limit
  const rateLimitCheck = await checkOrgRateLimit(ctx.orgId, '/api/hubspot/connections');
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      rateLimitErrorResponse(rateLimitCheck.resetAt!, rateLimitCheck.remaining!),
      { status: 429 }
    );
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
      .select('id, portal_id, hub_id, connection_status, last_active_at, created_at, access_token, encrypted_token')
      .eq('org_id', ctx.orgId)
      .neq('connection_status', 'disconnected');
      // Do NOT filter by access_token presence - return ALL active connections

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/hubspot/connections' });
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
