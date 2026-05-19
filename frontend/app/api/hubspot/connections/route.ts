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
    console.log('[Connections GET] Getting org context...');
    ctx = await getOrgContext();
    console.log('[Connections GET] Got context:', { orgId: ctx.orgId, role: ctx.orgRole });
  } catch (e) {
    console.error('[Connections GET] Auth error:', e);
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    // Check org rate limit
    const rateLimitCheck = await checkOrgRateLimit(ctx.orgId, '/api/hubspot/connections');
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        rateLimitErrorResponse(rateLimitCheck.resetAt!, rateLimitCheck.remaining!),
        { status: 429 }
      );
    }

    if (!supabase) {
      console.error('[Connections GET] Supabase not configured');
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    console.log('[Connections GET] Fetching connections for org:', ctx.orgId);

    const { data: connections, error } = await supabase
      .from('hubspot_connections')
      .select('id, portal_id, hub_id, friendly_name, connection_status, last_active_at, created_at, access_token, encrypted_token')
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

    console.log('[Connections GET] Found connections:', {
      count: connections?.length || 0,
      connections: connections?.map(c => ({ id: c.id, portalId: c.portal_id, status: c.connection_status })),
    });

    // Transform snake_case to camelCase for UI
    const transformedConnections = (connections || []).map((conn: any) => ({
      id: conn.id,
      portalId: conn.portal_id,
      hubId: conn.hub_id,
      friendlyName: conn.friendly_name,
      connectionStatus: conn.connection_status,
      lastActiveAt: conn.last_active_at,
      createdAt: conn.created_at,
      accessToken: conn.access_token,
      encryptedToken: conn.encrypted_token,
    }));

    return NextResponse.json({
      connections: transformedConnections,
    });
  } catch (error) {
    console.error('[Connections GET] Unexpected error:', error);
    captureWithOrgContext(error, ctx?.orgId || 'unknown', { route: '/api/hubspot/connections' });
    return NextResponse.json(
      { error: 'Failed to fetch connections', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
