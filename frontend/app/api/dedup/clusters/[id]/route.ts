import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { rowToCluster, type DedupClusterRow } from '@/lib/dedup/cluster-types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { selectMaster, type HubSpotCompany } from '@/lib/dedup/select-master';

/**
 * GET /api/dedup/clusters/:id
 *
 * Returns a cluster with full HubSpot details for all records.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

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
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { id } = params;
    const orgId = ctx.orgId;

    // Get cluster
    const { data: cluster, error: clusterError } = await supabase
      .from('dedup_clusters')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (clusterError || !cluster) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
    }

    const clusterData = rowToCluster(cluster as DedupClusterRow);

    // Fetch full company details from HubSpot
    const records: HubSpotCompany[] = [];

    try {
      const accessToken = await getAccessToken(orgId);

      if (!accessToken) {
        return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
      }

      // Properties to fetch for review
      const properties = [
        'name',
        'domain',
        'phone',
        'industry',
        'city',
        'state',
        'country',
        'address',
        'linkedin_company_page',
        'hubspot_owner_id',
        'createdate',
        'hs_lastmodifieddate',
        'num_associated_contacts',
        'num_associated_deals',
        'lifecyclestage',
        'type',
      ];

      // Fetch all companies in parallel (batches of 100 per HubSpot API limit)
      const recordIds = clusterData.recordIds;
      const batchSize = 100;

      for (let i = 0; i < recordIds.length; i += batchSize) {
        const batch = recordIds.slice(i, i + batchSize);

        const responses = await Promise.all(
          batch.map((recordId) =>
            fetch(
              `https://api.hubapi.com/crm/v3/objects/companies/${recordId}?properties=${properties.join(
                ','
              )}`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            )
          )
        );

        for (const res of responses) {
          if (res.ok) {
            const data = await res.json();
            records.push({
              id: data.id,
              properties: data.properties,
            });
          }
        }
      }
    } catch (error) {
      console.error('[GET /api/dedup/clusters/[id]] Failed to fetch HubSpot data:', error);
      return NextResponse.json({ error: 'Failed to fetch company data' }, { status: 500 });
    }

    // Select suggested master
    let suggestedMasterId = records.length > 0 ? records[0].id : clusterData.recordIds[0];
    try {
      suggestedMasterId = selectMaster(records);
    } catch (error) {
      console.error('[GET /api/dedup/clusters/[id]] Failed to select master:', error);
    }

    return NextResponse.json({
      cluster: clusterData,
      records,
      suggestedMasterId,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/dedup/clusters/[id]' });
    console.error('Failed to get dedup cluster:', error);
    return NextResponse.json({ error: 'Failed to get cluster' }, { status: 500 });
  }
}
