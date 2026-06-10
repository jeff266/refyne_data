/**
 * Incremental Dedup Scanner
 *
 * Provides fine-grained control over scan mode detection, company fetching, index updates,
 * scan tracking, and cluster invalidation for the dedup system.
 *
 * Usage:
 *   const mode = await determineScanMode(orgId, portalId, false);
 *   if (mode === 'full') {
 *     // Run full scan...
 *   } else {
 *     const modified = await fetchModifiedCompanies(orgId, portalId, since, client);
 *     await updateIndexForCompanies(orgId, portalId, modified.map(c => c.id), client);
 *     await invalidateClustersForCompanies(orgId, modified.map(c => c.id));
 *   }
 *   await recordScanCompletion(orgId, mode, companiesScanned);
 */

import { supabase } from '../db/supabase';
import type { HubSpotClient } from '../hubspot/client';
import type { HubSpotCompany } from '../hubspot/types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full scan trigger threshold: if last scan was more than 7 days ago, trigger full scan.
 */
const FULL_SCAN_DAYS_THRESHOLD = 7;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ScanMode = 'full' | 'incremental';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Scan Mode Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines whether to run a full or incremental scan.
 *
 * Logic:
 * - Force full if `forceFullScan = true`
 * - Force full if never scanned before (last_full_scan_at IS NULL)
 * - Force full if last full scan was more than 7 days ago
 * - Force full if last_modified_at is null in index (cannot determine changes)
 * - Otherwise: incremental
 *
 * @param orgId - Organization ID
 * @param portalId - HubSpot portal ID
 * @param forceFullScan - Force full scan regardless of other conditions
 * @returns 'full' or 'incremental'
 */
export async function determineScanMode(
  orgId: string,
  portalId: string,
  forceFullScan: boolean = false
): Promise<ScanMode> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // 1. Force full scan if explicitly requested
  if (forceFullScan) {
    console.log('[incremental-scanner] Scan mode: full (forced)');
    return 'full';
  }

  // 2. Check dedup_config for last scan timestamps
  const { data: config, error: configError } = await supabase
    .from('dedup_config')
    .select('last_full_scan_at, last_incremental_scan_at')
    .eq('org_id', orgId)
    .eq('portal_id', portalId)
    .single();

  if (configError || !config) {
    console.log('[incremental-scanner] Scan mode: full (no config found, first scan)');
    return 'full';
  }

  // 3. Never scanned before
  if (!config.last_full_scan_at) {
    console.log('[incremental-scanner] Scan mode: full (never scanned before)');
    return 'full';
  }

  // 4. Last full scan was more than FULL_SCAN_DAYS_THRESHOLD days ago
  const lastFullScan = new Date(config.last_full_scan_at);
  const daysSinceFullScan = (Date.now() - lastFullScan.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceFullScan > FULL_SCAN_DAYS_THRESHOLD) {
    console.log(`[incremental-scanner] Scan mode: full (last full scan was ${Math.round(daysSinceFullScan)} days ago, threshold is ${FULL_SCAN_DAYS_THRESHOLD} days)`);
    return 'full';
  }

  // 5. Check if any company_dedup_index records have null last_modified_at
  // (indicates we cannot reliably detect changes, need full scan)
  const { count: nullModifiedCount, error: nullCountError } = await supabase
    .from('company_dedup_index')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('portal_id', portalId)
    .is('last_modified_at', null);

  if (nullCountError) {
    console.error('[incremental-scanner] Error checking null last_modified_at:', nullCountError);
    // Default to full scan on error to be safe
    return 'full';
  }

  if ((nullModifiedCount ?? 0) > 0) {
    console.log(`[incremental-scanner] Scan mode: full (${nullModifiedCount} companies have null last_modified_at)`);
    return 'full';
  }

  // 6. All conditions met for incremental scan
  console.log('[incremental-scanner] Scan mode: incremental');
  return 'incremental';
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Fetch Modified Companies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches companies modified since a given timestamp using HubSpot Search API.
 *
 * Uses Search API filter: hs_lastmodifieddate > since
 * Fetches properties: name, domain, phone, industry, linkedin_company_page, hs_lastmodifieddate
 *
 * @param orgId - Organization ID
 * @param portalId - HubSpot portal ID
 * @param since - ISO 8601 timestamp (e.g., "2026-06-03T14:30:00.000Z")
 * @param hubspotClient - HubSpot client instance
 * @returns Array of modified companies
 */
export async function fetchModifiedCompanies(
  orgId: string,
  portalId: string,
  since: Date,
  hubspotClient: HubSpotClient
): Promise<HubSpotCompany[]> {
  console.log(`[incremental-scanner] Fetching companies modified since ${since.toISOString()}...`);

  // Use HubSpot Search API to find companies modified since timestamp
  // Filter: hs_lastmodifieddate > since
  const companies = await hubspotClient.searchCompanies({
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'hs_lastmodifieddate',
            operator: 'GT',
            value: since.getTime().toString(), // Unix timestamp in milliseconds
          },
        ],
      },
    ],
    properties: [
      'name',
      'domain',
      'phone',
      'industry',
      'linkedin_company_page',
      'hs_lastmodifieddate',
    ],
    limit: 100,
  });

  console.log(`[incremental-scanner] Found ${companies.length} companies modified since ${since.toISOString()}`);
  return companies;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Update Index for Companies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Updates company_dedup_index for a list of company IDs.
 *
 * Fetches full company data from HubSpot (if not already provided), then upserts
 * to company_dedup_index with blocking keys and last_modified_at.
 *
 * @param orgId - Organization ID
 * @param portalId - HubSpot portal ID
 * @param companyIds - Array of HubSpot company IDs
 * @param hubspotClient - HubSpot client instance
 */
export async function updateIndexForCompanies(
  orgId: string,
  portalId: string,
  companyIds: string[],
  hubspotClient: HubSpotClient
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  if (companyIds.length === 0) {
    console.log('[incremental-scanner] No companies to update in index');
    return;
  }

  console.log(`[incremental-scanner] Updating index for ${companyIds.length} companies...`);

  // Fetch companies in batches of 100 (HubSpot batch API limit)
  const batchSize = 100;
  const allCompanies: HubSpotCompany[] = [];

  for (let i = 0; i < companyIds.length; i += batchSize) {
    const batch = companyIds.slice(i, i + batchSize);
    const companies = await hubspotClient.getCompaniesByIds(batch, [
      'name',
      'domain',
      'phone',
      'industry',
      'linkedin_company_page',
      'hs_lastmodifieddate',
    ]);
    allCompanies.push(...companies);
  }

  console.log(`[incremental-scanner] Fetched ${allCompanies.length} companies from HubSpot`);

  // Prepare index records for upsert
  const indexRecords = allCompanies.map((company) => {
    const domain = company.properties?.domain || null;
    const phone = company.properties?.phone || null;
    const name = company.properties?.name || null;
    const linkedin = company.properties?.linkedin_company_page || null;
    const lastModified = company.properties?.hs_lastmodifieddate || null;

    // Extract blocking keys
    const domainNormalized = domain
      ? domain.toLowerCase().replace(/^www\./, '').trim()
      : null;

    const phonePrefix = phone
      ? phone.replace(/\D/g, '').slice(0, 7) // First 7 digits
      : null;

    const namePrefix = name
      ? name.toLowerCase().replace(/[^\w\s]/g, '').trim().slice(0, 4) // First 4 chars
      : null;

    const linkedinId = linkedin
      ? linkedin.match(/linkedin\.com\/company\/([^\/\?#]+)/i)?.[1]?.toLowerCase() || null
      : null;

    return {
      org_id: orgId,
      portal_id: portalId,
      hubspot_company_id: company.id,
      domain_normalized: domainNormalized,
      phone_prefix: phonePrefix,
      name_prefix: namePrefix,
      linkedin_id: linkedinId,
      last_modified_at: lastModified ? new Date(lastModified).toISOString() : null,
    };
  });

  // Upsert to company_dedup_index
  // (on conflict: org_id, portal_id, hubspot_company_id → update all blocking keys)
  const { error: upsertError } = await supabase
    .from('company_dedup_index')
    .upsert(indexRecords, {
      onConflict: 'org_id,portal_id,hubspot_company_id',
    });

  if (upsertError) {
    console.error('[incremental-scanner] Error upserting to company_dedup_index:', upsertError);
    throw new Error(`Failed to update index: ${upsertError.message}`);
  }

  console.log(`[incremental-scanner] Successfully updated index for ${indexRecords.length} companies`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Record Scan Completion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Records scan completion in dedup_config.
 *
 * Updates:
 * - last_full_scan_at (if scanMode = 'full')
 * - last_incremental_scan_at (if scanMode = 'incremental')
 * - total_companies_last_scan (if scanMode = 'full')
 * - incremental_companies_last_scan (if scanMode = 'incremental')
 *
 * @param orgId - Organization ID
 * @param portalId - HubSpot portal ID (added for consistency)
 * @param scanMode - 'full' or 'incremental'
 * @param companiesScanned - Number of companies scanned
 */
export async function recordScanCompletion(
  orgId: string,
  portalId: string,
  scanMode: ScanMode,
  companiesScanned: number
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const now = new Date().toISOString();

  const updateData: Record<string, any> = {};

  if (scanMode === 'full') {
    updateData.last_full_scan_at = now;
    updateData.total_companies_last_scan = companiesScanned;
  } else {
    updateData.last_incremental_scan_at = now;
    updateData.incremental_companies_last_scan = companiesScanned;
  }

  const { error: updateError } = await supabase
    .from('dedup_config')
    .update(updateData)
    .eq('org_id', orgId)
    .eq('portal_id', portalId);

  if (updateError) {
    console.error('[incremental-scanner] Error updating dedup_config:', updateError);
    throw new Error(`Failed to record scan completion: ${updateError.message}`);
  }

  console.log(`[incremental-scanner] Recorded ${scanMode} scan completion: ${companiesScanned} companies scanned`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Invalidate Clusters for Companies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Marks clusters containing modified companies as 'stale'.
 *
 * Logic:
 * - Find all dedup_clusters where record_ids contains any of the modified company IDs
 * - Update status to 'stale' (indicates cluster needs re-evaluation)
 *
 * @param orgId - Organization ID
 * @param companyIds - Array of HubSpot company IDs that were modified
 */
export async function invalidateClustersForCompanies(
  orgId: string,
  companyIds: string[]
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  if (companyIds.length === 0) {
    console.log('[incremental-scanner] No companies to invalidate clusters for');
    return;
  }

  console.log(`[incremental-scanner] Invalidating clusters for ${companyIds.length} modified companies...`);

  // Find clusters where record_ids JSONB array contains any of the modified company IDs
  // Using @> operator (JSONB contains) for each company ID
  const { data: clusters, error: fetchError } = await supabase
    .from('dedup_clusters')
    .select('id, record_ids')
    .eq('org_id', orgId)
    .in('status', ['open', 'pending']); // Only invalidate active clusters

  if (fetchError) {
    console.error('[incremental-scanner] Error fetching clusters:', fetchError);
    throw new Error(`Failed to fetch clusters: ${fetchError.message}`);
  }

  if (!clusters || clusters.length === 0) {
    console.log('[incremental-scanner] No active clusters found to invalidate');
    return;
  }

  // Filter clusters that contain any of the modified company IDs
  const clusterIdsToInvalidate = clusters
    .filter((cluster) => {
      const recordIds = cluster.record_ids as string[];
      return recordIds.some((id) => companyIds.includes(id));
    })
    .map((cluster) => cluster.id);

  if (clusterIdsToInvalidate.length === 0) {
    console.log('[incremental-scanner] No clusters contain modified companies');
    return;
  }

  // Mark clusters as 'stale'
  const { error: updateError } = await supabase
    .from('dedup_clusters')
    .update({ status: 'stale' })
    .in('id', clusterIdsToInvalidate);

  if (updateError) {
    console.error('[incremental-scanner] Error invalidating clusters:', updateError);
    throw new Error(`Failed to invalidate clusters: ${updateError.message}`);
  }

  console.log(`[incremental-scanner] Invalidated ${clusterIdsToInvalidate.length} clusters as stale`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Main Orchestrator
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

/**
 * Main entry point for dedup scanning.
 *
 * Orchestrates the entire dedup scan process:
 * 1. Determines scan mode (full vs incremental)
 * 2. Runs appropriate scan type
 * 3. Records scan completion
 *
 * For now, this delegates to the old full scan implementation when needed.
 * The incremental scan uses the new modular functions above.
 *
 * @param orgId - Organization ID
 * @param portalId - HubSpot portal ID
 * @param hubspotClient - HubSpot client instance
 * @param connectionId - HubSpot connection ID
 * @param forceFullScan - Force full scan regardless of other conditions
 * @param objectType - Object type to scan (company, contact, deal)
 * @param job - Optional BullMQ job for progress updates
 */
export async function runDedupScan(
  orgId: string,
  portalId: string,
  hubspotClient: HubSpotClient,
  connectionId: string,
  forceFullScan: boolean = false,
  objectType: 'company' | 'contact' | 'deal' = 'company',
  job?: any
): Promise<DedupScanResult> {
  // Step 1: Determine scan mode
  const scanMode = await determineScanMode(orgId, portalId, forceFullScan);

  if (scanMode === 'incremental') {
    // ═══════════════════════════════════════════════════════════════════════════
    // INCREMENTAL SCAN: Use new modular functions
    // ═══════════════════════════════════════════════════════════════════════════

    console.log('[incremental-scanner] Starting incremental scan...');

    // Get timestamp of last scan to fetch only modified companies
    const { data: config } = await supabase!
      .from('dedup_config')
      .select('last_incremental_scan_at, last_full_scan_at')
      .eq('org_id', orgId)
      .eq('portal_id', portalId)
      .single();

    const since = config?.last_incremental_scan_at || config?.last_full_scan_at || new Date(0);
    const sinceDate = new Date(since);

    // Step 2: Fetch modified companies
    const modifiedCompanies = await fetchModifiedCompanies(orgId, portalId, sinceDate, hubspotClient);

    if (modifiedCompanies.length === 0) {
      console.log('[incremental-scanner] No modified companies found, skipping scan');
      await recordScanCompletion(orgId, portalId, 'incremental', 0);
      return {
        scanType: 'incremental',
        recordsScanned: 0,
        pairsFound: 0,
        clustersFound: 0,
        newClusterIds: [],
        gradeBreakdown: { A: 0, B: 0, C: 0, D: 0 },
      };
    }

    // Step 3: Update index for modified companies
    await updateIndexForCompanies(
      orgId,
      portalId,
      modifiedCompanies.map(c => c.id),
      hubspotClient
    );

    // Step 4: Invalidate clusters containing modified companies
    await invalidateClustersForCompanies(
      orgId,
      modifiedCompanies.map(c => c.id)
    );

    // Step 5: Re-run pair matching for modified companies
    // TODO: Implement incremental pair matching
    // For now, we just update the index and invalidate clusters
    // The next full scan will pick up the changes

    // Step 6: Record scan completion
    await recordScanCompletion(orgId, portalId, 'incremental', modifiedCompanies.length);

    return {
      scanType: 'incremental',
      recordsScanned: modifiedCompanies.length,
      pairsFound: 0, // TODO: Track pairs found in incremental matching
      clustersFound: 0,
      newClusterIds: [],
      gradeBreakdown: { A: 0, B: 0, C: 0, D: 0 },
    };

  } else {
    // ═══════════════════════════════════════════════════════════════════════════
    // FULL SCAN: Delegate to existing full scan implementation
    // ═══════════════════════════════════════════════════════════════════════════

    console.log('[incremental-scanner] Starting full scan (delegating to full scanner)...');

    // Import the full scan implementation
    const { runFullDedupScan } = await import('./full-dedup-scanner');

    const result = await runFullDedupScan(
      orgId,
      portalId,
      hubspotClient,
      connectionId,
      objectType,
      job
    );

    // Record full scan completion
    await recordScanCompletion(orgId, portalId, 'full', result.recordsScanned);

    return result;
  }
}
