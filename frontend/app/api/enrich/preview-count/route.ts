/**
 * Enrich Preview Count API
 *
 * POST /api/enrich/preview-count
 *
 * Returns count of companies matching the filter criteria,
 * plus sample company names for confidence check.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

interface PreviewCountRequest {
  source: 'all' | 'list' | 'segment';
  list_id?: string;
  segment?: {
    lifecycle_stage?: string;
    owner_id?: string;
    industries?: string[];
  };
  fields: string[];
}

export async function POST(req: NextRequest) {
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

    const body: PreviewCountRequest = await req.json();
    const { source, list_id, segment, fields } = body;

    // Get valid access token
    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'HubSpot not connected' },
        { status: 400 }
      );
    }

    // Build filter query based on source type
    let filterGroups: any[] = [];

    if (source === 'segment' && segment) {
      // Add lifecycle stage filter
      if (segment.lifecycle_stage) {
        filterGroups.push({
          filters: [
            {
              propertyName: 'lifecyclestage',
              operator: 'EQ',
              value: segment.lifecycle_stage,
            },
          ],
        });
      }

      // Add owner filter
      if (segment.owner_id) {
        filterGroups.push({
          filters: [
            {
              propertyName: 'hubspot_owner_id',
              operator: segment.owner_id === '' ? 'NOT_HAS_PROPERTY' : 'EQ',
              value: segment.owner_id === '' ? undefined : segment.owner_id,
            },
          ],
        });
      }

      // Add industry filter
      if (segment.industries && segment.industries.length > 0) {
        filterGroups.push({
          filters: segment.industries.map((industry) => ({
            propertyName: 'industry',
            operator: 'EQ',
            value: industry,
          })),
        });
      }
    }

    // Add missing fields filter (only count companies missing at least one selected field)
    if (fields.length > 0) {
      const missingFieldFilters = fields.map((field) => ({
        propertyName: field,
        operator: 'NOT_HAS_PROPERTY',
      }));

      filterGroups.push({
        filters: missingFieldFilters,
      });
    }

    // Use HubSpot search API to count matching companies
    const searchPayload: any = {
      filterGroups,
      properties: ['name', 'domain'],
      limit: 10, // Just need sample names
    };

    const searchRes = await fetch(
      'https://api.hubapi.com/crm/v3/objects/companies/search',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchPayload),
      }
    );

    if (!searchRes.ok) {
      const errorText = await searchRes.text();
      throw new Error(`HubSpot search API error: ${searchRes.status} - ${errorText}`);
    }

    const searchData = await searchRes.json();
    const total = searchData.total || 0;
    const results = searchData.results || [];

    // Extract sample company names (first 5)
    const sampleNames = results
      .slice(0, 5)
      .map((company: any) => company.properties.name || company.properties.domain || 'Unnamed')
      .filter(Boolean);

    return NextResponse.json({
      count: total,
      sample_names: sampleNames,
    });
  } catch (error) {
    console.error('[Preview Count] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get preview count',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
