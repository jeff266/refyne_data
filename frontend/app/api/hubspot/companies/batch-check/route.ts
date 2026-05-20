/**
 * HubSpot Companies Batch Check
 *
 * POST /api/hubspot/companies/batch-check
 *
 * Check if companies exist in HubSpot by domain.
 * Used by Prospect page to show CRM status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { getConnection } from '@/lib/hubspot/repository';

/**
 * Batch check if companies exist in HubSpot.
 *
 * Uses HubSpot's CRM Search API to check domains in batches.
 */
export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {

    const body = await req.json();
    const domains: string[] = body.domains || [];

    if (!Array.isArray(domains) || domains.length === 0) {
      return NextResponse.json(
        { error: 'domains array is required' },
        { status: 400 }
      );
    }

    if (domains.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 domains per request' },
        { status: 400 }
      );
    }

    // Get HubSpot credentials
    const accessToken = await getAccessToken(ctx.orgId);
    const connection = await getConnection(ctx.orgId);

    if (!accessToken || !connection) {
      return NextResponse.json(
        { error: 'HubSpot not connected' },
        { status: 400 }
      );
    }

    const portalId = connection.portalId;

    // Search for companies by domain
    const results = await Promise.all(
      domains.map(async (domain) => {
        try {
          const searchResponse = await fetch(
            'https://api.hubapi.com/crm/v3/objects/companies/search',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                filterGroups: [
                  {
                    filters: [
                      {
                        propertyName: 'domain',
                        operator: 'EQ',
                        value: domain,
                      },
                    ],
                  },
                ],
                properties: ['name', 'domain'],
                limit: 1,
              }),
            }
          );

          if (!searchResponse.ok) {
            console.error(
              `HubSpot search failed for ${domain}:`,
              searchResponse.statusText
            );
            return {
              domain,
              exists: false,
              error: searchResponse.statusText,
            };
          }

          const searchData = await searchResponse.json();
          const company = searchData.results?.[0];

          if (company) {
            return {
              domain,
              exists: true,
              company_id: company.id,
              hubspot_url: `https://app.hubspot.com/contacts/${portalId}/company/${company.id}`,
              name: company.properties?.name,
            };
          }

          return {
            domain,
            exists: false,
          };
        } catch (error) {
          console.error(`Error checking domain ${domain}:`, error);
          return {
            domain,
            exists: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Batch check error:', error);

    return NextResponse.json(
      {
        error: 'Batch check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
