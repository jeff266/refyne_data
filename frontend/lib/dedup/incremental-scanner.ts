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
import { evaluateCompanyPair, normalizeDomain, type CompanyProperties } from './company-signals';
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
  gradeBreakdown: {
    A: number;
    B: number;
    C: number;
    D: number;
  };
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
  },
  objectType: 'company' | 'contact' | 'deal' = 'company'
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
        object_type: objectType,
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
  portalId: string,
  objectType: 'company' | 'contact' | 'deal' = 'company'
): Promise<Array<{ id: string; record_a_id: string; record_b_id: string; grade: PairGrade }>> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('dedup_pairs')
    .select('id, record_a_id, record_b_id, grade')
    .eq('org_id', orgId)
    .eq('portal_id', portalId)
    .eq('object_type', objectType)
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
  pairs: Array<{ id: string; record_a_id: string; record_b_id: string; grade: PairGrade }>,
  objectType: 'company' | 'contact' | 'deal' = 'company'
): Promise<{ count: number; clusterIds: string[] }> {
  if (!supabase || pairs.length === 0) return { count: 0, clusterIds: [] };

  // Clear existing clusters for this portal AND object type (handle FK constraints)
  // Must delete in order: decisions → clear pair cluster_ids → clusters

  // Step 1: Get cluster IDs to delete (filtered by object_type)
  const { data: clustersToDelete } = await supabase
    .from('dedup_clusters')
    .select('id')
    .eq('org_id', orgId)
    .eq('portal_id', portalId)
    .eq('object_type', objectType);

  const clusterIdsToDelete = (clustersToDelete || []).map(c => c.id);

  if (clusterIdsToDelete.length > 0) {
    // Step 2: Delete decisions that reference these clusters
    await supabase
      .from('dedup_decisions')
      .delete()
      .in('cluster_id', clusterIdsToDelete);

    // Step 3: Clear cluster_id from pairs
    await supabase
      .from('dedup_pairs')
      .update({ cluster_id: null })
      .in('cluster_id', clusterIdsToDelete);
  }

  // Step 4: Now safe to delete clusters (filtered by object_type)
  await supabase
    .from('dedup_clusters')
    .delete()
    .eq('org_id', orgId)
    .eq('portal_id', portalId)
    .eq('object_type', objectType);

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
        object_type: objectType,
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
// Contact Dedup Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isGenericEmail(email: string): boolean {
  const genericPrefixes = [
    'info', 'hello', 'contact', 'admin', 'support', 'sales',
    'team', 'marketing', 'help', 'billing', 'hr', 'careers',
    'jobs', 'noreply', 'no-reply', 'donotreply', 'webmaster',
    'postmaster', 'enquiries', 'enquiry', 'office', 'mail'
  ];
  const prefix = email.split('@')[0].toLowerCase();
  return genericPrefixes.includes(prefix);
}

function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return false;
  if (/^0+$/.test(digits)) return false;  // all zeros
  if (digits === '5555555555') return false;  // test number
  return true;
}

function isCommonName(first: string, last: string): boolean {
  const commonFirstNames = ['john', 'jane', 'michael', 'david', 'james',
    'robert', 'mary', 'jennifer', 'linda', 'barbara', 'william', 'richard',
    'joseph', 'thomas', 'charles', 'chris', 'daniel', 'mark', 'donald'];
  const commonLastNames = ['smith', 'johnson', 'williams', 'brown', 'jones',
    'garcia', 'miller', 'davis', 'wilson', 'martinez', 'anderson', 'taylor',
    'thomas', 'jackson', 'white', 'harris', 'martin', 'thompson', 'young'];
  return commonFirstNames.includes(first) && commonLastNames.includes(last);
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact Full Scan (Multi-signal graded matching)
// ─────────────────────────────────────────────────────────────────────────────

async function runContactFullScan(
  orgId: string,
  portalId: string,
  connectionId: string,
  scanRun: ScanRun,
  records: any[],
  job?: any
): Promise<DedupScanResult> {
  console.log(`[contact-dedup] Starting contact dedup scan with ${records.length} contacts`);

  // Clear old pairs for idempotent full scan
  if (!supabase) throw new Error('Supabase not configured');

  console.log('[contact-dedup] Clearing old pairs for full scan...');
  await supabase
    .from('dedup_pairs')
    .delete()
    .eq('org_id', orgId)
    .eq('portal_id', portalId)
    .eq('object_type', 'contact');

  console.log('[contact-dedup] Old pairs cleared, building signal maps...');

  // ─── Signal 1: Email Map (Grade A) ───────────────────────────────────────
  const emailMap = new Map<string, string>();  // normalized email → contact ID

  for (const contact of records) {
    const email = contact.properties?.email?.toLowerCase().trim();
    if (email && !isGenericEmail(email)) {
      if (!emailMap.has(email)) {
        emailMap.set(email, contact.id);
      }
    }
  }

  // ─── Signal 2: Phone Map (Grade A) ───────────────────────────────────────
  const phoneMap = new Map<string, string>();  // normalized phone → contact ID

  for (const contact of records) {
    // Check both phone and mobilephone fields
    const phones = [
      contact.properties?.phone,
      contact.properties?.mobilephone
    ].filter(p => p && isValidPhone(p));

    for (const phone of phones) {
      const normalized = phone.replace(/\D/g, '');
      if (normalized.length >= 10) {
        if (!phoneMap.has(normalized)) {
          phoneMap.set(normalized, contact.id);
        }
      }
    }
  }

  // ─── Signal 3: Name+Domain Map (Grade B) ─────────────────────────────────
  const nameDomainMap = new Map<string, string>();  // key → contact ID

  for (const contact of records) {
    const email = contact.properties?.email?.toLowerCase().trim();
    const first = contact.properties?.firstname?.toLowerCase().trim();
    const last = contact.properties?.lastname?.toLowerCase().trim();

    if (email && first && last && !isGenericEmail(email)) {
      const domain = email.split('@')[1];
      if (domain) {
        const key = `${first}:${last}:${domain}`;
        if (!nameDomainMap.has(key)) {
          nameDomainMap.set(key, contact.id);
        }
      }
    }
  }

  console.log(`[contact-dedup] Built in-memory maps: ${emailMap.size} emails, ${phoneMap.size} phones, ${nameDomainMap.size} name+domains`);

  // ─── Generate Pairs ───────────────────────────────────────────────────────
  interface ContactPair {
    id1: string;
    id2: string;
    signal: 'email' | 'phone' | 'name_domain';
    confidence: number;
    grade: PairGrade;
  }

  const pairs: ContactPair[] = [];

  // Email matches (Grade A, confidence 1.0)
  for (const contact of records) {
    const email = contact.properties?.email?.toLowerCase().trim();
    if (email && !isGenericEmail(email)) {
      const existingId = emailMap.get(email);
      if (existingId && existingId !== contact.id) {
        pairs.push({
          id1: existingId,
          id2: contact.id,
          signal: 'email',
          confidence: 100,
          grade: 'A'
        });
      }
    }
  }

  // Phone matches (Grade A, confidence 1.0)
  for (const contact of records) {
    const phones = [
      contact.properties?.phone,
      contact.properties?.mobilephone
    ].filter(p => p && isValidPhone(p));

    for (const phone of phones) {
      const normalized = phone.replace(/\D/g, '');
      if (normalized.length >= 10) {
        const existingId = phoneMap.get(normalized);
        if (existingId && existingId !== contact.id) {
          pairs.push({
            id1: existingId,
            id2: contact.id,
            signal: 'phone',
            confidence: 100,
            grade: 'A'
          });
        }
      }
    }
  }

  // Name+domain matches (Grade B, confidence 0.85)
  for (const contact of records) {
    const email = contact.properties?.email?.toLowerCase().trim();
    const first = contact.properties?.firstname?.toLowerCase().trim();
    const last = contact.properties?.lastname?.toLowerCase().trim();

    if (email && first && last && !isGenericEmail(email)) {
      const domain = email.split('@')[1];
      if (domain) {
        const key = `${first}:${last}:${domain}`;
        const existingId = nameDomainMap.get(key);
        if (existingId && existingId !== contact.id) {
          pairs.push({
            id1: existingId,
            id2: contact.id,
            signal: 'name_domain',
            confidence: 85,
            grade: 'B'
          });
        }
      }
    }
  }

  console.log(`[contact-dedup] Found ${pairs.length} raw pairs before deduplication`);

  // ─── Deduplicate Pairs (keep highest confidence) ─────────────────────────
  const seenPairs = new Map<string, ContactPair>();

  for (const pair of pairs) {
    const key = [pair.id1, pair.id2].sort().join(':');
    const existing = seenPairs.get(key);
    if (!existing || pair.confidence > existing.confidence) {
      seenPairs.set(key, pair);
    }
  }

  const finalPairs = Array.from(seenPairs.values());
  console.log(`[contact-dedup] After deduplication: ${finalPairs.length} unique pairs`);

  // ─── Store Pairs in Database ─────────────────────────────────────────────
  const gradeCount = { A: 0, B: 0, C: 0, D: 0 };

  for (const pair of finalPairs) {
    await supabase.from('dedup_pairs').insert({
      org_id: orgId,
      portal_id: portalId,
      connection_id: connectionId,
      object_type: 'contact',
      record_a_id: pair.id1,
      record_b_id: pair.id2,
      confidence: pair.confidence,
      grade: pair.grade,
      signals_fired: [{ signal: pair.signal, fired: true, points: pair.confidence }],
      status: 'pending',
      detected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    gradeCount[pair.grade]++;
  }

  console.log(`[contact-dedup] Stored ${finalPairs.length} pairs in database`);
  console.log(`[contact-dedup] Grade breakdown: A=${gradeCount.A}, B=${gradeCount.B}, C=${gradeCount.C}, D=${gradeCount.D}`);

  if (job) {
    await job.updateProgress({
      phase: 'progress',
      message: `Building clusters from ${finalPairs.length} pairs...`,
      progress: 90,
      pairsFound: finalPairs.length,
      gradeBreakdown: gradeCount,
    });
  }

  // ─── Build Clusters ──────────────────────────────────────────────────────
  const allPairs = await getAllPendingPairs(orgId, portalId, 'contact');
  const { count: clustersFound, clusterIds } = await buildClusters(orgId, portalId, connectionId, allPairs, 'contact');

  console.log(`[contact-dedup] Built ${clustersFound} clusters`);

  // ─── Update Scan Run ─────────────────────────────────────────────────────
  const cursor = records.length > 0 ? getLatestModifiedDate(records) : new Date();
  await completeScanRun(scanRun.id, {
    recordsScanned: records.length,
    newPairsFound: finalPairs.length,
    newClustersFound: clustersFound,
    modifiedCursor: cursor,
  });

  return {
    scanType: 'full',
    recordsScanned: records.length,
    pairsFound: finalPairs.length,
    clustersFound,
    newClusterIds: clusterIds,
    gradeBreakdown: gradeCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Scan
// ─────────────────────────────────────────────────────────────────────────────

async function runFullScan(
  orgId: string,
  portalId: string,
  client: HubSpotClient,
  connectionId: string,
  scanRun: ScanRun,
  objectType: 'company' | 'contact' | 'deal' = 'company',
  job?: any // Optional job for progress updates
): Promise<DedupScanResult> {
  const objectLabel = objectType === 'contact' ? 'contacts' : 'companies';
  console.log(`[incremental-scanner] Starting full scan for ${objectLabel} in portal ${portalId}`);

  // Define properties based on object type
  const properties = objectType === 'contact'
    ? ['firstname', 'lastname', 'email', 'phone', 'mobilephone', 'company', 'hs_lastmodifieddate'] as const
    : ['name', 'domain', 'phone', 'industry', 'linkedin_company_page', 'hs_lastmodifieddate'] as const;

  // Fetch all records using unified getAllRecords method
  const records: any[] = [];
  for await (const batch of client.getAllRecords(objectType as 'company' | 'contact', properties)) {
    records.push(...batch);
  }
  console.log(`[incremental-scanner] Fetched ${records.length} ${objectLabel}`);

  if (job) {
    await job.updateProgress({
      phase: 'progress',
      message: `Fetched ${records.length} ${objectLabel}, building index...`,
      progress: 5,
      pairsFound: 0,
    });
  }

  // Rebuild index
  await rebuildFullIndex(orgId, portalId, records);

  if (job) {
    await job.updateProgress({
      phase: 'progress',
      message: 'Index built, evaluating duplicate candidates...',
      progress: 10,
      pairsFound: 0,
    });
  }

  // Get domain exclusions
  const exclusions = await getDomainExclusionSet(orgId);

  // Create record lookup map for fast access
  const companyMap = new Map(records.map((c) => [c.id, c]));

  if (job) {
    await job.updateProgress({
      phase: 'progress',
      message: 'Loading blocking key index...',
      progress: 12,
      pairsFound: 0,
    });
  }

  // Fetch entire index ONCE instead of querying per company
  // This eliminates 11,000+ sequential database queries
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data: fullIndex, error: indexError } = await supabase
    .from('company_dedup_index')
    .select('hubspot_company_id, domain_normalized, phone_prefix, name_prefix, linkedin_id')
    .eq('org_id', orgId)
    .eq('portal_id', portalId);

  if (indexError) {
    throw new Error(`Failed to fetch index: ${indexError.message}`);
  }

  console.log(`[incremental-scanner] Loaded ${fullIndex?.length || 0} index records`);

  // Branch: Company vs Contact dedup logic
  if (objectType === 'contact') {
    // ═══════════════════════════════════════════════════════════════════════════
    // CONTACT DEDUP: Multi-signal graded matching
    // ═══════════════════════════════════════════════════════════════════════════
    return await runContactFullScan(orgId, portalId, connectionId, scanRun, records, job);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPANY DEDUP: Existing logic (unchanged)
  // ═══════════════════════════════════════════════════════════════════════════

  // Build in-memory lookup maps for O(1) candidate finding
  const domainMap = new Map<string, string[]>();
  const phoneMap = new Map<string, string[]>();
  const nameMap = new Map<string, string[]>();
  const linkedinMap = new Map<string, string[]>();

  for (const record of fullIndex || []) {
    // Domain map
    if (record.domain_normalized) {
      const existing = domainMap.get(record.domain_normalized) || [];
      domainMap.set(record.domain_normalized, [...existing, record.hubspot_company_id]);
    }

    // Phone map
    if (record.phone_prefix) {
      const existing = phoneMap.get(record.phone_prefix) || [];
      phoneMap.set(record.phone_prefix, [...existing, record.hubspot_company_id]);
    }

    // Name map
    if (record.name_prefix) {
      const existing = nameMap.get(record.name_prefix) || [];
      nameMap.set(record.name_prefix, [...existing, record.hubspot_company_id]);
    }

    // LinkedIn map
    if (record.linkedin_id) {
      const existing = linkedinMap.get(record.linkedin_id) || [];
      linkedinMap.set(record.linkedin_id, [...existing, record.hubspot_company_id]);
    }
  }

  console.log(`[incremental-scanner] Built in-memory maps: ${domainMap.size} domains, ${phoneMap.size} phones, ${nameMap.size} names, ${linkedinMap.size} linkedin`);

  // For full scans, clear old pairs to make scan idempotent
  // (Incremental scans keep old pairs and only add new ones)
  console.log('[incremental-scanner] Clearing old pairs for full scan...');
  await supabase
    .from('dedup_pairs')
    .delete()
    .eq('org_id', orgId)
    .eq('portal_id', portalId);

  console.log('[incremental-scanner] Old pairs cleared, starting fresh evaluation');

  // Generate pairs using blocking keys
  let newPairsFound = 0;
  const processedPairs = new Set<string>();
  const gradeCount = { A: 0, B: 0, C: 0, D: 0 };

  console.log(`[incremental-scanner] Evaluating candidates for ${records.length} ${objectLabel}...`);

  for (let i = 0; i < records.length; i++) {
    const company = records[i];

    // Progress updates every 100 records
    if (i > 0 && i % 100 === 0) {
      const progressPercent = 15 + Math.floor((i / records.length) * 75); // 15-90%
      console.log(`[incremental-scanner] Progress: ${i}/${records.length} ${objectLabel} evaluated, ${newPairsFound} pairs found`);

      if (job) {
        await job.updateProgress({
          phase: 'progress',
          message: `Evaluated ${i}/${records.length} ${objectLabel}...`,
          progress: progressPercent,
          pairsFound: newPairsFound,
        });
      }
    }

    // Find candidates using in-memory Map lookups (O(1) instead of DB queries)
    const candidateIds = new Set<string>();

    // Extract blocking keys from company
    const companyDomain = company.properties?.domain
      ? normalizeDomain(company.properties.domain)
      : null;
    const companyPhone = company.properties?.phone
      ? company.properties.phone.replace(/\D/g, '').slice(0, 7)
      : null;
    const companyName = company.properties?.name
      ? company.properties.name.toLowerCase().replace(/[^\w\s]/g, '').trim().slice(0, 4)
      : null;
    const companyLinkedIn = company.properties?.linkedin_company_page
      ? company.properties.linkedin_company_page.match(/linkedin\.com\/company\/([^\/\?#]+)/i)?.[1]?.toLowerCase()
      : null;

    // Skip excluded domains
    if (companyDomain && exclusions.has(companyDomain)) {
      continue;
    }

    // Domain matches (highest priority)
    if (companyDomain) {
      const matches = domainMap.get(companyDomain) || [];
      matches.forEach(id => {
        if (id !== company.id) candidateIds.add(id);
      });
    }

    // LinkedIn matches
    if (companyLinkedIn) {
      const matches = linkedinMap.get(companyLinkedIn) || [];
      matches.forEach(id => {
        if (id !== company.id) candidateIds.add(id);
      });
    }

    // Phone matches
    if (companyPhone && companyPhone.length >= 7) {
      const matches = phoneMap.get(companyPhone) || [];
      matches.forEach(id => {
        if (id !== company.id) candidateIds.add(id);
      });
    }

    // Name prefix matches (lowest priority, most candidates)
    if (companyName && companyName.length >= 4) {
      const matches = nameMap.get(companyName) || [];
      matches.forEach(id => {
        if (id !== company.id) candidateIds.add(id);
      });
    }

    // Process candidate pairs
    for (const candidateId of Array.from(candidateIds)) {
      // Create deterministic pair key (lower ID first)
      const pairKey = [company.id, candidateId].sort().join(':');

      // Skip if we've already processed this pair in this scan
      // (prevents evaluating both A-B and B-A)
      if (processedPairs.has(pairKey)) {
        continue;
      }
      processedPairs.add(pairKey);

      // Get candidate's full company data
      const candidateCompany = companyMap.get(candidateId);
      if (!candidateCompany) {
        continue; // Candidate not in current dataset
      }

      // Convert to CompanyProperties for evaluation
      const companyA: CompanyProperties = {
        name: company.properties?.name ?? null,
        domain: company.properties?.domain ?? null,
        phone: company.properties?.phone ?? null,
        industry: company.properties?.industry ?? null,
        linkedin_company_page: company.properties?.linkedin_company_page ?? null,
      };

      const companyB: CompanyProperties = {
        name: candidateCompany.properties?.name ?? null,
        domain: candidateCompany.properties?.domain ?? null,
        phone: candidateCompany.properties?.phone ?? null,
        industry: candidateCompany.properties?.industry ?? null,
        linkedin_company_page: candidateCompany.properties?.linkedin_company_page ?? null,
      };

      // Evaluate pair
      const evaluation = evaluateCompanyPair(companyA, companyB);

      // Store if confidence meets threshold (Grade C or better)
      if (evaluation.confidence >= CONFIDENCE_THRESHOLD) {
        await storePair(
          orgId,
          portalId,
          connectionId,
          company.id,
          candidateId,
          evaluation,
          objectType
        );
        newPairsFound++;
        gradeCount[evaluation.grade]++;
      }
    }
  }

  console.log(`[incremental-scanner] Pair generation complete: ${newPairsFound} pairs found`);

  if (job) {
    await job.updateProgress({
      phase: 'progress',
      message: `Building clusters from ${newPairsFound} pairs...`,
      progress: 90,
      pairsFound: newPairsFound,
    });
  }

  // Build clusters
  const allPairs = await getAllPendingPairs(orgId, portalId, objectType);
  const { count: clustersFound, clusterIds } = await buildClusters(orgId, portalId, connectionId, allPairs, objectType);

  if (job) {
    await job.updateProgress({
      phase: 'progress',
      message: `Built ${clustersFound} clusters from ${newPairsFound} pairs`,
      progress: 95,
      pairsFound: newPairsFound,
      clustersBuilt: clustersFound,
    });
  }

  // Update scan run
  const cursor = records.length > 0 ? getLatestModifiedDate(records) : new Date();
  await completeScanRun(scanRun.id, {
    recordsScanned: records.length,
    newPairsFound,
    newClustersFound: clustersFound,
    modifiedCursor: cursor,
  });

  return {
    scanType: 'full',
    recordsScanned: records.length,
    pairsFound: newPairsFound,
    clustersFound,
    newClusterIds: clusterIds,
    gradeBreakdown: gradeCount,
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
  cursor: Date,
  objectType: 'company' | 'contact' | 'deal' = 'company'
): Promise<DedupScanResult> {
  const objectLabel = objectType === 'contact' ? 'contacts' : 'companies';
  console.log(`[incremental-scanner] Starting incremental scan for ${objectLabel} in portal ${portalId} (cursor: ${cursor.toISOString()})`);

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
      gradeBreakdown: { A: 0, B: 0, C: 0, D: 0 },
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
    const allPairs = await getAllPendingPairs(orgId, portalId, objectType);
    const result = await buildClusters(orgId, portalId, connectionId, allPairs, objectType);
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
    gradeBreakdown: { A: 0, B: 0, C: 0, D: 0 }, // TODO: Track grades in incremental scans
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
  forceFullScan = false,
  objectType: 'company' | 'contact' | 'deal' = 'company',
  job?: any // Optional BullMQ job for progress updates
): Promise<DedupScanResult> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  // Determine scan type
  const lastRun = await getLastCompletedScanRun(orgId, portalId);
  const isFirstScan = !lastRun;
  const isSundayFullScan = new Date().getUTCDay() === FULL_SCAN_DAY;
  const scanType: 'full' | 'incremental' =
    isFirstScan || isSundayFullScan || forceFullScan || objectType !== 'company' ? 'full' : 'incremental';

  console.log(`[incremental-scanner] Scan type: ${scanType} (first=${isFirstScan}, sunday=${isSundayFullScan}, forced=${forceFullScan}, objectType=${objectType})`);

  // Create scan run record
  const scanRun = await createScanRun(orgId, portalId, connectionId, scanType);

  try {
    const result = scanType === 'full'
      ? await runFullScan(orgId, portalId, client, connectionId, scanRun, objectType, job)
      : await runIncrementalScan(orgId, portalId, client, connectionId, scanRun, lastRun!.modified_cursor, objectType);

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
