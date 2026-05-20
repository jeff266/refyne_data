/**
 * Enrich Gap Analysis API
 *
 * GET /api/enrich/gaps
 *
 * Analyzes HubSpot company records to identify missing field values.
 * Cached for 1 hour per org.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getSupabaseClient } from '@/lib/db/client';

// Fields to analyze for gaps
const ENRICHABLE_FIELDS = [
  'industry',
  'numberofemployees',
  'linkedin_company_page',
  'phone',
  'domain',
  'annualrevenue',
];

export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const supabase = getSupabaseClient();

    // Get HubSpot connection first (need portal_id for cache key)
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('access_token, portal_id')
      .eq('org_id', ctx.orgId)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'HubSpot not connected' },
        { status: 400 }
      );
    }

    // Check cache with portal_id included
    const cacheKey = `${ctx.orgId}:${connection.portal_id}:enrich:gaps`;
    const { data: cached } = await supabase
      .from('cache')
      .select('value, expires_at')
      .eq('key', cacheKey)
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return NextResponse.json(cached.value);
    }

    // Fetch ALL companies from HubSpot with pagination
    const properties = ENRICHABLE_FIELDS.join(',');
    const allCompanies: any[] = [];
    let after: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const url = after
        ? `https://api.hubapi.com/crm/v3/objects/companies?limit=100&properties=${properties}&after=${after}`
        : `https://api.hubapi.com/crm/v3/objects/companies?limit=100&properties=${properties}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HubSpot API error: ${response.status}`);
      }

      const data = await response.json();
      allCompanies.push(...(data.results || []));

      // Check for next page
      if (data.paging?.next?.after) {
        after = data.paging.next.after;
      } else {
        hasMore = false;
      }
    }

    const totalCompanies = allCompanies.length;

    // Count missing values per field across ALL companies
    const fieldGaps = ENRICHABLE_FIELDS.map(field => {
      const missing = allCompanies.filter((company: any) => {
        const value = company.properties[field];
        return !value || value === '' || value === 'null';
      }).length;

      const coverage = totalCompanies > 0
        ? Math.round(((totalCompanies - missing) / totalCompanies) * 100)
        : 0;

      return {
        field,
        missing,
        coverage,
      };
    });

    const result = {
      total_companies: totalCompanies,
      field_gaps: fieldGaps,
      scanned_at: new Date().toISOString(),
    };

    // Cache for 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await supabase
      .from('cache')
      .upsert({
        key: cacheKey,
        value: result,
        expires_at: expiresAt,
      });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Gap analysis error:', error);

    return NextResponse.json(
      {
        error: 'Failed to analyze gaps',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
