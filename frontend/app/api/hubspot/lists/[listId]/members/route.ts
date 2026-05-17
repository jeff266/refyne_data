import { NextRequest, NextResponse } from 'next/server';
import {
  getConnection,
  getFieldMappings,
  HubSpotClient,
  hubspotToRawRecords,
  getMappingSummary,
  getPropertiesToFetch,
} from '@/lib/hubspot';

interface RouteParams {
  params: Promise<{
    listId: string;
  }>;
}

/**
 * GET /api/hubspot/lists/[listId]/members
 *
 * Get company records from a HubSpot list.
 * Returns records mapped to canonical format for the normalization pipeline.
 *
 * Query params:
 * - limit: Max records to return (default: all)
 * - preview: If true, only return first page with summary
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { listId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
    const preview = searchParams.get('preview') === 'true';

    // TODO: Get org ID from auth context
    const orgId = request.headers.get('x-org-id') || 'default';

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

    // Get field mappings for this org
    const fieldMappings = await getFieldMappings(orgId);
    const propertiesToFetch = getPropertiesToFetch(fieldMappings);

    // Fetch companies from the list
    const allCompanies: Awaited<ReturnType<typeof client.getCompaniesByIds>> = [];

    for await (const batch of client.getListMembers(listId, propertiesToFetch)) {
      allCompanies.push(...batch);

      // Check limits
      if (preview && allCompanies.length >= 10) {
        break;
      }
      if (limit && allCompanies.length >= limit) {
        break;
      }
    }

    // Apply limit if specified
    const companies = limit ? allCompanies.slice(0, limit) : allCompanies;

    // Map to RawRecords
    const records = hubspotToRawRecords(companies, fieldMappings);

    // Get mapping summary
    const summary = getMappingSummary(companies, fieldMappings);

    return NextResponse.json({
      portalId: connection.portalId,
      listId,
      records,
      count: records.length,
      totalAvailable: allCompanies.length,
      mappingSummary: {
        mappedFields: summary.mappedFields,
        unmappedHubSpotProperties: summary.unmappedHubSpotProperties,
      },
      preview,
    });
  } catch (error) {
    console.error('Failed to get list members:', error);

    if (error instanceof Error && error.message.includes('401')) {
      return NextResponse.json(
        { error: 'HubSpot token expired or invalid. Please reconnect.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch list members from HubSpot' },
      { status: 500 }
    );
  }
}
