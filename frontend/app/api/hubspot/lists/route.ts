/**
 * HubSpot Lists API
 *
 * GET /api/hubspot/lists
 *
 * Fetches static company lists from HubSpot for list selection dropdown.
 * Returns list name and member count.
 */

import { NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

export async function GET() {
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

    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', ctx.orgId)
      .single();

    if (!connection) {
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
    }

    const cacheKey = `${ctx.orgId}:${connection.portal_id}:hubspot:lists`;
    const { data: cached } = await supabase
      .from('cache')
      .select('value, expires_at')
      .eq('key', cacheKey)
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return NextResponse.json(cached.value);
    }

    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
    }

    const listsRes = await fetch('https://api.hubapi.com/contacts/v1/lists/static', {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });

    if (!listsRes.ok) {
      if (listsRes.status === 403) {
        return NextResponse.json({ lists: [], insufficientPermissions: true });
      }
      throw new Error(`HubSpot API error: ${listsRes.status}`);
    }

    const listsData = await listsRes.json();
    const lists = (listsData.lists || [])
      .filter((list: any) => list.listType === 'STATIC')
      .map((list: any) => ({
        id: list.listId.toString(),
        name: list.name,
        memberCount: list.metaData?.size || 0,
      }))
      .sort((a: any, b: any) => b.memberCount - a.memberCount);

    const result = { lists, insufficientPermissions: false };
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await supabase.from('cache').upsert({ key: cacheKey, value: result, expires_at: expiresAt });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[HubSpot Lists] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch lists' }, { status: 500 });
  }
}
