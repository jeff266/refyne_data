import { NextRequest, NextResponse } from 'next/server';
import { getConnection, HubSpotClient } from '@/lib/hubspot';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { checkOrgRateLimit, rateLimitErrorResponse } from '@/lib/hubspot/org-rate-limiter';

/**
 * POST /api/hubspot/contacts/batch-names
 *
 * Fetch contact data for a batch of HubSpot contact IDs.
 * Returns a map of id -> contact data.
 *
 * Body:
 * - ids: string[] - Array of HubSpot contact IDs
 */
export async function POST(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Check org rate limit
  const rateLimitCheck = await checkOrgRateLimit(ctx.orgId, '/api/hubspot/contacts/batch-names');
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      rateLimitErrorResponse(rateLimitCheck.resetAt!, rateLimitCheck.remaining!),
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids)) {
      return NextResponse.json({ error: 'ids must be an array' }, { status: 400 });
    }

    if (ids.length === 0) {
      return NextResponse.json({ contacts: {} });
    }

    const orgId = ctx.orgId;

    // Get HubSpot connection
    const connection = await getConnection(orgId);
    if (!connection) {
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
    }

    const accessToken = await getAccessToken(orgId);
    const client = new HubSpotClient(accessToken, connection.portalId);

    // Fetch contacts with key fields for cluster view
    const contacts = await client.getContactsByIds(ids, [
      'firstname',
      'lastname',
      'email',
      'phone',
      'company',
      'lifecyclestage',
    ]);

    // Build id -> contact data map
    const contactMap: Record<
      string,
      {
        firstname?: string;
        lastname?: string;
        email?: string;
        phone?: string;
        company?: string;
        lifecyclestage?: string;
      }
    > = {};
    for (const contact of contacts) {
      contactMap[contact.id] = {
        firstname: contact.properties.firstname ?? undefined,
        lastname: contact.properties.lastname ?? undefined,
        email: contact.properties.email ?? undefined,
        phone: contact.properties.phone ?? undefined,
        company: contact.properties.company ?? undefined,
        lifecyclestage: contact.properties.lifecyclestage ?? undefined,
      };
    }

    return NextResponse.json({ contacts: contactMap });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/hubspot/contacts/batch-names' });
    console.error('[batch-names] Failed to fetch contact data:', error);

    if (error instanceof Error && error.message.includes('401')) {
      return NextResponse.json(
        { error: 'HubSpot token expired or invalid. Please reconnect.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch contact data from HubSpot' },
      { status: 500 }
    );
  }
}
