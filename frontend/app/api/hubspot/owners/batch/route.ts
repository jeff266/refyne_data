import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { supabaseAdmin } from '@/lib/db/admin-client';

/**
 * POST /api/hubspot/owners/batch
 *
 * Fetch owner details (name, email) for multiple owner IDs.
 * Uses 24-hour cache to reduce HubSpot API calls.
 *
 * Body: { ownerIds: string[] }
 * Returns: { owners: Record<string, { name: string; email: string }> }
 */
export async function POST(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { ownerIds } = body;

    if (!Array.isArray(ownerIds) || ownerIds.length === 0) {
      return NextResponse.json({ error: 'ownerIds array required' }, { status: 400 });
    }

    // Get portal_id from hubspot_connections
    const { data: connection } = await supabaseAdmin
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', ctx.orgId)
      .single();

    if (!connection?.portal_id) {
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
    }

    const portalId = connection.portal_id;
    const ownerMap: Record<string, { name: string; email: string }> = {};
    const cacheMisses: string[] = [];

    // Step 1: Check cache for all owner IDs
    const { data: cachedOwners } = await supabaseAdmin
      .from('hubspot_owners_cache')
      .select('owner_id, first_name, last_name, email')
      .eq('org_id', ctx.orgId)
      .in('owner_id', ownerIds)
      .gte('cached_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // 24 hours

    // Build map from cached data
    const cachedMap = new Map<string, any>();
    if (cachedOwners) {
      for (const cached of cachedOwners) {
        cachedMap.set(cached.owner_id, cached);
        ownerMap[cached.owner_id] = {
          name: `${cached.first_name || ''} ${cached.last_name || ''}`.trim() || 'Unknown',
          email: cached.email || '',
        };
      }
    }

    // Step 2: Identify cache misses
    for (const ownerId of ownerIds) {
      if (!cachedMap.has(ownerId)) {
        cacheMisses.push(ownerId);
      }
    }

    // Step 3: Fetch cache misses from HubSpot
    if (cacheMisses.length > 0) {
      const accessToken = await getAccessToken(ctx.orgId);
      if (!accessToken) {
        // If no token but we have some cached data, return what we have
        if (Object.keys(ownerMap).length > 0) {
          console.warn('[HubSpot Owners] No access token, returning cached data only');
        } else {
          return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
        }
      } else {
        // Fetch individual owners from HubSpot API
        const fetchPromises = cacheMisses.map(async (ownerId) => {
          try {
            const response = await fetch(`https://api.hubapi.com/crm/v3/owners/${ownerId}`, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            });

            if (!response.ok) {
              console.error(`[HubSpot Owners] Failed to fetch owner ${ownerId}: ${response.status}`);
              return null;
            }

            const owner = await response.json();

            // Upsert to cache
            await supabaseAdmin
              .from('hubspot_owners_cache')
              .upsert(
                {
                  org_id: ctx.orgId,
                  portal_id: portalId,
                  owner_id: String(owner.id),
                  first_name: owner.firstName || null,
                  last_name: owner.lastName || null,
                  email: owner.email || null,
                  is_active: owner.archived !== true,
                  cached_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                {
                  onConflict: 'org_id,portal_id,owner_id',
                }
              );

            return {
              ownerId: String(owner.id),
              name: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'Unknown',
              email: owner.email || '',
            };
          } catch (error) {
            console.error(`[HubSpot Owners] Error fetching owner ${ownerId}:`, error);
            return null;
          }
        });

        const fetchedOwners = await Promise.all(fetchPromises);

        // Add fetched owners to map
        for (const fetched of fetchedOwners) {
          if (fetched) {
            ownerMap[fetched.ownerId] = {
              name: fetched.name,
              email: fetched.email,
            };
          }
        }
      }
    }

    // Step 4: Fill in any missing owners with placeholder data
    for (const ownerId of ownerIds) {
      if (!ownerMap[ownerId]) {
        ownerMap[ownerId] = {
          name: `Owner ${ownerId}`,
          email: '',
        };
      }
    }

    return NextResponse.json({ owners: ownerMap });
  } catch (error) {
    console.error('[HubSpot Owners Batch] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
