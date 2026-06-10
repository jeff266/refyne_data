import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { rowToCluster, type DedupClusterRow } from '@/lib/dedup/cluster-types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { revalidatePath } from 'next/cache';
import { loadRules, applyRules } from '@/lib/dedup/survivorship-rules';
import { executeMerge } from '@/lib/dedup/merge-executor';
import { logAuditEvent } from '@/lib/audit/logger';
import { AUDIT_ACTIONS } from '@/lib/audit/actions';
import { consumeUsage } from '@/lib/billing/enforce';
import { requireAdmin } from '@/lib/auth/roles';
import { z } from 'zod';

const mergeClusterSchema = z.object({
  masterId: z.string().min(1, 'masterId is required'),
  fieldSelections: z.record(z.string()).optional(),
  absorb: z.boolean().optional(),
});

interface MergeClusterRequest {
  masterId: string;
  fieldSelections?: Record<string, string>; // field -> recordId
  absorb?: boolean; // if true, use default merge behavior
}

/**
 * POST /api/dedup/clusters/:id/merge
 *
 * Merge a cluster into a master record.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    requireAdmin(ctx.orgRole);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
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

    // Validate request body
    const rawBody = await request.json();
    const validation = mergeClusterSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const body = validation.data as MergeClusterRequest;

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

    if (clusterData.status !== 'pending') {
      return NextResponse.json({ error: 'Cluster already processed' }, { status: 400 });
    }

    // Get access token
    const accessToken = await getAccessToken(orgId);
    if (!accessToken) {
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
    }

    // Merge all records into master
    const masterId = body.masterId;
    const recordsToMerge = clusterData.recordIds.filter((id) => id !== masterId);

    // Billing enforcement: Consume merge usage
    const billingResult = await consumeUsage(orgId, 'merge', recordsToMerge.length);
    if (!billingResult.allowed) {
      return NextResponse.json(
        {
          error: 'billing_limit_exceeded',
          reason: billingResult.reason,
          remaining: billingResult.remaining,
        },
        { status: 402 } // 402 Payment Required
      );
    }

    try {
      // Step 0: Fetch signals from highest-confidence pair
      const { data: topPair } = await supabase
        .from('dedup_pairs')
        .select('signals_fired')
        .eq('cluster_id', id)
        .order('confidence', { ascending: false })
        .limit(1)
        .single();

      const similaritySignals = topPair?.signals_fired ?? null;

      // Step 1: Capture pre-merge snapshots for audit trail
      const preMergeSnapshots: Record<string, any> = {};

      for (const recordId of clusterData.recordIds) {
        const snapshotRes = await fetch(
          `https://api.hubapi.com/crm/v3/objects/companies/${recordId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (snapshotRes.ok) {
          const data = await snapshotRes.json();
          preMergeSnapshots[recordId] = data.properties;
        }
      }

      // Step 1: Execute policy-driven merge
      const mergeResult = await executeMerge({
        orgId,
        masterId,
        duplicateIds: recordsToMerge,
        accessToken,
        preMergeSnapshots,
      });

      if (!mergeResult.success) {
        console.error('[Merge Cluster] Policy-driven merge failed:', mergeResult.error);
        throw new Error(mergeResult.error || 'Merge failed');
      }

      console.log(`[Merge Cluster] Merged ${mergeResult.mergedIds.length} records using policy`);

      // Convert appliedRules to survivorshipDecisions format for history
      const survivorshipDecisions: Record<
        string,
        { rule: string; source: string; value?: any; method?: string }
      > = {};

      for (const [field, ruleInfo] of Object.entries(mergeResult.appliedRules)) {
        survivorshipDecisions[field] = {
          rule: ruleInfo.rule,
          source: ruleInfo.source,
        };
      }

      // If manual field selections provided, apply them (overrides policy)
      if (body.fieldSelections && Object.keys(body.fieldSelections).length > 0 && !body.absorb) {
        const updates: Record<string, string> = {};

        for (const [field, sourceRecordId] of Object.entries(body.fieldSelections)) {
          if (sourceRecordId !== masterId) {
            const value = preMergeSnapshots[sourceRecordId]?.[field];
            if (value !== null && value !== '' && value !== undefined) {
              updates[field] = value;
              survivorshipDecisions[field] = {
                rule: 'manual_selection',
                source: 'duplicate',
              };
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          const updateRes = await fetch(
            `https://api.hubapi.com/crm/v3/objects/companies/${masterId}`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ properties: updates }),
            }
          );

          if (!updateRes.ok) {
            const error = await updateRes.text();
            console.error(`[Merge Cluster] Failed to apply manual selections:`, error);
          }
        }
      }

      // Step 2.5: Capture post-merge snapshot and save history
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
          cluster_id: id,
          merged_by: ctx.userId,
          merged_by_name: null, // TODO: Fetch from Clerk user profile
          merged_at: new Date().toISOString(),
          merge_method: 'manual',
          survivor_record_id: masterId,
          merged_record_id: recordId,
          survivor_snapshot: preMergeSnapshots[masterId] || {},
          merged_snapshot: preMergeSnapshots[recordId] || {},
          result_snapshot: postMergeSnapshot,
          field_selections: body.fieldSelections || null,
          survivorship_decisions: survivorshipDecisions, // Store which rule was applied to each field
          confidence_score: clusterData.grade === 'A' ? 95 : clusterData.grade === 'B' ? 75 : 50,
          similarity_signals: similaritySignals,
        };

        const { error: historyError } = await supabase
          .from('dedup_merge_history')
          .insert(historyEntry);

        if (historyError) {
          console.error('[Merge History] Failed to save history:', historyError);
          // Don't fail the merge if history save fails - just log it
        }
      }

      // Step 3: Update cluster status
      const { error: updateError } = await supabase
        .from('dedup_clusters')
        .update({
          status: 'merged',
          merged_into: masterId,
          resolved_by: ctx.userId,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) {
        console.error('[Merge Cluster] Failed to update cluster status:', updateError);
      }

      // Step 4: Update all pairs in cluster
      const { error: pairsError } = await supabase
        .from('dedup_pairs')
        .update({
          status: 'merged',
          surviving_record_id: masterId,
          merged_at: new Date().toISOString(),
          merged_by: ctx.userId,
          updated_at: new Date().toISOString(),
        })
        .in('id', clusterData.pairIds);

      if (pairsError) {
        console.error('[Merge Cluster] Failed to update pairs:', pairsError);
      }

      // Step 5: Log decision for learning
      try {
        await supabase.from('dedup_decisions').insert({
          org_id: orgId,
          cluster_id: id,
          decision: 'merged',
          signal_scores: similaritySignals || {},
          cluster_grade: clusterData.grade,
          decided_by: ctx.userId,
        });
      } catch (decErr) {
        console.error('[Merge Cluster] Failed to log decision:', decErr);
        // Don't fail merge if decision logging fails
      }

      // Step 6: Log audit event
      logAuditEvent({
        orgId: ctx.orgId,
        actorId: ctx.userId,
        actorEmail: ctx.userEmail,
        action: AUDIT_ACTIONS.DEDUP_MERGE_EXECUTED,
        objectType: 'dedup_cluster',
        objectId: id,
        objectLabel: `Cluster ${clusterData.grade} (${clusterData.recordIds.length} records)`,
        beforeState: {
          status: 'pending',
          recordCount: clusterData.recordIds.length,
          grade: clusterData.grade,
        },
        afterState: {
          status: 'merged',
          masterId,
          mergedCount: recordsToMerge.length,
        },
        metadata: {
          merge_method: 'manual',
          field_selections_count: body.fieldSelections ? Object.keys(body.fieldSelections).length : 0,
        },
        request,
      });

      // Step 7: Invalidate cache
      revalidatePath('/dedup');

      return NextResponse.json({ success: true, masterId });
    } catch (error) {
      captureWithOrgContext(error, ctx.orgId, {
        route: '/api/dedup/clusters/[id]/merge',
        clusterId: id,
      });
      console.error('[Merge Cluster] Merge failed:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Merge failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/dedup/clusters/[id]/merge' });
    console.error('Failed to merge cluster:', error);
    return NextResponse.json({ error: 'Failed to merge cluster' }, { status: 500 });
  }
}
