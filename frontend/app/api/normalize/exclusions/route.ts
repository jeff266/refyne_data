import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { HubSpotClient } from '@/lib/hubspot/client';

interface CreateExclusionRequest {
  companyId: string;
  field?: string; // If omitted, excludes entire company
  exclusionType: 'skip_once' | 'snooze_7d' | 'snooze_30d' | 'permanent';
  reason?: string;
}

interface NormalizeExclusion {
  id: string;
  orgId: string;
  companyId: string;
  companyName?: string; // Enriched from HubSpot
  field: string | null;
  exclusionType: string;
  reason: string | null;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
}

/**
 * POST /api/normalize/exclusions
 *
 * Create a new normalization exclusion.
 */
export async function POST(request: NextRequest) {
  // Auth check
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

    const body: CreateExclusionRequest = await request.json();

    // Validate required fields
    if (!body.companyId || !body.exclusionType) {
      return NextResponse.json(
        { error: 'companyId and exclusionType are required' },
        { status: 400 }
      );
    }

    // Calculate expires_at based on exclusion type
    let expiresAt: string | null = null;
    if (body.exclusionType === 'snooze_7d') {
      const date = new Date();
      date.setDate(date.getDate() + 7);
      expiresAt = date.toISOString();
    } else if (body.exclusionType === 'snooze_30d') {
      const date = new Date();
      date.setDate(date.getDate() + 30);
      expiresAt = date.toISOString();
    }
    // skip_once and permanent have null expires_at

    // Insert exclusion
    const { data, error } = await supabase
      .from('normalize_exclusions')
      .insert({
        org_id: ctx.orgId,
        company_id: body.companyId,
        field: body.field || null,
        exclusion_type: body.exclusionType,
        reason: body.reason || null,
        created_by: ctx.userId,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/normalize/exclusions', body });
      console.error('Failed to create exclusion:', error);
      return NextResponse.json(
        { error: 'Failed to create exclusion' },
        { status: 500 }
      );
    }

    // Transform to camelCase
    const exclusion: NormalizeExclusion = {
      id: data.id,
      orgId: data.org_id,
      companyId: data.company_id,
      field: data.field,
      exclusionType: data.exclusion_type,
      reason: data.reason,
      createdBy: data.created_by,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
    };

    return NextResponse.json({ exclusion }, { status: 201 });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/normalize/exclusions' });
    console.error('Failed to create exclusion:', error);
    return NextResponse.json(
      { error: 'Failed to create exclusion' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/normalize/exclusions
 *
 * List active exclusions for the organization.
 */
export async function GET(request: NextRequest) {
  // Auth check
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

    // Fetch active exclusions (not expired)
    const { data: exclusions, error } = await supabase
      .from('normalize_exclusions')
      .select('*')
      .eq('org_id', ctx.orgId)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false });

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/normalize/exclusions' });
      console.error('Failed to fetch exclusions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch exclusions' },
        { status: 500 }
      );
    }

    // Transform to camelCase
    const transformed: NormalizeExclusion[] = (exclusions || []).map((ex) => ({
      id: ex.id,
      orgId: ex.org_id,
      companyId: ex.company_id,
      field: ex.field,
      exclusionType: ex.exclusion_type,
      reason: ex.reason,
      createdBy: ex.created_by,
      createdAt: ex.created_at,
      expiresAt: ex.expires_at,
    }));

    // Enrich with company names from HubSpot
    if (transformed.length > 0) {
      try {
        // Get HubSpot connection to get portal ID
        const { data: connection } = await supabase
          .from('hubspot_connections')
          .select('portal_id')
          .eq('org_id', ctx.orgId)
          .eq('connection_status', 'active')
          .single();

        if (connection) {
          const accessToken = await getAccessToken(ctx.orgId);
          const hubspot = new HubSpotClient(accessToken, connection.portal_id);

          const companyIds = transformed.map(ex => ex.companyId);
          const companies = await hubspot.getCompaniesByIds(companyIds, ['name']);

          // Create map of company ID -> name
          const companyNames = new Map(
            companies.map(c => [c.id, c.properties.name])
          );

          // Add company names to transformed data
          transformed.forEach(ex => {
            ex.companyName = companyNames.get(ex.companyId) || ex.companyId;
          });
        }
      } catch (error) {
        console.error('Failed to enrich with company names:', error);
        // Continue without names rather than failing
      }
    }

    return NextResponse.json({ exclusions: transformed });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/normalize/exclusions' });
    console.error('Failed to fetch exclusions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exclusions' },
      { status: 500 }
    );
  }
}
