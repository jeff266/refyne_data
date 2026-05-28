/**
 * Auto-merge Worker
 *
 * Processes clusters scheduled for auto-merge when their waiting period expires.
 * Runs every 15 minutes as a BullMQ repeatable job.
 */

import { supabase } from '@/lib/db/supabase';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { loadRules, applyRules } from './survivorship-rules';

export async function processAutoMerge(): Promise<{ processed: number; errors: number }> {
  if (!supabase) {
    console.warn('[Auto-merge Worker] Supabase not configured');
    return { processed: 0, errors: 0 };
  }

  const now = new Date().toISOString();

  // Find all clusters scheduled for auto-merge that are due
  const { data: dueClusters } = await supabase
    .from('dedup_clusters')
    .select('id, org_id, record_ids')
    .eq('status', 'pending')
    .lte('auto_merge_scheduled_at', now)
    .is('auto_merge_cancelled_at', null)
    .limit(50); // Process in batches

  if (!dueClusters || dueClusters.length === 0) {
    console.log('[Auto-merge Worker] No due clusters');
    return { processed: 0, errors: 0 };
  }

  console.log(`[Auto-merge Worker] Processing ${dueClusters.length} due clusters`);

  let processed = 0;
  let errors = 0;

  for (const cluster of dueClusters) {
    try {
      await executeMerge(cluster);
      processed++;
      console.log(`[Auto-merge Worker] Merged cluster ${cluster.id}`);
    } catch (err: any) {
      errors++;
      console.error(`[Auto-merge Worker] Failed cluster ${cluster.id}:`, err.message);
      // Don't throw: continue processing other clusters
    }
  }

  return { processed, errors };
}

/**
 * Execute an auto-merge for a cluster.
 * Follows same logic as manual merge but with merge_method = 'auto'.
 */
async function executeMerge(cluster: {
  id: string;
  org_id: string;
  record_ids: string[];
}): Promise<void> {
  if (!supabase) {
    throw new Error('Database not configured');
  }

  const { id: clusterId, org_id: orgId, record_ids: recordIds } = cluster;

  // Get access token
  const accessToken = await getAccessToken(orgId);
  if (!accessToken) {
    throw new Error('HubSpot not connected');
  }

  // Use first record as master (arbitrary choice for auto-merge)
  const masterId = recordIds[0];
  const recordsToMerge = recordIds.slice(1);

  // Step 0: Fetch signals from highest-confidence pair
  const { data: topPair } = await supabase
    .from('dedup_pairs')
    .select('signals_fired')
    .eq('cluster_id', clusterId)
    .order('confidence', { ascending: false })
    .limit(1)
    .single();

  const similaritySignals = topPair?.signals_fired ?? null;

  // Step 1: Capture pre-merge snapshots for audit trail
  const preMergeSnapshots: Record<string, any> = {};

  for (const recordId of recordIds) {
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

  // Step 2: Merge each record into master
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
      throw new Error(`HubSpot merge failed: ${error}`);
    }
  }

  // Step 3: Apply survivorship rules
  const rules = await loadRules(orgId);
  const survivorshipSelections: Record<string, string> = {};

  for (const recordId of recordsToMerge) {
    const masterSnapshot = preMergeSnapshots[masterId] || {};
    const duplicateSnapshot = preMergeSnapshots[recordId] || {};

    const survivorshipResult = applyRules(
      masterSnapshot,
      duplicateSnapshot,
      rules
    );

    // Convert survivorship results to field selections
    for (const [field, winner] of Object.entries(survivorshipResult)) {
      if (winner.source === 'duplicate' && winner.rule !== 'default_master') {
        survivorshipSelections[field] = recordId;
      }
    }
  }

  // Update field values based on survivorship rules
  if (Object.keys(survivorshipSelections).length > 0) {
    const updates: Record<string, string> = {};

    for (const [field, sourceRecordId] of Object.entries(survivorshipSelections)) {
      if (sourceRecordId !== masterId) {
        const value = preMergeSnapshots[sourceRecordId]?.[field];
        if (value !== null && value !== '' && value !== undefined) {
          updates[field] = value;
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
        console.error(`[Auto-merge] Failed to update master ${masterId}:`, error);
      }
    }
  }

  // Step 4: Capture post-merge snapshot
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

  // Step 5: Save merge history for each merged record
  for (const recordId of recordsToMerge) {
    await supabase.from('dedup_merge_history').insert({
      org_id: orgId,
      cluster_id: clusterId,
      merged_by: 'auto-merge-worker',
      merged_by_name: 'Auto-merge',
      merged_at: new Date().toISOString(),
      merge_method: 'auto',
      survivor_record_id: masterId,
      merged_record_id: recordId,
      survivor_snapshot: preMergeSnapshots[masterId] || {},
      merged_snapshot: preMergeSnapshots[recordId] || {},
      result_snapshot: postMergeSnapshot,
      field_selections: null,
      confidence_score: 97, // Auto-merge only triggers for 97%+ confidence
      similarity_signals: similaritySignals,
    });
  }

  // Step 6: Update cluster status
  await supabase
    .from('dedup_clusters')
    .update({
      status: 'merged',
      merged_into: masterId,
      resolved_by: 'auto-merge-worker',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', clusterId);

  // Step 7: Update all pairs in cluster
  const { data: pairs } = await supabase
    .from('dedup_pairs')
    .select('id')
    .eq('cluster_id', clusterId);

  if (pairs && pairs.length > 0) {
    await supabase
      .from('dedup_pairs')
      .update({
        status: 'merged',
        surviving_record_id: masterId,
        merged_at: new Date().toISOString(),
        merged_by: 'auto-merge-worker',
        updated_at: new Date().toISOString(),
      })
      .in('id', pairs.map((p) => p.id));
  }

  // Step 8: Log decision for learning
  await supabase.from('dedup_decisions').insert({
    org_id: orgId,
    cluster_id: clusterId,
    decision: 'merged',
    signal_scores: similaritySignals || {},
    cluster_grade: 'A',
    decided_by: 'auto-merge-worker',
  });

  console.log(`[Auto-merge] Successfully merged cluster ${clusterId} into ${masterId}`);
}
