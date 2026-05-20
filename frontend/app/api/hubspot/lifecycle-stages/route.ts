/**
 * HubSpot Lifecycle Stages API
 *
 * GET /api/hubspot/lifecycle-stages
 *
 * Fetches lifecycle stage enum values from HubSpot properties API
 * with company counts per stage.
 */

import { NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

export async function GET() {
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
    if (!accessToken) {
      return NextResponse.json(
        { error: 'HubSpot not connected' },
        { status: 400 }
      );
    }

    // Fetch lifecycle stage property definition from HubSpot
    const propRes = await fetch(
      'https://api.hubapi.com/crm/v3/properties/companies/lifecyclestage',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!propRes.ok) {
      throw new Error(`HubSpot API error: ${propRes.status}`);
    }

    const propData = await propRes.json();
    const options = propData.options || [];

    // Get counts per stage by fetching all companies
    const countsRes = await fetch(
      'https://api.hubapi.com/crm/v3/objects/companies?limit=100&properties=lifecyclestage',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!countsRes.ok) {
      throw new Error(`HubSpot API error: ${countsRes.status}`);
    }

    const countsData = await countsRes.json();
    const companies = countsData.results || [];

    // Count companies per stage
    const stageCounts = new Map<string, number>();
    companies.forEach((company: any) => {
      const stage = company.properties.lifecyclestage;
      if (stage) {
        stageCounts.set(stage, (stageCounts.get(stage) || 0) + 1);
      }
    });

    // Build response with counts
    const stages = options.map((opt: any) => ({
      value: opt.value,
      label: opt.label,
      count: stageCounts.get(opt.value) || 0,
    }));

    // Add "All" option with total count
    stages.unshift({
      value: '',
      label: 'All',
      count: companies.length,
    });

    return NextResponse.json({ stages });
  } catch (error) {
    console.error('[Lifecycle Stages] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch lifecycle stages',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
