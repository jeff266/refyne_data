import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * GET /api/hubspot/properties/companies
 *
 * Fetch company property definitions from HubSpot.
 * Used to get enum field labels for display.
 */
export async function GET(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    // Get access token
    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
    }

    // Fetch property definitions from HubSpot
    const response = await fetch('https://api.hubapi.com/crm/v3/properties/companies', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      properties: data.results || [],
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, {
      route: '/api/hubspot/properties/companies',
    });
    console.error('[properties/companies] Error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch properties' },
      { status: 500 }
    );
  }
}
