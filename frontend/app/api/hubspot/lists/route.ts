import { NextRequest, NextResponse } from 'next/server';
import { getConnection, HubSpotClient } from '@/lib/hubspot';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * GET /api/hubspot/lists
 *
 * Get company lists from the connected HubSpot portal.
 */
export async function GET(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  try {
    const orgId = ctx.orgId;

    const connection = await getConnection(orgId);

    if (!connection) {
      return NextResponse.json(
        { error: 'HubSpot not connected' },
        { status: 400 }
      );
    }

    // TODO: Decrypt the token
    const accessToken = connection.encryptedToken;

    const client = new HubSpotClient(accessToken, connection.portalId);
    const lists = await client.getCompanyLists();

    return NextResponse.json({
      portalId: connection.portalId,
      lists,
      total: lists.length,
    });
  } catch (error) {
    console.error('Failed to get HubSpot lists:', error);

    // Check if it's an auth error
    if (error instanceof Error && error.message.includes('401')) {
      return NextResponse.json(
        { error: 'HubSpot token expired or invalid. Please reconnect.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch lists from HubSpot' },
      { status: 500 }
    );
  }
}
