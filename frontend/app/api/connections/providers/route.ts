import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';

/**
 * GET /api/connections/providers
 * List all provider connections for the org (sanitized)
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { data: connections, error } = await supabase
    .from('provider_connections')
    .select('provider, status, key_hint, last_tested_at, last_error')
    .eq('org_id', ctx.orgId)
    .eq('status', 'active'); // Only return active connections

  if (error) {
    console.error('Failed to fetch provider connections:', error);
    return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
  }

  // Format response (never return api_key_enc)
  const sanitized = (connections || []).map((conn) => ({
    provider: conn.provider,
    status: conn.status,
    hint: conn.key_hint,
    last_tested_at: conn.last_tested_at,
    last_error: conn.last_error,
  }));

  return NextResponse.json({ connections: sanitized });
}
