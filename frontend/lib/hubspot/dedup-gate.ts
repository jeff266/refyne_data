/**
 * Dedup Gate
 *
 * Checks for potential duplicate records before writing to HubSpot.
 * Uses domain as primary blocking key with name fuzzy matching.
 * Weights and thresholds are loaded from org's dedup_settings table.
 * Supports parent-child company hierarchy awareness per DEDUPE_PRD_ADDENDUM.md.
 */

import type { RawRecord } from '../mcp/types';
import type { HubSpotCompany } from './types';
import type { DedupGateResult, DedupAction, ReviewQueueItem } from './write-types';
import type { HubSpotClient, CompanyIndex } from './client';
import type { DedupFieldWeights } from '../db/types';
import { getDedupSettings, getDefaultDedupSettings } from '../db/settings-repository';
import { similarity, extractDomain } from '../harmonies/runtime/builtins';
import { supabase } from '../db/supabase';

/**
 * Default field weights per PRD.
 * Used when no org-specific settings exist.
 */
const DEFAULT_FIELD_WEIGHTS: DedupFieldWeights = {
  domain: 0.50,
  name: 0.25,
  phone: 0.10,
  industry: 0.08,
  employee_band: 0.07,
};

/**
 * Default thresholds per PRD.
 */
const DEFAULT_THRESHOLDS = {
  auto_merge: 0.90,
  review_min: 0.60,
};

// In-memory review queue (could be persisted to database)
const reviewQueue: Map<string, ReviewQueueItem> = new Map();

// In-memory suppressions (could be persisted to database)
const suppressions: Map<string, DedupSuppression> = new Map();

/**
 * Parent-child relationship check result.
 */
export type ParentCheckResult =
  | { type: 'directly_linked' }      // A is parent of B or B is parent of A
  | { type: 'sibling' }              // A and B have different parents
  | { type: 'same_parent' }          // A and B share the same parent
  | { type: 'one_has_parent' }       // only one has a parent
  | { type: 'no_hierarchy' };        // neither has a parent configured

/**
 * Dedup suppression entry.
 */
export interface DedupSuppression {
  id: string;
  orgId: string;
  recordIdA: string;
  recordIdB: string;
  reason: 'parent_child' | 'not_duplicate';
  permanent: boolean;
  createdAt: string;
}

/**
 * Check parent-child relationship between two companies.
 *
 * @param idA - First company HubSpot ID
 * @param idB - Second company HubSpot ID
 * @param index - Company index with parent associations
 * @returns ParentCheckResult indicating the relationship type
 */
export function checkParentRelationship(
  idA: string,
  idB: string,
  index: CompanyIndex
): ParentCheckResult {
  const parentOfA = index.parentIndex.get(idA);
  const parentOfB = index.parentIndex.get(idB);

  // Check if directly linked (A is parent of B or B is parent of A)
  if (parentOfA === idB || parentOfB === idA) {
    return { type: 'directly_linked' };
  }

  const aHasParent = parentOfA !== undefined;
  const bHasParent = parentOfB !== undefined;

  // Neither has a parent configured
  if (!aHasParent && !bHasParent) {
    return { type: 'no_hierarchy' };
  }

  // Only one has a parent
  if (aHasParent !== bHasParent) {
    return { type: 'one_has_parent' };
  }

  // Both have parents - check if same or different
  if (parentOfA === parentOfB) {
    return { type: 'same_parent' };
  }

  // Different parents = siblings in different corporate families
  return { type: 'sibling' };
}

/**
 * Add a suppression entry for parent-child pairs.
 */
export function addSuppression(
  orgId: string,
  recordIdA: string,
  recordIdB: string,
  reason: 'parent_child' | 'not_duplicate',
  permanent: boolean
): string {
  const id = `suppress_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Normalize order to avoid duplicate entries
  const [first, second] = [recordIdA, recordIdB].sort();

  const key = `${orgId}:${first}:${second}`;

  suppressions.set(key, {
    id,
    orgId,
    recordIdA: first,
    recordIdB: second,
    reason,
    permanent,
    createdAt: new Date().toISOString(),
  });

  return id;
}

/**
 * Check if a pair is suppressed.
 */
export function isSuppressionActive(
  orgId: string,
  recordIdA: string,
  recordIdB: string
): boolean {
  const [first, second] = [recordIdA, recordIdB].sort();
  const key = `${orgId}:${first}:${second}`;
  return suppressions.has(key);
}

/**
 * Get all suppressions for an org.
 */
export function getSuppressions(orgId: string): DedupSuppression[] {
  return Array.from(suppressions.values())
    .filter(s => s.orgId === orgId);
}

/**
 * Create a dedup cluster from webhook event.
 * Bridges webhook dedup detection to the database-backed cluster system.
 *
 * @param orgId - Organization ID
 * @param companyIdA - First company HubSpot ID (usually the existing record)
 * @param companyIdB - Second company HubSpot ID (usually the incoming/new record)
 * @param confidence - Similarity score (0-1, will be converted to 0-100)
 * @param signals - Array of signal types that matched (e.g., ['domain', 'name', 'phone'])
 * @param source - Source of detection ('webhook' or 'scanner')
 * @returns Cluster ID if created, null if creation failed
 */
export async function createDedupClusterFromWebhook(
  orgId: string,
  companyIdA: string,
  companyIdB: string,
  confidence: number,
  signals: string[],
  source: 'webhook' | 'scanner' = 'webhook'
): Promise<string | null> {
  if (!supabase) {
    console.warn('Supabase not configured - cannot create dedup cluster');
    return null;
  }

  try {
    // Convert 0-1 confidence to 0-100 scale
    const confidenceScore = Math.round(confidence * 100);

    // Determine grade based on confidence
    let grade: 'A' | 'B' | 'C' | 'D';
    if (confidenceScore >= 97) grade = 'A';
    else if (confidenceScore >= 85) grade = 'B';
    else if (confidenceScore >= 70) grade = 'C';
    else grade = 'D';

    // Create the pair first
    const { data: pair, error: pairError } = await supabase
      .from('dedup_pairs')
      .insert({
        org_id: orgId,
        company_a: companyIdA,
        company_b: companyIdB,
        confidence: confidenceScore,
        grade,
        signals_fired: signals.map(s => ({ type: s })), // Simplified signal format
        source,
        reviewed: false,
      })
      .select('id')
      .single();

    if (pairError || !pair) {
      console.error('Failed to create dedup pair:', pairError);
      return null;
    }

    // Create a cluster containing just this pair
    const { data: cluster, error: clusterError } = await supabase
      .from('dedup_clusters')
      .insert({
        org_id: orgId,
        companies: [companyIdA, companyIdB],
        pair_ids: [pair.id],
        confidence: confidenceScore,
        grade,
        status: 'open',
        detected_via: source,
      })
      .select('id')
      .single();

    if (clusterError || !cluster) {
      console.error('Failed to create dedup cluster:', clusterError);
      return null;
    }

    console.log(`Created dedup cluster ${cluster.id} from ${source} (${grade} grade, ${confidenceScore}% confidence)`);
    return cluster.id;
  } catch (error) {
    console.error('Error creating dedup cluster:', error);
    return null;
  }
}

/**
 * Run dedup gate for a single record.
 *
 * @param record - Normalized record to check
 * @param client - HubSpot API client
 * @param orgId - Organization ID for loading settings (optional, uses defaults if not provided)
 * @param companyIndex - Pre-fetched company index for O(1) lookups (optional, falls back to API calls)
 * @returns DedupGateResult with action and match info
 */
export async function checkDedupGate(
  record: RawRecord,
  client: HubSpotClient,
  orgId?: string,
  companyIndex?: CompanyIndex
): Promise<DedupGateResult> {
  // Load org-specific settings or use defaults
  const settings = orgId
    ? await getDedupSettings(orgId)
    : getDefaultDedupSettings();

  const thresholds = settings.thresholds || DEFAULT_THRESHOLDS;
  const weights = settings.field_weights || DEFAULT_FIELD_WEIGHTS;

  const hasHubSpotId = !!record._hubspot_id;

  // Case 1: Record has _hubspot_id (from previous read)
  if (hasHubSpotId) {
    // Still check for other potential duplicates to surface warnings
    const duplicates = await findPotentialDuplicates(record, client, companyIndex);

    // Filter out the record itself
    const otherMatches = duplicates.filter(d => d.id !== record._hubspot_id);

    if (otherMatches.length > 0) {
      const bestMatch = findBestMatch(record, otherMatches, weights);

      if (bestMatch && bestMatch.score >= thresholds.review_min) {
        // Check parent-child relationship if index is available
        if (companyIndex) {
          const parentCheck = checkParentRelationship(
            record._hubspot_id as string,
            bestMatch.record.id,
            companyIndex
          );

          // Suppress parent-child warnings
          if (parentCheck.type === 'directly_linked') {
            // Don't warn about parent-child relationships
            return {
              action: 'upsert',
              targetHubSpotId: record._hubspot_id as string,
              similarityScore: null,
              fieldComparison: null,
              matchedRecord: null,
            };
          }
        }

        // Surface as warning, but proceed with upsert
        return {
          action: 'upsert',
          targetHubSpotId: record._hubspot_id as string,
          similarityScore: bestMatch.score,
          fieldComparison: bestMatch.fieldComparison,
          matchedRecord: bestMatch.record.properties,
          warning: `Potential duplicate found: ${bestMatch.record.properties.name} (${(bestMatch.score * 100).toFixed(0)}% similar)`,
        };
      }
    }

    return {
      action: 'upsert',
      targetHubSpotId: record._hubspot_id as string,
      similarityScore: null,
      fieldComparison: null,
      matchedRecord: null,
    };
  }

  // Case 2: No _hubspot_id - full dedup check
  const duplicates = await findPotentialDuplicates(record, client, companyIndex);

  if (duplicates.length === 0) {
    return {
      action: 'insert',
      targetHubSpotId: null,
      similarityScore: null,
      fieldComparison: null,
      matchedRecord: null,
    };
  }

  // Find best match
  const bestMatch = findBestMatch(record, duplicates, weights);

  if (!bestMatch) {
    return {
      action: 'insert',
      targetHubSpotId: null,
      similarityScore: null,
      fieldComparison: null,
      matchedRecord: null,
    };
  }

  // Check parent-child relationship if index is available
  // If matched company is a child (has a parent), suppress to avoid
  // accidentally updating a subsidiary when we should be creating a parent record
  if (companyIndex) {
    const matchedId = bestMatch.record.id;
    const matchedIsChild = companyIndex.childSet.has(matchedId);
    const matchedParentId = companyIndex.parentIndex.get(matchedId);

    if (matchedIsChild && matchedParentId) {
      // The matched company is a child of another company
      // Suppress this write - the incoming record might actually belong to the parent
      addSuppression(
        orgId || 'default',
        record._id as string,
        matchedId,
        'parent_child',
        true
      );

      return {
        action: 'skip',
        targetHubSpotId: matchedId,
        similarityScore: bestMatch.score,
        fieldComparison: bestMatch.fieldComparison,
        matchedRecord: bestMatch.record.properties,
        warning: `Parent-child suppression: matched company ${matchedId} is a child of ${matchedParentId}. Manual review required.`,
      };
    }

    // Also check if the incoming record has a _hubspot_id and check relationship
    if (record._hubspot_id) {
      const parentCheck = checkParentRelationship(
        record._hubspot_id as string,
        matchedId,
        companyIndex
      );

      const parentResult = applyParentCheckResult(
        parentCheck,
        bestMatch,
        orgId || 'default',
        record._hubspot_id as string
      );

      if (parentResult) {
        return parentResult;
      }
    }
  }

  // Apply threshold logic (no parent-child relationship)
  // Note: Previously, scores >= 90% would auto-merge silently.
  // Now all matches >= review_min go to cluster system for manual review or scheduled auto-merge.
  if (bestMatch.score >= thresholds.review_min) {
    return {
      action: 'review',
      targetHubSpotId: bestMatch.record.id,
      similarityScore: bestMatch.score,
      fieldComparison: bestMatch.fieldComparison,
      matchedRecord: bestMatch.record.properties,
    };
  }

  // Below threshold - treat as new
  return {
    action: 'insert',
    targetHubSpotId: null,
    similarityScore: bestMatch.score,
    fieldComparison: bestMatch.fieldComparison,
    matchedRecord: bestMatch.record.properties,
  };
}

/**
 * Apply parent-child check result to determine action.
 * Returns null if no special handling is needed (no_hierarchy case).
 */
function applyParentCheckResult(
  parentCheck: ParentCheckResult,
  bestMatch: {
    record: HubSpotCompany;
    score: number;
    fieldComparison: Record<string, { incoming: unknown; existing: unknown; similarity: number }>;
  },
  orgId: string,
  incomingId: string
): DedupGateResult | null {
  switch (parentCheck.type) {
    case 'directly_linked':
      // Add permanent suppression
      addSuppression(orgId, incomingId, bestMatch.record.id, 'parent_child', true);
      return {
        action: 'skip' as DedupAction,
        targetHubSpotId: null,
        similarityScore: 0.0,
        fieldComparison: bestMatch.fieldComparison,
        matchedRecord: bestMatch.record.properties,
        warning: 'Parent-child relationship detected - suppressed from dedup',
      };

    case 'sibling':
      // Different parent IDs = different corporate families
      return {
        action: 'insert',
        targetHubSpotId: null,
        similarityScore: 0.0,
        fieldComparison: bestMatch.fieldComparison,
        matchedRecord: bestMatch.record.properties,
      };

    case 'same_parent':
      // Same parent = likely duplicates within corporate group, needs review
      return {
        action: 'review',
        targetHubSpotId: bestMatch.record.id,
        similarityScore: 1.0,
        fieldComparison: bestMatch.fieldComparison,
        matchedRecord: bestMatch.record.properties,
        warning: 'Same parent company detected - review required',
      };

    case 'one_has_parent':
      // Ambiguous - could be parent-child or duplicate
      return {
        action: 'review',
        targetHubSpotId: bestMatch.record.id,
        similarityScore: 0.75,
        fieldComparison: bestMatch.fieldComparison,
        matchedRecord: bestMatch.record.properties,
        warning: 'Possible parent or subsidiary relationship - verify before merging',
      };

    case 'no_hierarchy':
      // No special handling - fall through to normal threshold logic
      return null;
  }
}

/**
 * Search HubSpot for potential duplicates using blocking keys.
 * Uses index for O(1) lookups when available, falls back to API calls.
 */
async function findPotentialDuplicates(
  record: RawRecord,
  client: HubSpotClient,
  companyIndex?: CompanyIndex
): Promise<HubSpotCompany[]> {
  const results: HubSpotCompany[] = [];
  const seen = new Set<string>();

  // Primary: Search by domain
  const domain = record.domain as string | undefined;
  if (domain) {
    const normalizedDomain = extractDomain(domain);
    if (normalizedDomain) {
      // Use index if available (O(1) lookup)
      if (companyIndex) {
        const matchId = companyIndex.domainIndex.get(normalizedDomain);
        if (matchId && !seen.has(matchId)) {
          seen.add(matchId);
          // Fetch full record for comparison
          try {
            const matches = await client.getCompaniesByIds([matchId]);
            results.push(...matches);
          } catch (err) {
            console.error('Failed to fetch matched company:', err);
          }
        }
      } else {
        // Fall back to API search
        try {
          const domainMatches = await client.searchCompaniesByDomain(normalizedDomain);
          for (const match of domainMatches) {
            if (!seen.has(match.id)) {
              seen.add(match.id);
              results.push(match);
            }
          }
        } catch (err) {
          console.error('Domain search failed:', err);
        }
      }
    }
  }

  // Secondary: Search by name (if no domain matches)
  const name = record.name as string | undefined;
  if (name && results.length === 0) {
    // Name search always uses API (index doesn't support fuzzy matching)
    try {
      const nameMatches = await client.searchCompaniesByName(name);
      for (const match of nameMatches) {
        if (!seen.has(match.id)) {
          seen.add(match.id);
          results.push(match);
        }
      }
    } catch (err) {
      console.error('Name search failed:', err);
    }
  }

  return results;
}

/**
 * Find the best matching record from candidates.
 */
function findBestMatch(
  incoming: RawRecord,
  candidates: HubSpotCompany[],
  weights: DedupFieldWeights
): {
  record: HubSpotCompany;
  score: number;
  fieldComparison: Record<string, { incoming: unknown; existing: unknown; similarity: number }>;
} | null {
  if (candidates.length === 0) return null;

  const matches = candidates
    .map(candidate => ({
      record: candidate,
      ...computeCompositeSimilarity(incoming, candidate, weights),
    }))
    .sort((a, b) => b.score - a.score);

  return matches[0];
}

/**
 * Compute weighted similarity score between incoming and existing record.
 * Uses org-configurable field weights.
 */
function computeCompositeSimilarity(
  incoming: RawRecord,
  existing: HubSpotCompany,
  weights: DedupFieldWeights
): {
  score: number;
  fieldComparison: Record<string, { incoming: unknown; existing: unknown; similarity: number }>;
} {
  const fieldComparison: Record<string, {
    incoming: unknown;
    existing: unknown;
    similarity: number;
  }> = {};

  let totalWeight = 0;
  let weightedSum = 0;

  // Domain comparison (exact match only for normalized domains)
  const incomingDomain = extractDomain(incoming.domain as string);
  const existingDomain = extractDomain(existing.properties.domain);
  const domainSim = incomingDomain && existingDomain
    ? (incomingDomain === existingDomain ? 1.0 : 0.0)
    : 0;

  fieldComparison.domain = {
    incoming: incomingDomain,
    existing: existingDomain,
    similarity: domainSim,
  };
  weightedSum += weights.domain * domainSim;
  totalWeight += weights.domain;

  // Name comparison (fuzzy via Levenshtein)
  const incomingName = (incoming.name as string) || '';
  const existingName = existing.properties.name || '';
  const nameSim = similarity(incomingName, existingName);

  fieldComparison.name = {
    incoming: incomingName,
    existing: existingName,
    similarity: nameSim,
  };
  weightedSum += weights.name * nameSim;
  totalWeight += weights.name;

  // Phone comparison
  const incomingPhone = normalizePhone((incoming.phone as string) || '');
  const existingPhone = normalizePhone(existing.properties.phone || '');
  const phoneSim = incomingPhone && existingPhone
    ? similarity(incomingPhone, existingPhone)
    : 0;

  fieldComparison.phone = {
    incoming: incomingPhone,
    existing: existingPhone,
    similarity: phoneSim,
  };
  weightedSum += weights.phone * phoneSim;
  totalWeight += weights.phone;

  // Industry comparison (fuzzy match)
  const incomingIndustry = (incoming.industry as string)?.toLowerCase() || '';
  const existingIndustry = existing.properties.industry?.toLowerCase() || '';
  const industrySim = incomingIndustry && existingIndustry
    ? similarity(incomingIndustry, existingIndustry)
    : 0;

  fieldComparison.industry = {
    incoming: incomingIndustry,
    existing: existingIndustry,
    similarity: industrySim,
  };
  weightedSum += weights.industry * industrySim;
  totalWeight += weights.industry;

  // Employee band comparison (convert to bands for comparison)
  const incomingEmployees = incoming.employee_count as number | undefined;
  const existingEmployees = existing.properties.numberofemployees
    ? parseInt(existing.properties.numberofemployees, 10)
    : undefined;
  const employeeBandSim = computeEmployeeBandSimilarity(incomingEmployees, existingEmployees);

  fieldComparison.employee_band = {
    incoming: incomingEmployees ? getEmployeeBand(incomingEmployees) : null,
    existing: existingEmployees ? getEmployeeBand(existingEmployees) : null,
    similarity: employeeBandSim,
  };
  weightedSum += weights.employee_band * employeeBandSim;
  totalWeight += weights.employee_band;

  return {
    score: totalWeight > 0 ? weightedSum / totalWeight : 0,
    fieldComparison,
  };
}

/**
 * Normalize phone number for comparison.
 * Strips non-digit characters.
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Get employee count band for comparison.
 */
function getEmployeeBand(count: number): string {
  if (count <= 10) return '1-10';
  if (count <= 50) return '11-50';
  if (count <= 200) return '51-200';
  if (count <= 500) return '201-500';
  if (count <= 1000) return '501-1000';
  if (count <= 5000) return '1001-5000';
  if (count <= 10000) return '5001-10000';
  return '10000+';
}

/**
 * Compute similarity between employee bands.
 * Returns 1.0 for same band, 0.5 for adjacent bands, 0 otherwise.
 */
function computeEmployeeBandSimilarity(
  count1: number | undefined,
  count2: number | undefined
): number {
  if (!count1 || !count2) return 0;

  const band1 = getEmployeeBand(count1);
  const band2 = getEmployeeBand(count2);

  if (band1 === band2) return 1.0;

  // Check for adjacent bands
  const bands = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10000+'];
  const idx1 = bands.indexOf(band1);
  const idx2 = bands.indexOf(band2);

  if (Math.abs(idx1 - idx2) === 1) return 0.5;

  return 0;
}

/**
 * Add a record to the review queue.
 * Creates a dedup cluster in the database instead of using in-memory storage.
 *
 * @param record - Incoming record (must have _hubspot_id for webhook events)
 * @param dedupResult - Dedup gate result with matched record info
 * @param orgId - Organization ID (optional, will use 'default' if not provided)
 * @returns Cluster ID if created successfully, review queue ID as fallback
 */
export async function addToReviewQueue(
  record: RawRecord,
  dedupResult: DedupGateResult,
  orgId?: string
): Promise<string> {
  const incomingId = record._hubspot_id as string | undefined;
  const matchedId = dedupResult.targetHubSpotId;

  // If we have both HubSpot IDs, create a cluster in the database
  if (incomingId && matchedId && orgId) {
    // Extract signal types from field comparison
    const signals: string[] = [];
    if (dedupResult.fieldComparison) {
      for (const [field, comparison] of Object.entries(dedupResult.fieldComparison)) {
        if (comparison.similarity > 0.7) {
          signals.push(field);
        }
      }
    }

    const clusterId = await createDedupClusterFromWebhook(
      orgId,
      matchedId, // Existing record (company_a)
      incomingId, // Incoming record (company_b)
      dedupResult.similarityScore || 0,
      signals.length > 0 ? signals : ['webhook_match'],
      'webhook'
    );

    if (clusterId) {
      return clusterId;
    }

    console.warn('Failed to create dedup cluster, falling back to in-memory queue');
  }

  // Fallback to in-memory queue if database creation fails or IDs are missing
  const id = `review_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const item: ReviewQueueItem = {
    id,
    incomingRecord: record,
    matchedHubSpotId: matchedId!,
    similarityScore: dedupResult.similarityScore!,
    fieldComparison: dedupResult.fieldComparison,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  reviewQueue.set(id, item);

  return id;
}

/**
 * Get pending review items.
 */
export function getPendingReviewItems(): ReviewQueueItem[] {
  return Array.from(reviewQueue.values())
    .filter(item => item.status === 'pending')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Get review queue size.
 */
export function getReviewQueueSize(): number {
  return Array.from(reviewQueue.values())
    .filter(item => item.status === 'pending')
    .length;
}
