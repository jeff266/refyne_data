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
    console.log('[Connections GET] Supabase config check:', {
      hasUrl: !!process.env.SUPABASE_URL || !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseClientExists: !!supabase,
    });
    ctx = await getOrgContext();
    console.log('[Connections GET] Got context:', { orgId: ctx.orgId, role: ctx.orgRole });
  } catch (e) {
    console.error('[Connections GET] Auth error:', e);
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    // Validate org context
    if (!ctx.orgId) {
      console.error('[Connections GET] No org ID in context');
      return NextResponse.json(
        { error: 'Organization context missing' },
        { status: 400 }
      );
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
      console.error('[Connections GET] Supabase query error:', {
        error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      captureWithOrgContext(error, ctx.orgId, { route: '/api/hubspot/connections' });
      return NextResponse.json(
        {
          error: 'Failed to fetch connections',
          details: error.message,
          code: error.code
        },
        { status: 500 }
      );
    }

    console.log('[Connections GET] Found connections:', {
      count: connections?.length || 0,
      connections: connections?.map(c => ({ id: c.id, portalId: c.portal_id, status: c.connection_status })),
    });

    // Transform snake_case to camelCase for UI, and fetch company counts
    const transformedConnections = await Promise.all(
      (connections || []).map(async (conn: any) => {
        // Get company count from normalized_records
        const { count } = await supabase
          .from('normalized_records')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', ctx.orgId)
          .eq('record_type', 'company');

        return {
          id: conn.id,
          portalId: conn.portal_id,
          hubId: conn.hub_id,
          friendlyName: conn.friendly_name,
          connectionStatus: conn.connection_status,
          lastActiveAt: conn.last_active_at,
          createdAt: conn.created_at,
          accessToken: conn.access_token,
          encryptedToken: conn.encrypted_token,
          companyCount: count || 0,
        };
      })
    );

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
