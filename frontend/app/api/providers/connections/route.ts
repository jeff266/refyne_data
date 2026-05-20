import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError, requireOperatorOrAbove } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/providers/connections
 *
 * Returns list of configured provider connections for the org
 * Auth: org:operator or above
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
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

    // Query provider_connections table for active connections
    const { data: providerConnections, error: dbError } = await supabase
      .from('provider_connections')
      .select('provider, status')
      .eq('org_id', ctx.orgId)
      .eq('status', 'active');

    if (dbError) {
      console.error('Failed to query provider_connections:', dbError);
      // If table doesn't exist yet, return empty array
      return NextResponse.json({ connections: [] });
    }

    // Always include Refyne Data as a managed provider
    const connections = [
      { provider: 'refyne', status: 'active' },
      ...(providerConnections || []).map((conn) => ({
        provider: conn.provider,
        status: conn.status,
      })),
    ];

    return NextResponse.json({ connections });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/providers/connections' });
    console.error('Failed to get provider connections:', error);
    return NextResponse.json(
      { error: 'Failed to get connections' },
      { status: 500 }
    );
  }
}
