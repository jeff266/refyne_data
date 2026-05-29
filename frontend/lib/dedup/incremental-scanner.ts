/**
 * Incremental Dedup Scanner
 *
 * Core logic for incremental dedup scanning:
 * - Auto-detects scan type (full vs incremental)
 * - Full scans on Sundays or first run
 * - Incremental scans check only modified records
 * - Maintains persistent index for O(1) candidate lookups
 */

import { supabase, isSupabaseConfigured } from '../db/supabase';
import { HubSpotClient } from '../hubspot/client';
import { fetchAllCompanies, fetchModifiedSince, getLatestModifiedDate } from '../hubspot/fetch-companies';
import { rebuildFullIndex, upsertIndexRecords, findCandidatesFromIndex } from './dedup-index';
import { evaluateCompanyPair, type CompanyProperties } from './company-signals';
import { UnionFind } from './union-find';
import { scheduleAutoMerges } from './auto-merge-scheduler';
import type { HubSpotCompany } from '../hubspot/types';
import type { PairGrade } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Day of week for full scans (0 = Sunday).
 */
const FULL_SCAN_DAY = 0;

/**
 * Minimum confidence threshold for storing pairs.
 */
const CONFIDENCE_THRESHOLD = 65;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DedupScanResult {
  scanType: 'full' | 'incremental';
  recordsScanned: number;
  pairsFound: number;
  clustersFound: number;
  newClusterIds: string[];
}

interface ScanRun {
  id: string;
  org_id: string;
  portal_id: string;
  connection_id: string;
  scan_type: 'full' | 'incremental';
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  modified_cursor?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scan Run Management
// ─────────────────────────────────────────────────────────────────────────────

async function getLastCompletedScanRun(
  orgId: string,
  portalId: string
): Promise<{ modified_cursor: Date } | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('dedup_scan_runs')
    .select('modified_cursor')
    .eq('org_id', orgId)
    .eq('portal_id', portalId)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data || !data.modified_cursor) return null;

  return { modified_cursor: new Date(data.modified_cursor) };
}

async function createScanRun(
  orgId: string,
  portalId: string,
  connectionId: string,
  scanType: 'full' | 'incremental'
): Promise<ScanRun> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('dedup_scan_runs')
    .insert({
      org_id: orgId,
      portal_id: portalId,
      connection_id: connectionId,
      scan_type: scanType,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create scan run: ${error?.message}`);
  }

  return data as ScanRun;
}

async function completeScanRun(
  scanRunId: string,
  stats: {
    recordsScanned: number;
    newPairsFound: number;
    newClustersFound: number;
    modifiedCursor: Date;
  }
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from('dedup_scan_runs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      records_scanned: stats.recordsScanned,
      new_pairs_found: stats.newPairsFound,
      new_clusters_found: stats.newClustersFound,
      modified_cursor: stats.modifiedCursor.toISOString(),
    })
    .eq('id', scanRunId);

  if (error) {
    console.error('[incremental-scanner] Failed to complete scan run:', error);
  }
}

async function failScanRun(scanRunId: string, errorMessage: string): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from('dedup_scan_runs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq('id', scanRunId);

  if (error) {
    console.error('[incremental-scanner] Failed to mark scan run as failed:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain Exclusions
// ─────────────────────────────────────────────────────────────────────────────

async function getDomainExclusionSet(orgId: string): Promise<Set<string>> {
  if (!supabase) return new Set();

  const { data, error } = await supabase
    .from('dedup_domain_exclusions')
    .select('domain')
    .eq('org_id', orgId);

  if (error) {
    console.error('[incremental-scanner] Failed to fetch domain exclusions:', error);
    return new Set();
  }

  return new Set(data.map((row) => row.domain));
}

// ─────────────────────────────────────────────────────────────────────────────
// Pair Storage
// ─────────────────────────────────────────────────────────────────────────────

async function storePair(
  orgId: string,
  portalId: string,
  connectionId: string,
  idA: string,
  idB: string,
  evaluation: {
    confidence: number;
    grade: PairGrade;
    nameSimilarity: number | null;
    signalsFired: any[];
  }
): Promise<{ id: string }> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('dedup_pairs')
    .upsert(
      {
        org_id: orgId,
        portal_id: portalId,
        connection_id: connectionId,
        record_a_id: idA,
        record_b_id: idB,
        confidence: evaluation.confidence,
        grade: evaluation.grade,
        name_similarity: evaluation.nameSimilarity,
        signals_fired: evaluation.signalsFired,
        status: 'pending',
        detected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,record_a_id,record_b_id' }
    )
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to store pair: ${error?.message}`);
  }

  return { id: data.id };
}

async function pairExists(orgId: string, idA: string, idB: string): Promise<boolean> {
  if (!supabase) return false;

  const { count } = await supabase
    .from('dedup_pairs')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .or(`and(record_a_id.eq.${idA},record_b_id.eq.${idB}),and(record_a_id.eq.${idB},record_b_id.eq.${idA})`);

  return (count ?? 0) > 0;
}

async function getAllPendingPairs(
  orgId: string,
  portalId: string
): Promise<Array<{ id: string; record_a_id: string; record_b_id: string; grade: PairGrade }>> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('dedup_pairs')
    .select('id, record_a_id, record_b_id, grade')
    .eq('org_id', orgId)
    .eq('portal_id', portalId)
    .eq('status', 'pending');

  if (error || !data) {
    console.error('[incremental-scanner] Failed to fetch pending pairs:', error);
    return [];
  }

  return data as Array<{ id: string; record_a_id: string; record_b_id: string; grade: PairGrade }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cluster Building
// ─────────────────────────────────────────────────────────────────────────────

async function buildClusters(
  orgId: string,
  portalId: string,
  connectionId: string,
  pairs: Array<{ id: string; record_a_id: string; record_b_id: string; grade: PairGrade }>
): Promise<{ count: number; clusterIds: string[] }> {
  if (!supabase || pairs.length === 0) return { count: 0, clusterIds: [] };

  // Clear existing clusters for this portal
  await supabase.from('dedup_clusters').delete().eq('org_id', orgId).eq('portal_id', portalId);

  // Build Union-Find from pairs
  const uf = new UnionFind();
  const pairsByCluster = new Map<string, Array<{ id: string; grade: PairGrade }>>();

  for (const pair of pairs) {
    uf.union(pair.record_a_id, pair.record_b_id);

    const root = uf.find(pair.record_a_id);
    if (!pairsByCluster.has(root)) {
      pairsByCluster.set(root, []);
    }
    pairsByCluster.get(root)!.push({
      id: pair.id,
      grade: pair.grade,
    });
  }

  const clusters = uf.getClusters();
  console.log(`[incremental-scanner] Built ${clusters.length} clusters from ${pairs.length} pairs`);

  // Track newly created cluster IDs
  const clusterIds: string[] = [];

  // Insert cluster rows
  for (const recordIds of clusters) {
    const root = uf.find(recordIds[0]);
    const clusterPairs = pairsByCluster.get(root) || [];

    // Determine highest grade (A > B > C > D)
    const gradeOrder: PairGrade[] = ['A', 'B', 'C', 'D'];
    let clusterGrade: PairGrade = 'D';
    for (const grade of gradeOrder) {
      if (clusterPairs.some((p) => p.grade === grade)) {
        clusterGrade = grade;
        break;
      }
    }

    // Insert cluster
    const { data: cluster, error: clusterError } = await supabase
      .from('dedup_clusters')
      .insert({
        org_id: orgId,
        portal_id: portalId,
        connection_id: connectionId,
        grade: clusterGrade,
        record_ids: recordIds,
        pair_ids: clusterPairs.map((p) => p.id),
        status: 'pending',
      })
      .select('id')
      .single();

    if (clusterError || !cluster) {
      console.error('[incremental-scanner] Failed to insert cluster:', clusterError);
      continue;
    }

    // Track cluster ID for auto-merge scheduling
    clusterIds.push(cluster.id);

    // Backfill cluster_id on pairs
    await supabase
      .from('dedup_pairs')
      .update({ cluster_id: cluster.id })
      .in(
        'id',
        clusterPairs.map((p) => p.id)
      );
  }

  return { count: clusters.length, clusterIds };
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Scan
// ─────────────────────────────────────────────────────────────────────────────

async function runFullScan(
  orgId: string,
  portalId: string,
  client: HubSpotClient,
  connectionId: string,
  scanRun: ScanRun
): Promise<DedupScanResult> {
  console.log(`[incremental-scanner] Starting full scan for portal ${portalId}`);

  // Fetch all companies
  const companies = await fetchAllCompanies(client);
  console.log(`[incremental-scanner] Fetched ${companies.length} companies`);

  // Rebuild index
  await rebuildFullIndex(orgId, portalId, companies);

  // Get domain exclusions
  const exclusions = await getDomainExclusionSet(orgId);

  // Generate pairs (simplified - just evaluate all combinations from index)
  // In a real implementation, this would use blocking keys
  const pairs: Array<{ id: string; record_a_id: string; record_b_id: string; grade: PairGrade }> = [];

  // For now, use the existing generateAndStorePairs logic
  // We'll update this in Step 5

  // Build clusters
  const allPairs = await getAllPendingPairs(orgId, portalId);
  const { count: clustersFound, clusterIds } = await buildClusters(orgId, portalId, connectionId, allPairs);

  // Update scan run
  const cursor = companies.length > 0 ? getLatestModifiedDate(companies) : new Date();
  await completeScanRun(scanRun.id, {
    recordsScanned: companies.length,
    newPairsFound: allPairs.length,
    newClustersFound: clustersFound,
    modifiedCursor: cursor,
  });

  return {
    scanType: 'full',
    recordsScanned: companies.length,
    pairsFound: allPairs.length,
    clustersFound,
    newClusterIds: clusterIds,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Incremental Scan
// ─────────────────────────────────────────────────────────────────────────────

async function runIncrementalScan(
  orgId: string,
  portalId: string,
  client: HubSpotClient,
  connectionId: string,
  scanRun: ScanRun,
  cursor: Date
): Promise<DedupScanResult> {
  console.log(`[incremental-scanner] Starting incremental scan for portal ${portalId} (cursor: ${cursor.toISOString()})`);

  // Fetch modified companies
  const modifiedCompanies = await fetchModifiedSince(client, cursor);
  console.log(`[incremental-scanner] Found ${modifiedCompanies.length} modified companies`);

  if (modifiedCompanies.length === 0) {
    await completeScanRun(scanRun.id, {
      recordsScanned: 0,
      newPairsFound: 0,
      newClustersFound: 0,
      modifiedCursor: cursor,
    });
    return {
      scanType: 'incremental',
      recordsScanned: 0,
      pairsFound: 0,
      clustersFound: 0,
      newClusterIds: [],
    };
  }

  // Update index for modified records
  await upsertIndexRecords(orgId, portalId, modifiedCompanies);

  // Get domain exclusions
  const exclusions = await getDomainExclusionSet(orgId);

  // Find candidates and evaluate
  let newPairsFound = 0;

  for (const company of modifiedCompanies) {
    const candidates = await findCandidatesFromIndex(orgId, portalId, company, exclusions);

    for (const candidate of candidates) {
      // Skip if pair already exists
      if (await pairExists(orgId, company.id, candidate.hubspot_company_id)) {
        continue;
      }

      // Evaluate pair (need to fetch candidate's full data)
      // For now, skip evaluation - we'll enhance this in Step 5
      // const evaluation = evaluateCompanyPair(company, candidateCompany);
      // if (evaluation.confidence >= CONFIDENCE_THRESHOLD) {
      //   await storePair(orgId, portalId, connectionId, company.id, candidate.hubspot_company_id, evaluation);
      //   newPairsFound++;
      // }
    }
  }

  // Rebuild clusters if new pairs were found
  let clustersFound = 0;
  let clusterIds: string[] = [];
  if (newPairsFound > 0) {
    const allPairs = await getAllPendingPairs(orgId, portalId);
    const result = await buildClusters(orgId, portalId, connectionId, allPairs);
    clustersFound = result.count;
    clusterIds = result.clusterIds;
  }

  // Update scan run
  const newCursor = getLatestModifiedDate(modifiedCompanies);
  await completeScanRun(scanRun.id, {
    recordsScanned: modifiedCompanies.length,
    newPairsFound,
    newClustersFound: clustersFound,
    modifiedCursor: newCursor,
  });

  return {
    scanType: 'incremental',
    recordsScanned: modifiedCompanies.length,
    pairsFound: newPairsFound,
    clustersFound,
    newClusterIds: clusterIds,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

export async function runDedupScan(
  orgId: string,
  portalId: string,
  client: HubSpotClient,
  connectionId: string,
  forceFullScan = false
): Promise<DedupScanResult> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  // Determine scan type
  const lastRun = await getLastCompletedScanRun(orgId, portalId);
  const isFirstScan = !lastRun;
  const isSundayFullScan = new Date().getUTCDay() === FULL_SCAN_DAY;
  const scanType: 'full' | 'incremental' =
    isFirstScan || isSundayFullScan || forceFullScan ? 'full' : 'incremental';

  console.log(`[incremental-scanner] Scan type: ${scanType} (first=${isFirstScan}, sunday=${isSundayFullScan}, forced=${forceFullScan})`);

  // Create scan run record
  const scanRun = await createScanRun(orgId, portalId, connectionId, scanType);

  try {
    const result = scanType === 'full'
      ? await runFullScan(orgId, portalId, client, connectionId, scanRun)
      : await runIncrementalScan(orgId, portalId, client, connectionId, scanRun, lastRun!.modified_cursor);

    // Schedule auto-merge for high-confidence clusters
    if (result.newClusterIds.length > 0) {
      await scheduleAutoMerges(orgId, result.newClusterIds);
      console.log(`[incremental-scanner] Scheduled ${result.newClusterIds.length} clusters for auto-merge evaluation`);
    }

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await failScanRun(scanRun.id, errorMessage);
    throw err;
  }
}
