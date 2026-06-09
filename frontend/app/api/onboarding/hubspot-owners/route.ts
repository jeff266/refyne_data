import { NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { currentUser } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

interface HubSpotOwner {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * GET /api/onboarding/hubspot-owners
 *
 * Fetch HubSpot owners to suggest as team invites.
 * Filters out the current user.
 *
 * Auth: All authenticated users
 */
export async function GET() {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    // Get current user's email to filter out
    const user = await currentUser();
    const currentUserEmail = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase();

    // Get HubSpot access token
    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
    }

    // Fetch owners from HubSpot
    const response = await fetch('https://api.hubapi.com/crm/v3/owners?limit=100', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[HubSpot Owners] Failed to fetch:', await response.text());
      return NextResponse.json({ error: 'Failed to fetch HubSpot owners' }, { status: 500 });
    }

    const data = await response.json();
    const owners: HubSpotOwner[] = data.results || [];

    // Filter out current user and format
    const suggestions = owners
      .filter((owner) => {
        if (!owner.email) return false;
        if (currentUserEmail && owner.email.toLowerCase() === currentUserEmail) return false;
        return true;
      })
      .map((owner) => ({
        id: owner.id,
        email: owner.email,
        name: [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.email,
      }));

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('[HubSpot Owners] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
