import { NextRequest, NextResponse } from 'next/server';
import {
  getConnection,
  getFieldMappings,
  HubSpotClient,
  hubspotToRawRecords,
  getMappingSummary,
  getPropertiesToFetch,
} from '@/lib/hubspot';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * GET /api/hubspot/companies
 *
 * Get all company records from the connected HubSpot portal.
 * Returns records mapped to canonical format for the normalization pipeline.
 *
 * Query params:
 * - limit: Max records to return (default: 100)
 * - preview: If true, only return first page with summary
 */
export async function GET(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : 100;
    const preview = searchParams.get('preview') === 'true';

    const orgId = ctx.orgId;

    const connection = await getConnection(orgId);

    if (!connection) {
      return NextResponse.json(
        { error: 'HubSpot not connected' },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken(orgId);

    const client = new HubSpotClient(accessToken, connection.portalId);

    // Get field mappings for this org
    const fieldMappings = await getFieldMappings(orgId);
    const propertiesToFetch = getPropertiesToFetch(fieldMappings);

    // Fetch companies from the portal
    const allCompanies: Awaited<ReturnType<typeof client.getCompaniesByIds>> = [];

    for await (const batch of client.getAllCompanies(propertiesToFetch)) {
      allCompanies.push(...batch);

      // Check limits
      if (preview && allCompanies.length >= 10) {
        break;
      }
      if (allCompanies.length >= limit) {
        break;
      }
    }

    // Apply limit
    const companies = allCompanies.slice(0, limit);

    // Map to RawRecords
    const records = hubspotToRawRecords(companies, fieldMappings);

    // Get mapping summary
    const summary = getMappingSummary(companies, fieldMappings);

    return NextResponse.json({
      portalId: connection.portalId,
      records,
      count: records.length,
      totalFetched: allCompanies.length,
      mappingSummary: {
        mappedFields: summary.mappedFields,
        unmappedHubSpotProperties: summary.unmappedHubSpotProperties,
      },
      preview,
    });
  } catch (error) {
    console.error('Failed to get companies:', error);

    if (error instanceof Error && error.message.includes('401')) {
      return NextResponse.json(
        { error: 'HubSpot token expired or invalid. Please reconnect.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch companies from HubSpot' },
      { status: 500 }
    );
  }
}
