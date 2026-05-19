import { NextRequest, NextResponse } from 'next/server';
import { getConnection, HubSpotClient } from '@/lib/hubspot';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { checkOrgRateLimit, rateLimitErrorResponse } from '@/lib/hubspot/org-rate-limiter';

/**
 * POST /api/hubspot/companies/batch-names
 *
 * Fetch company names for a batch of HubSpot company IDs.
 * Returns a map of id -> name.
 *
 * Body:
 * - ids: string[] - Array of HubSpot company IDs
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
  const rateLimitCheck = await checkOrgRateLimit(ctx.orgId, '/api/hubspot/companies/batch-names');
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
      return NextResponse.json({ companies: {} });
    }

    const orgId = ctx.orgId;

    // Get HubSpot connection
    const connection = await getConnection(orgId);
    if (!connection) {
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
    }

    const accessToken = await getAccessToken(orgId);
    const client = new HubSpotClient(accessToken, connection.portalId);

    // Fetch companies with key fields for cluster view
    const companies = await client.getCompaniesByIds(ids, [
      'name',
      'domain',
      'phone',
      'website',
      'lifecyclestage',
    ]);

    // Build id -> company data map
    const companyMap: Record<
      string,
      {
        name: string;
        domain?: string;
        phone?: string;
        website?: string;
        lifecyclestage?: string;
      }
    > = {};
    for (const company of companies) {
      companyMap[company.id] = {
        name: company.properties.name || company.id,
        domain: company.properties.domain,
        phone: company.properties.phone,
        website: company.properties.website,
        lifecyclestage: company.properties.lifecyclestage,
      };
    }

    return NextResponse.json({ companies: companyMap });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/hubspot/companies/batch-names' });
    console.error('[batch-names] Failed to fetch company names:', error);

    if (error instanceof Error && error.message.includes('401')) {
      return NextResponse.json(
        { error: 'HubSpot token expired or invalid. Please reconnect.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch company names from HubSpot' },
      { status: 500 }
    );
  }
}
