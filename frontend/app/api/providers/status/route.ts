/**
 * Provider Status API
 *
 * GET /api/providers/status
 *
 * Returns connection status for all enrichment providers.
 */

import { NextRequest } from 'next/server';
import { getOrgContext } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';

export async function GET(req: NextRequest) {
  const ctx = await getOrgContext();

  if (!supabase) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    // Check Apollo connection
    const { data: apolloConn } = await supabase
      .from('provider_connections')
      .select('status')
      .eq('org_id', ctx.orgId)
      .eq('provider', 'apollo')
      .single();

    // Refyne Data is always "managed" (no API key required - uses env var)
    const apolloStatus = apolloConn?.status === 'active' ? 'connected' : 'not_connected';
    const refyneStatus = 'managed'; // Always available

    return Response.json({
      apollo: apolloStatus,
      refyne: refyneStatus,
    });
  } catch (error) {
    console.error('[Provider Status] Error:', error);
    return Response.json({ error: 'Failed to fetch provider status' }, { status: 500 });
  }
}
