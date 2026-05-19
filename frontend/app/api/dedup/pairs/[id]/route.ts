import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { rowToPair, type DedupPairRow } from '@/lib/dedup/types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getAccessToken } from '@/lib/hubspot/get-access-token';

/**
 * GET /api/dedup/pairs/:id
 *
 * Returns a single pair with full company details from HubSpot.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Add auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  // Feature gate: dedup
  try {
    await requireFeature(ctx.orgId, 'dedup');
  } catch (error) {
    const gateError = parseFeatureGateError(error);
    if (gateError) {
      return NextResponse.json(
        { error: 'feature_gated', feature: gateError.feature, currentPlan: gateError.currentPlan },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { id } = params;
    const orgId = ctx.orgId;

    // Get pair
    const { data: pair, error: pairError } = await supabase
      .from('dedup_pairs')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (pairError || !pair) {
      return NextResponse.json(
        { error: 'Pair not found' },
        { status: 404 }
      );
    }

    const pairData = rowToPair(pair as DedupPairRow);

    // Fetch full company details from HubSpot
    let recordA = null;
    let recordB = null;

    try {
      const accessToken = await getAccessToken(orgId);

      // Properties to fetch for review
      const properties = [
        'name',
        'domain',
        'phone',
        'industry',
        'city',
        'state',
        'hubspot_owner_id',
        'createdate',
        'hs_lastmodifieddate',
        'num_associated_contacts',
        'num_associated_deals',
      ];

      // Fetch both companies in parallel
      const [resA, resB] = await Promise.all([
        fetch(`https://api.hubapi.com/crm/v3/objects/companies/${pairData.recordAId}?properties=${properties.join(',')}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`https://api.hubapi.com/crm/v3/objects/companies/${pairData.recordBId}?properties=${properties.join(',')}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      if (resA.ok) {
        const dataA = await resA.json();
        recordA = {
          id: dataA.id,
          properties: dataA.properties,
        };
      }

      if (resB.ok) {
        const dataB = await resB.json();
        recordB = {
          id: dataB.id,
          properties: dataB.properties,
        };
      }
    } catch (error) {
      console.error('[GET /api/dedup/pairs/[id]] Failed to fetch HubSpot data:', error);
      // Continue without HubSpot data - UI can handle null values
    }

    return NextResponse.json({
      pair: pairData,
      recordA,
      recordB,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/dedup/pairs/[id]' });
    console.error('Failed to get dedup pair:', error);
    return NextResponse.json(
      { error: 'Failed to get pair' },
      { status: 500 }
    );
  }
}
