/**
 * HubSpot Owners API
 *
 * GET /api/hubspot/owners
 *
 * Fetches HubSpot owners (users) for assignment filters.
 * Cached for 1 hour.
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

    // Get portal_id for cache key
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', ctx.orgId)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'HubSpot not connected' },
        { status: 400 }
      );
    }

    // Check cache
    const cacheKey = `${ctx.orgId}:${connection.portal_id}:hubspot:owners`;
    const { data: cached } = await supabase
      .from('cache')
      .select('value, expires_at')
      .eq('key', cacheKey)
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return NextResponse.json(cached.value);
    }

    // Get valid access token
    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'HubSpot not connected' },
        { status: 400 }
      );
    }

    // Fetch owners from HubSpot
    const ownersRes = await fetch(
      'https://api.hubapi.com/crm/v3/owners',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!ownersRes.ok) {
      // If 403, return empty list (insufficient permissions)
      if (ownersRes.status === 403) {
        console.warn('[HubSpot Owners] Insufficient permissions to fetch owners');
        return NextResponse.json({
          owners: [{ id: '', name: 'All owners', email: null }],
        });
      }
      throw new Error(`HubSpot API error: ${ownersRes.status}`);
    }

    const ownersData = await ownersRes.json();
    const owners = (ownersData.results || []).map((owner: any) => ({
      id: owner.id,
      name: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email,
      email: owner.email,
    }));

    // Add "Unassigned" option
    owners.unshift({
      id: '',
      name: 'Unassigned',
      email: null,
    });

    const result = { owners };

    // Cache for 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await supabase
      .from('cache')
      .upsert({
        key: cacheKey,
        value: result,
        expires_at: expiresAt,
      });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[HubSpot Owners] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch owners',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
