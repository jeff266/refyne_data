/**
 * Prospect Search API
 *
 * POST /api/prospect/search
 *
 * Search for prospect companies across multiple enrichment providers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { searchProspects } from '@/lib/prospect/search';
import { ProspectSearchQuery, ICPConfig } from '@/lib/prospect/types';

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {

    const body = await req.json();
    const query: ProspectSearchQuery = body.query || {};
    const icpConfig: ICPConfig | undefined = body.icp_config;

    // Validate query
    if (
      !query.industries &&
      !query.keywords &&
      !query.location &&
      !query.employeeMin &&
      !query.revenueMin
    ) {
      return NextResponse.json(
        { error: 'At least one search filter is required' },
        { status: 400 }
      );
    }

    // Perform search
    const searchResults = await searchProspects(ctx.orgId, query, icpConfig);

    return NextResponse.json({
      success: true,
      data: searchResults,
    });
  } catch (error) {
    console.error('Prospect search error:', error);

    return NextResponse.json(
      {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
