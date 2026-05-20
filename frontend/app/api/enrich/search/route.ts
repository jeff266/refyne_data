/**
 * Enrich Search API
 *
 * POST /api/enrich/search
 *
 * Fetch companies from HubSpot based on filters, then enrich with provider data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

interface EnrichFilters {
  industries: string[];
  employeeMin: number;
  employeeMax: number;
  locations: string[];
  keywords: string;
}

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const filters: EnrichFilters = body.filters || {};
    const providers: string[] = body.providers || [];

    if (providers.length === 0) {
      return NextResponse.json(
        { error: 'At least one provider is required' },
        { status: 400 }
      );
    }

    // TODO: Implement the enrich workflow:
    // 1. Fetch companies from HubSpot matching filters (using HubSpot search API)
    // 2. For each company, call selected enrichment providers
    // 3. Calculate enrichment match score
    // 4. Return enriched results

    // Placeholder response
    const results = [
      {
        hubspot_company_id: '123',
        name: 'Sample Healthcare Co',
        domain: 'samplehealthcare.com',
        employee_count: 150,
        industry: 'Healthcare',
        city: 'Boston',
        state: 'Massachusetts',
        country: 'United States',
        enrichment_score: 85,
        selected: false,
      },
    ];

    return NextResponse.json({
      success: true,
      results,
      total: results.length,
    });
  } catch (error) {
    console.error('Enrich search error:', error);

    return NextResponse.json(
      {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
