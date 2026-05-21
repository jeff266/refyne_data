/**
 * Company Preview API for Enrich Loading State
 *
 * GET /api/enrich/company-preview
 *
 * Returns 20 random companies with their gap counts for the animated loading experience.
 * Cached for 10 minutes per org.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getAccessToken } from '@/lib/hubspot/get-access-token';

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
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Get valid access token
    const accessToken = await getAccessToken(ctx.orgId);

    // Get portal_id for cache key
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', ctx.orgId)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'HubSpot not connected' },
        { status: 400 }
      );
    }

    // Check cache (10 minute TTL)
    const cacheKey = `${ctx.orgId}:${connection.portal_id}:enrich:preview`;
    const { data: cached } = await supabase
      .from('cache')
      .select('value, expires_at')
      .eq('key', cacheKey)
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return NextResponse.json(cached.value);
    }

    // Fetch 20 random companies from HubSpot
    const properties = ['name', ...ENRICHABLE_FIELDS].join(',');
    const url = `https://api.hubapi.com/crm/v3/objects/companies?limit=20&properties=${properties}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.status}`);
    }

    const data = await response.json();
    const companies = (data.results || []).map((company: any) => {
      const name = company.properties.name || 'Unnamed Company';
      const initials = name
        .split(' ')
        .map((word: string) => word[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();

      // Count how many enrichable fields are missing
      const gapCount = ENRICHABLE_FIELDS.filter((field) => {
        const value = company.properties[field];
        return !value || value === '' || value === 'null';
      }).length;

      return {
        name,
        initials,
        gap_count: gapCount,
      };
    });

    const result = { companies };

    // Cache for 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase
      .from('cache')
      .upsert({
        key: cacheKey,
        value: result,
        expires_at: expiresAt,
      });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Company preview error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch company preview',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
