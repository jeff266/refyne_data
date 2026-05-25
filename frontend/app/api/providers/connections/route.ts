import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * GET /api/providers/connections
 *
 * Returns list of connected providers with status='active'
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!isSupabaseConfigured() || !supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { data: connections, error } = await supabase
      .from('provider_connections')
      .select('provider, status, key_hint, last_tested_at')
      .eq('org_id', ctx.orgId)
      .eq('status', 'active');

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/providers/connections' });
      console.error('[Provider Connections] Query failed:', error);
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
    }

    // Add managed providers (GraphIQ) if they have env keys configured
    const allConnections = [...(connections || [])];

    // GraphIQ: Check if env var is set or if there's an org-specific connection
    if (process.env.GRAPHIQ_API_KEY || connections?.some(c => c.provider === 'graphiq')) {
      const hasGraphIQ = allConnections.some(c => c.provider === 'graphiq');
      if (!hasGraphIQ) {
        allConnections.push({
          provider: 'graphiq',
          status: 'active',
          key_hint: null,
          last_tested_at: null,
        });
      }
    }

    return NextResponse.json({
      connections: allConnections,
      count: allConnections.length,
    });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/providers/connections' });
    console.error('[Provider Connections] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
  }
}
