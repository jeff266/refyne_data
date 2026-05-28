import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { rowToCluster, type DedupClusterRow } from '@/lib/dedup/cluster-types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { selectMaster, type HubSpotCompany } from '@/lib/dedup/select-master';
import { revalidatePath } from 'next/cache';

interface BulkMergeRequest {
  clusterIds?: string[];
  allGradeA?: boolean; // If true, merge all Grade A pending clusters
}

/**
 * POST /api/dedup/clusters/bulk-merge
 *
 * Bulk merge multiple Grade A clusters using auto-selected masters.
 */
export async function POST(request: NextRequest) {
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

    const orgId = ctx.orgId;
    const body = (await request.json()) as BulkMergeRequest;

    // Get access token
    const accessToken = await getAccessToken(orgId);
    if (!accessToken) {
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
    }

    // Fetch clusters based on request type
    let clustersQuery = supabase
      .from('dedup_clusters')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'pending');

    if (body.allGradeA) {
      // Fetch all Grade A pending clusters
      clustersQuery = clustersQuery.eq('grade', 'A');
    } else if (body.clusterIds && body.clusterIds.length > 0) {
      // Fetch specific clusters
      clustersQuery = clustersQuery.in('id', body.clusterIds);
    } else {
      return NextResponse.json(
        { error: 'Either clusterIds or allGradeA must be provided' },
        { status: 400 }
      );
    }

    const { data: clusters, error: clustersError } = await clustersQuery;

    if (clustersError || !clusters || clusters.length === 0) {
      return NextResponse.json({ error: 'No valid clusters found' }, { status: 404 });
    }

    const results = {
      merged: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each cluster
    for (const clusterRow of clusters as DedupClusterRow[]) {
      const cluster = rowToCluster(clusterRow);

      try {
        // Fetch signals from highest-confidence pair
        const { data: topPair } = await supabase
          .from('dedup_pairs')
          .select('signals_fired')
          .eq('cluster_id', cluster.id)
          .order('confidence', { ascending: false })
          .limit(1)
          .single();

        const pairSignals = topPair?.signals_fired || null;

        // Fetch company details
        const properties = [
          'name',
          'domain',
          'phone',
          'createdate',
          'num_associated_contacts',
          'num_associated_deals',
        ];

        const records: HubSpotCompany[] = [];

        for (const recordId of cluster.recordIds) {
          const res = await fetch(
            `https://api.hubapi.com/crm/v3/objects/companies/${recordId}?properties=${properties.join(
              ','
            )}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );

          if (res.ok) {
            const data = await res.json();
            records.push({
              id: data.id,
              properties: data.properties,
            });
          }
        }

        // Select master by richness
        const masterId = selectMaster(records);
        const recordsToMerge = cluster.recordIds.filter((id) => id !== masterId);

        // Capture pre-merge snapshots
        const preMergeSnapshots: Record<string, any> = {};
        for (const record of records) {
          preMergeSnapshots[record.id] = record.properties;
        }

        // Merge all records into master
        for (const recordId of recordsToMerge) {
          const mergeRes = await fetch('https://api.hubapi.com/crm/v3/objects/companies/merge', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              primaryObjectId: masterId,
              objectIdToMerge: recordId,
            }),
          });

          if (!mergeRes.ok) {
            const error = await mergeRes.text();
            console.error(
              `[Bulk Merge] Failed to merge ${recordId} into ${masterId}:`,
              error
            );
            throw new Error(`Merge failed: ${error}`);
          }
        }

        // Capture post-merge snapshot
        const postMergeRes = await fetch(
          `https://api.hubapi.com/crm/v3/objects/companies/${masterId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        let postMergeSnapshot = {};
        if (postMergeRes.ok) {
          const data = await postMergeRes.json();
          postMergeSnapshot = data.properties;
        }

        // Save merge history for each merged record
        for (const recordId of recordsToMerge) {
          const historyEntry = {
            org_id: orgId,
            cluster_id: cluster.id,
            merged_by: ctx.userId,
            merged_by_name: null,
            merged_at: new Date().toISOString(),
            merge_method: 'auto',
            survivor_record_id: masterId,
            merged_record_id: recordId,
            survivor_snapshot: preMergeSnapshots[masterId] || {},
            merged_snapshot: preMergeSnapshots[recordId] || {},
            result_snapshot: postMergeSnapshot,
            field_selections: null,
            confidence_score: cluster.grade === 'A' ? 95 : cluster.grade === 'B' ? 75 : 50,
            similarity_signals: pairSignals,
          };

          try {
            const { error: historyError } = await supabase
              .from('dedup_merge_history')
              .insert(historyEntry);

            if (historyError) {
              console.error('[Bulk Merge] Failed to save history:', historyError);
              // Don't fail the merge if history save fails
            }
          } catch (histErr) {
            console.error('[Bulk Merge] Exception saving history:', histErr);
            // Don't fail the merge if history save fails
          }
        }

        // Update cluster status
        await supabase
          .from('dedup_clusters')
          .update({
            status: 'merged',
            merged_into: masterId,
            resolved_by: ctx.userId,
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', cluster.id);

        // Update all pairs in cluster
        await supabase
          .from('dedup_pairs')
          .update({
            status: 'merged',
            surviving_record_id: masterId,
            merged_at: new Date().toISOString(),
            merged_by: ctx.userId,
            updated_at: new Date().toISOString(),
          })
          .in('id', cluster.pairIds);

        // Log decision for learning
        try {
          await supabase.from('dedup_decisions').insert({
            org_id: orgId,
            cluster_id: cluster.id,
            decision: 'merged',
            signal_scores: pairSignals || {},
            cluster_grade: cluster.grade,
            decided_by: ctx.userId,
          });
        } catch (decErr) {
          console.error('[Bulk Merge] Failed to log decision:', decErr);
          // Don't fail merge if decision logging fails
        }

        results.merged++;
      } catch (error) {
        results.failed++;
        const msg = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Cluster ${cluster.id}: ${msg}`);
        console.error(`[Bulk Merge] Failed to process cluster ${cluster.id}:`, error);
      }
    }

    // Invalidate cache
    revalidatePath('/dedup');

    return NextResponse.json(results);
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/dedup/clusters/bulk-merge' });
    console.error('Failed to bulk merge clusters:', error);
    return NextResponse.json({ error: 'Failed to bulk merge clusters' }, { status: 500 });
  }
}
