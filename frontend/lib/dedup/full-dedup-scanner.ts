/**
 * Full Dedup Scanner
 *
 * Handles complete dedup scans of all companies in a portal.
 * Called by incremental-scanner.ts when a full scan is needed.
 */

import { supabase } from '../db/supabase';
import type { HubSpotClient } from '../hubspot/client';
import { evaluateCompanyPair, normalizeDomain, type CompanyProperties } from './company-signals';
import type { PairGrade } from './types';
import { UnionFind } from './union-find';
import type { DedupScanResult } from './incremental-scanner';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 65;

const EXCLUDED_DOMAINS = [
  'hhs.gov', 'cms.gov', 'cdc.gov', 'nih.gov', 'medicare.gov',
  'medicaid.gov', 'va.gov', 'samhsa.gov',
  'google.com', 'microsoft.com', 'apple.com', 'amazon.com',
  'linkedin.com', 'facebook.com', 'twitter.com',
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

async function getDomainExclusionSet(orgId: string): Promise<Set<string>> {
  if (!supabase) return new Set();

  const { data, error } = await supabase
    .from('dedup_domain_exclusions')
    .select('domain')
    .eq('org_id', orgId);

  if (error) {
    console.error('[full-dedup-scanner] Failed to fetch domain exclusions:', error);
    return new Set();
  }

  return new Set(data.map((row) => row.domain));
}

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
      { onConflict: 'org_id,object_type,record_a_id,record_b_id' }
    )
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to store pair: ${error?.message}`);
  }

  return { id: data.id };
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
    console.error('[full-dedup-scanner] Failed to fetch pending pairs:', error);
    return [];
  }

  return data as Array<{ id: string; record_a_id: string; record_b_id: string; grade: PairGrade }>;
}

async function buildClusters(
  orgId: string,
  portalId: string,
  connectionId: string,
  pairs: Array<{ id: string; record_a_id: string; record_b_id: string; grade: PairGrade }>,
  objectType: 'company' | 'contact' | 'deal' = 'company'
): Promise<{ count: number; clusterIds: string[] }> {
  if (!supabase || pairs.length === 0) return { count: 0, clusterIds: [] };

  // Clear existing clusters for this portal AND object type
  const { data: clustersToDelete } = await supabase
    .from('dedup_clusters')
    .select('id')
    .eq('org_id', orgId)
    .eq('portal_id', portalId)
    .eq('object_type', objectType);

  const clusterIdsToDelete = (clustersToDelete || []).map(c => c.id);

  if (clusterIdsToDelete.length > 0) {
    await supabase
      .from('dedup_decisions')
      .delete()
      .in('cluster_id', clusterIdsToDelete);

    await supabase
      .from('dedup_pairs')
      .update({ cluster_id: null })
      .in('cluster_id', clusterIdsToDelete);
  }

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
  console.log(`[full-dedup-scanner] Built ${clusters.length} clusters from ${pairs.length} pairs`);

  const clusterIds: string[] = [];

  // Insert cluster rows
  for (const recordIds of clusters) {
    const root = uf.find(recordIds[0]);
    const clusterPairs = pairsByCluster.get(root) || [];

    const gradeOrder: PairGrade[] = ['A', 'B', 'C', 'D'];
    let clusterGrade: PairGrade = 'D';
    for (const grade of gradeOrder) {
      if (clusterPairs.some((p) => p.grade === grade)) {
        clusterGrade = grade;
        break;
      }
    }

    const { data: cluster, error: clusterError } = await supabase
      .from('dedup_clusters')
      .insert({
        org_id: orgId,
        portal_id: portalId,
        connection_id: connectionId,
        grade: clusterGrade,
        record_ids: recordIds,
        pair_ids: clusterPairs.map((p) => p.id),
        status: 'open',
        object_type: objectType,
      })
      .select('id')
      .single();

    if (clusterError || !cluster) {
      console.error('[full-dedup-scanner] Failed to insert cluster:', clusterError);
      continue;
    }

    clusterIds.push(cluster.id);

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
// Main Full Scan Function
// ─────────────────────────────────────────────────────────────────────────────

export async function runFullDedupScan(
  orgId: string,
  portalId: string,
  hubspotClient: HubSpotClient,
  connectionId: string,
  objectType: 'company' | 'contact' | 'deal' = 'company',
  job?: any
): Promise<DedupScanResult> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  console.log(`[full-dedup-scanner] Starting full scan for ${objectType} in portal ${portalId}`);

  // Step 1: Fetch all companies/contacts/deals
  const properties = objectType === 'contact'
    ? ['firstname', 'lastname', 'email', 'phone', 'mobilephone', 'company', 'hs_lastmodifieddate'] as const
    : ['name', 'domain', 'phone', 'industry', 'linkedin_company_page', 'hs_lastmodifieddate'] as const;

  const records: any[] = [];
  for await (const batch of hubspotClient.getAllRecords(objectType as 'company' | 'contact', properties)) {
    records.push(...batch);
  }

  console.log(`[full-dedup-scanner] Fetched ${records.length} ${objectType} records`);

  if (job) {
    await job.updateProgress({
      phase: 'progress',
      message: `Fetched ${records.length} records, building index...`,
      progress: 5,
      pairsFound: 0,
    });
  }

  // Step 2: Build index and candidate maps
  const companyMap = new Map(records.map((c) => [c.id, c]));
  const exclusions = await getDomainExclusionSet(orgId);

  // Build in-memory blocking key maps
  const domainMap = new Map<string, string[]>();
  const phoneMap = new Map<string, string[]>();
  const nameMap = new Map<string, string[]>();
  const linkedinMap = new Map<string, string[]>();

  for (const record of records) {
    const domain = record.properties?.domain || null;
    const phone = record.properties?.phone || null;
    const name = record.properties?.name || null;
    const linkedin = record.properties?.linkedin_company_page || null;

    if (domain) {
      const normalized = normalizeDomain(domain);
      if (normalized && !EXCLUDED_DOMAINS.includes(normalized)) {
        const existing = domainMap.get(normalized) || [];
        domainMap.set(normalized, [...existing, record.id]);
      }
    }

    if (phone) {
      const phonePrefix = phone.replace(/\D/g, '').slice(0, 7);
      if (phonePrefix.length >= 7) {
        const existing = phoneMap.get(phonePrefix) || [];
        phoneMap.set(phonePrefix, [...existing, record.id]);
      }
    }

    if (name) {
      const namePrefix = name.toLowerCase().replace(/[^\w\s]/g, '').trim().slice(0, 4);
      if (namePrefix.length >= 4) {
        const existing = nameMap.get(namePrefix) || [];
        nameMap.set(namePrefix, [...existing, record.id]);
      }
    }

    if (linkedin) {
      const linkedinId = linkedin.match(/linkedin\.com\/company\/([^\/\?#]+)/i)?.[1]?.toLowerCase();
      if (linkedinId) {
        const existing = linkedinMap.get(linkedinId) || [];
        linkedinMap.set(linkedinId, [...existing, record.id]);
      }
    }
  }

  console.log(`[full-dedup-scanner] Built blocking key maps`);

  // Step 3: Clear old pairs for idempotent full scan
  console.log('[full-dedup-scanner] Clearing old pairs...');
  await supabase
    .from('dedup_pairs')
    .delete()
    .eq('org_id', orgId)
    .eq('portal_id', portalId)
    .eq('object_type', objectType);

  // Step 4: Generate and evaluate pairs
  let newPairsFound = 0;
  const processedPairs = new Set<string>();
  const gradeCount = { A: 0, B: 0, C: 0, D: 0 };

  console.log(`[full-dedup-scanner] Evaluating candidates for ${records.length} records...`);

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    if (i > 0 && i % 100 === 0) {
      const progressPercent = 15 + Math.floor((i / records.length) * 75);
      console.log(`[full-dedup-scanner] Progress: ${i}/${records.length} records evaluated, ${newPairsFound} pairs found`);

      if (job) {
        await job.updateProgress({
          phase: 'progress',
          message: `Evaluated ${i}/${records.length} records...`,
          progress: progressPercent,
          pairsFound: newPairsFound,
        });
      }
    }

    // Find candidates using blocking keys
    const candidateIds = new Set<string>();

    const domain = record.properties?.domain ? normalizeDomain(record.properties.domain) : null;
    const phone = record.properties?.phone ? record.properties.phone.replace(/\D/g, '').slice(0, 7) : null;
    const name = record.properties?.name ? record.properties.name.toLowerCase().replace(/[^\w\s]/g, '').trim().slice(0, 4) : null;
    const linkedin = record.properties?.linkedin_company_page?.match(/linkedin\.com\/company\/([^\/\?#]+)/i)?.[1]?.toLowerCase() ?? null;

    if (domain && !exclusions.has(domain) && !EXCLUDED_DOMAINS.includes(domain)) {
      const matches = domainMap.get(domain) || [];
      matches.forEach(id => { if (id !== record.id) candidateIds.add(id); });
    }

    if (linkedin) {
      const matches = linkedinMap.get(linkedin) || [];
      matches.forEach(id => { if (id !== record.id) candidateIds.add(id); });
    }

    if (phone && phone.length >= 7) {
      const matches = phoneMap.get(phone) || [];
      matches.forEach(id => { if (id !== record.id) candidateIds.add(id); });
    }

    if (name && name.length >= 4) {
      const matches = nameMap.get(name) || [];
      matches.forEach(id => { if (id !== record.id) candidateIds.add(id); });
    }

    // Evaluate candidate pairs
    for (const candidateId of Array.from(candidateIds)) {
      const pairKey = [record.id, candidateId].sort().join(':');
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const candidate = companyMap.get(candidateId);
      if (!candidate) continue;

      // Convert to CompanyProperties for evaluation
      const recordProps: CompanyProperties = {
        name: record.properties?.name ?? null,
        domain: record.properties?.domain ?? null,
        phone: record.properties?.phone ?? null,
        industry: record.properties?.industry ?? null,
        linkedin_company_page: record.properties?.linkedin_company_page ?? null,
      };

      const candidateProps: CompanyProperties = {
        name: candidate.properties?.name ?? null,
        domain: candidate.properties?.domain ?? null,
        phone: candidate.properties?.phone ?? null,
        industry: candidate.properties?.industry ?? null,
        linkedin_company_page: candidate.properties?.linkedin_company_page ?? null,
      };

      const evaluation = evaluateCompanyPair(recordProps, candidateProps);

      if (evaluation.confidence >= CONFIDENCE_THRESHOLD) {
        await storePair(orgId, portalId, connectionId, record.id, candidateId, evaluation, objectType);
        newPairsFound++;
        gradeCount[evaluation.grade]++;
      }
    }
  }

  console.log(`[full-dedup-scanner] Pair generation complete: ${newPairsFound} pairs found`);

  if (job) {
    await job.updateProgress({
      phase: 'progress',
      message: `Building clusters from ${newPairsFound} pairs...`,
      progress: 90,
      pairsFound: newPairsFound,
    });
  }

  // Step 5: Build clusters
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

  return {
    scanType: 'full',
    recordsScanned: records.length,
    pairsFound: newPairsFound,
    clustersFound,
    newClusterIds: clusterIds,
    gradeBreakdown: gradeCount,
  };
}
