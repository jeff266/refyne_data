import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getAccessToken } from '@/lib/hubspot/get-access-token';

/**
 * POST /api/hubspot/owners/batch
 *
 * Fetch owner details (name, email) for multiple owner IDs from HubSpot.
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

    // Get HubSpot access token
    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
    }

    // Fetch all owners from HubSpot (cached per request)
    const response = await fetch(`https://api.hubapi.com/crm/v3/owners?limit=500`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[HubSpot Owners] API error: ${response.status}`);
      return NextResponse.json({ error: 'Failed to fetch owners' }, { status: 500 });
    }

    const data = await response.json();
    const allOwners = data.results || [];

    // Build mapping of owner ID -> { name, email }
    const ownerMap: Record<string, { name: string; email: string }> = {};

    for (const owner of allOwners) {
      const ownerId = String(owner.id);
      if (ownerIds.includes(ownerId)) {
        ownerMap[ownerId] = {
          name: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'Unknown',
          email: owner.email || '',
        };
      }
    }

    // Fill in any missing owners with placeholder data
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
