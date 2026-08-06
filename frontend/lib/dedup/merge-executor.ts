/**
 * Dedup Merge Executor
 *
 * Policy-driven merge execution with field-level rules and exclusion criteria.
 * Replaces direct HubSpot merge API calls with configurable merge logic.
 */

import { supabase } from '../db/supabase';
import { track } from '../telemetry/track';
import { evaluateSurvivorshipGroups, SurvivorshipRuleGroup } from './survivorship-group-evaluator';

export interface DedupPolicy {
  id: string;
  org_id: string;
  name: string;
  is_active: boolean;
  block_if_different_parent: boolean;
  block_if_closed_won_deals: boolean;
  compliance_fields: string[];
  field_rules: FieldRule[];
}

export interface FieldRule {
  field: string; // Field name or '*' for wildcard
  rule: MergeRuleType;
  config: Record<string, any>;
}

export type MergeRuleType =
  | 'fill_empty'
  | 'keep_master'
  | 'append_both'
  | 'keep_highest'
  | 'keep_lowest'
  | 'keep_newest'
  | 'keep_oldest'
  | 'keep_most_advanced';

export interface MergeOptions {
  orgId: string;
  masterId: string;
  duplicateIds: string[];
  accessToken: string;
  preMergeSnapshots: Record<string, any>; // recordId → properties
  policyId?: string; // Optional specific policy to use
}

export interface MergeResult {
  success: boolean;
  masterId: string;
  mergedIds: string[];
  appliedRules: Record<string, { rule: MergeRuleType; source: string }>;
  error?: string;
}

export interface FieldExclusion {
  id: string;
  org_id: string;
  object_type: string;
  field_name: string;
  exclusion_type: 'never_merge' | 'union_true' | 'append';
  separator: string;
}

/**
 * Load active dedup policy for an org.
 * Falls back to default policy if no org-specific policy exists.
 */
export async function loadDedupPolicy(orgId: string, policyId?: string): Promise<DedupPolicy | null> {
  if (!supabase) {
    console.warn('[Merge Executor] Supabase not configured');
    return null;
  }

  let query = supabase
    .from('dedup_policies')
    .select('*');

  if (policyId) {
    query = query.eq('id', policyId).eq('org_id', orgId);
  } else {
    query = query
      .eq('org_id', orgId)
      .eq('is_active', true)
      .limit(1);
  }

  const { data } = await query.single();

  // Fallback to __default__ policy
  if (!data) {
    const { data: defaultPolicy } = await supabase
      .from('dedup_policies')
      .select('*')
      .eq('org_id', '__default__')
      .single();

    return defaultPolicy;
  }

  return data;
}

/**
 * Load field exclusions for an org.
 */
export async function loadFieldExclusions(
  orgId: string,
  objectType: string = 'company'
): Promise<FieldExclusion[]> {
  if (!supabase) {
    console.warn('[Merge Executor] Supabase not configured');
    return [];
  }

  const { data } = await supabase
    .from('dedup_field_exclusions')
    .select('*')
    .eq('org_id', orgId)
    .eq('object_type', objectType);

  return data ?? [];
}

/**
 * Load compound survivorship rule groups for an org.
 */
export async function loadSurvivorshipGroups(
  orgId: string,
  objectType: string = 'company'
): Promise<SurvivorshipRuleGroup[]> {
  if (!supabase) {
    console.warn('[Merge Executor] Supabase not configured');
    return [];
  }

  const { data: groups } = await supabase
    .from('dedup_survivorship_rule_groups')
    .select('*')
    .eq('org_id', orgId)
    .eq('object_type', objectType)
    .eq('is_active', true)
    .order('group_priority', { ascending: true });

  if (!groups || groups.length === 0) {
    return [];
  }

  // Load conditions for each group
  const groupsWithConditions: SurvivorshipRuleGroup[] = [];
  for (const group of groups) {
    const { data: conditions } = await supabase
      .from('dedup_survivorship_rule_conditions')
      .select('*')
      .eq('group_id', group.id);

    groupsWithConditions.push({
      ...group,
      conditions: conditions ?? [],
    });
  }

  return groupsWithConditions;
}

/**
 * Apply field exclusions to the merge payload.
 * Returns modified properties object with exclusions applied.
 */
export async function applyFieldExclusions(
  survivorProperties: Record<string, any>,
  allRecords: Array<Record<string, any>>,
  exclusions: FieldExclusion[]
): Promise<{
  properties: Record<string, any>;
  applied: Record<string, string>;
}> {
  const result = { ...survivorProperties };
  const applied: Record<string, string> = {};

  for (const exclusion of exclusions) {
    const field = exclusion.field_name;

    switch (exclusion.exclusion_type) {
      case 'never_merge':
        // Remove from update payload entirely
        // Surviving record's value is unchanged
        delete result[field];
        applied[field] = 'never_merge';
        break;

      case 'union_true':
        // True if ANY record has true
        const anyTrue = allRecords.some((r) => {
          const val = r[field];
          return val === 'true' || val === true || val === 1;
        });
        result[field] = anyTrue ? 'true' : 'false';
        applied[field] = 'union_true';
        break;

      case 'append':
        // Concatenate all non-empty values
        const values = allRecords
          .map((r) => r[field])
          .filter((v) => v !== null && v !== undefined && v !== '');

        const unique = Array.from(new Set(values));
        result[field] = unique.join(exclusion.separator || '\n');
        applied[field] = 'append';
        break;
    }
  }

  return { properties: result, applied };
}

/**
 * Check if a HubSpot owner is active (not archived).
 */
export async function checkOwnerActive(
  ownerId: string,
  portalId: string,
  accessToken: string
): Promise<{ active: boolean; owner: any | null }> {
  try {
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/owners/${ownerId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      console.warn(`[Merge Executor] Owner ${ownerId} not found`);
      return { active: false, owner: null };
    }

    const owner = await response.json();
    return { active: !owner.archived, owner };
  } catch (error) {
    console.error('[Merge Executor] Error checking owner:', error);
    return { active: false, owner: null };
  }
}

/**
 * Resolve the owner for the merged record based on config.
 * Handles inactive owner scenarios per dedup_config settings.
 */
export async function resolveOwnerForMerge(
  survivorRecord: Record<string, any>,
  allRecords: Array<Record<string, any>>,
  inactiveOwnerAction: string,
  fallbackOwnerId: string | null,
  accessToken: string,
  portalId: string
): Promise<{
  ownerId: string | null;
  action: string;
  wasInactive: boolean;
}> {
  const survivorOwnerId = survivorRecord.hubspot_owner_id || null;

  if (!survivorOwnerId) {
    return { ownerId: null, action: 'no_owner', wasInactive: false };
  }

  // Check if owner is active
  const { active } = await checkOwnerActive(survivorOwnerId, portalId, accessToken);

  if (active) {
    return { ownerId: survivorOwnerId, action: 'kept_active', wasInactive: false };
  }

  // Owner is inactive - apply configured action
  switch (inactiveOwnerAction) {
    case 'assign_fallback':
      if (fallbackOwnerId) {
        return {
          ownerId: fallbackOwnerId,
          action: 'fallback_assigned',
          wasInactive: true,
        };
      }
      // No fallback configured, treat as warn
      return {
        ownerId: survivorOwnerId,
        action: 'kept_inactive_no_fallback',
        wasInactive: true,
      };

    case 'leave_unassigned':
      return { ownerId: null, action: 'unassigned', wasInactive: true };

    case 'warn':
    default:
      // Keep inactive owner but flag in merge history
      return { ownerId: survivorOwnerId, action: 'kept_inactive', wasInactive: true };
  }
}

/**
 * Check parent/child relationship for a record.
 */
export async function checkParentChild(
  record: Record<string, any>,
  accessToken: string,
  portalId: string
): Promise<{
  hasParent: boolean;
  parentId: string | null;
  childIds: string[];
}> {
  const parentId = record.hs_parent_company_id || null;

  // Get child companies
  let childIds: string[] = [];
  try {
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/objects/companies/${record.hs_object_id}/associations/companies`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (response.ok) {
      const data = await response.json();
      // Filter for child relationships (parent-to-child associations)
      // Note: This is a simplified version - HubSpot's association types would be more specific
      childIds = data.results?.map((r: any) => r.id) || [];
    }
  } catch (error) {
    console.error('[Merge Executor] Error fetching child companies:', error);
  }

  return {
    hasParent: !!parentId,
    parentId,
    childIds,
  };
}

/**
 * Select survivor with parent/child awareness.
 * Prefers record with no parent (it IS the parent).
 */
export function selectSurvivorWithParentAwareness(
  records: Array<Record<string, any>>,
  parentChecks: Map<string, { hasParent: boolean; parentId: string | null; childIds: string[] }>
): { survivorId: string; reason: string } {
  // Prefer record with no parent (it IS the parent)
  for (const record of records) {
    const check = parentChecks.get(record.hs_object_id);
    if (check && !check.hasParent) {
      return {
        survivorId: record.hs_object_id,
        reason: 'parent_preferred',
      };
    }
  }

  // All have parents - return first record, will be flagged for review
  return {
    survivorId: records[0].hs_object_id,
    reason: 'all_have_parents',
  };
}

/**
 * Check exclusion rules. Returns error message if merge should be blocked.
 */
async function checkExclusionRules(
  policy: DedupPolicy,
  masterId: string,
  duplicateIds: string[],
  preMergeSnapshots: Record<string, any>,
  accessToken: string
): Promise<string | null> {
  // Check if different parent companies
  if (policy.block_if_different_parent) {
    const masterParent = preMergeSnapshots[masterId]?.hs_parent_company_id;

    for (const dupId of duplicateIds) {
      const dupParent = preMergeSnapshots[dupId]?.hs_parent_company_id;

      if (masterParent && dupParent && masterParent !== dupParent) {
        return `Merge blocked: records have different parent companies (${masterParent} vs ${dupParent})`;
      }
    }
  }

  // Check if any record has closed-won deals
  if (policy.block_if_closed_won_deals) {
    const allRecordIds = [masterId, ...duplicateIds];

    for (const recordId of allRecordIds) {
      const dealsRes = await fetch(
        `https://api.hubapi.com/crm/v3/objects/companies/${recordId}/associations/deals`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (dealsRes.ok) {
        const dealsData = await dealsRes.json();
        const dealIds = dealsData.results?.map((r: any) => r.id) || [];

        if (dealIds.length > 0) {
          // Fetch deal details to check dealstage
          const dealDetailsRes = await fetch(
            `https://api.hubapi.com/crm/v3/objects/deals/batch/read`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                inputs: dealIds.map((id: string) => ({ id })),
                properties: ['dealstage', 'dealname'],
              }),
            }
          );

          if (dealDetailsRes.ok) {
            const dealDetails = await dealDetailsRes.json();
            const hasClosedWon = dealDetails.results?.some(
              (deal: any) => deal.properties.dealstage === 'closedwon'
            );

            if (hasClosedWon) {
              return `Merge blocked: record ${recordId} has closed-won deals`;
            }
          }
        }
      }
    }
  }

  return null; // No exclusions triggered
}

/**
 * Apply field merge rules to determine winning value for each field.
 */
function applyFieldRules(
  field: string,
  masterValue: any,
  duplicateValue: any,
  masterRecord: Record<string, any>,
  duplicateRecord: Record<string, any>,
  rules: FieldRule[]
): { value: any; rule: MergeRuleType; source: 'master' | 'duplicate' } {
  // Find applicable rule (specific field or wildcard)
  const fieldRule = rules.find(r => r.field === field);
  const wildcardRule = rules.find(r => r.field === '*');
  const rule = fieldRule || wildcardRule;

  if (!rule) {
    // Default: keep master
    return { value: masterValue, rule: 'keep_master', source: 'master' };
  }

  switch (rule.rule) {
    case 'fill_empty': {
      if (!masterValue && duplicateValue) {
        return { value: duplicateValue, rule: 'fill_empty', source: 'duplicate' };
      }
      return { value: masterValue, rule: 'fill_empty', source: 'master' };
    }

    case 'keep_master': {
      return { value: masterValue, rule: 'keep_master', source: 'master' };
    }

    case 'append_both': {
      // Concatenate both values if both exist
      if (masterValue && duplicateValue && masterValue !== duplicateValue) {
        const separator = rule.config.separator || '; ';
        return {
          value: `${masterValue}${separator}${duplicateValue}`,
          rule: 'append_both',
          source: 'master',
        };
      }
      return { value: masterValue || duplicateValue, rule: 'append_both', source: masterValue ? 'master' : 'duplicate' };
    }

    case 'keep_highest': {
      const masterNum = parseFloat(String(masterValue ?? ''));
      const dupNum = parseFloat(String(duplicateValue ?? ''));

      if (isNaN(masterNum) && !isNaN(dupNum)) {
        return { value: duplicateValue, rule: 'keep_highest', source: 'duplicate' };
      }
      if (!isNaN(masterNum) && isNaN(dupNum)) {
        return { value: masterValue, rule: 'keep_highest', source: 'master' };
      }
      if (!isNaN(masterNum) && !isNaN(dupNum)) {
        return dupNum > masterNum
          ? { value: duplicateValue, rule: 'keep_highest', source: 'duplicate' }
          : { value: masterValue, rule: 'keep_highest', source: 'master' };
      }
      return { value: masterValue, rule: 'keep_highest', source: 'master' };
    }

    case 'keep_lowest': {
      const masterNum = parseFloat(String(masterValue ?? ''));
      const dupNum = parseFloat(String(duplicateValue ?? ''));

      if (isNaN(masterNum) && !isNaN(dupNum)) {
        return { value: duplicateValue, rule: 'keep_lowest', source: 'duplicate' };
      }
      if (!isNaN(masterNum) && isNaN(dupNum)) {
        return { value: masterValue, rule: 'keep_lowest', source: 'master' };
      }
      if (!isNaN(masterNum) && !isNaN(dupNum)) {
        return dupNum < masterNum
          ? { value: duplicateValue, rule: 'keep_lowest', source: 'duplicate' }
          : { value: masterValue, rule: 'keep_lowest', source: 'master' };
      }
      return { value: masterValue, rule: 'keep_lowest', source: 'master' };
    }

    case 'keep_newest': {
      const masterDate = masterRecord[`hs_property_${field}_updated_at`] || masterRecord['hs_lastmodifieddate'];
      const dupDate = duplicateRecord[`hs_property_${field}_updated_at`] || duplicateRecord['hs_lastmodifieddate'];

      if (!masterDate && dupDate && duplicateValue) {
        return { value: duplicateValue, rule: 'keep_newest', source: 'duplicate' };
      }
      if (masterDate && !dupDate) {
        return { value: masterValue, rule: 'keep_newest', source: 'master' };
      }
      if (masterDate && dupDate) {
        return new Date(dupDate) > new Date(masterDate) && duplicateValue
          ? { value: duplicateValue, rule: 'keep_newest', source: 'duplicate' }
          : { value: masterValue, rule: 'keep_newest', source: 'master' };
      }
      return { value: masterValue, rule: 'keep_newest', source: 'master' };
    }

    case 'keep_oldest': {
      const masterDate = masterRecord['createdate'];
      const dupDate = duplicateRecord['createdate'];

      if (!masterDate && dupDate && duplicateValue) {
        return { value: duplicateValue, rule: 'keep_oldest', source: 'duplicate' };
      }
      if (masterDate && !dupDate) {
        return { value: masterValue, rule: 'keep_oldest', source: 'master' };
      }
      if (masterDate && dupDate) {
        return new Date(dupDate) < new Date(masterDate) && duplicateValue
          ? { value: duplicateValue, rule: 'keep_oldest', source: 'duplicate' }
          : { value: masterValue, rule: 'keep_oldest', source: 'master' };
      }
      return { value: masterValue, rule: 'keep_oldest', source: 'master' };
    }

    case 'keep_most_advanced': {
      const order: string[] = rule.config.order || [];
      const masterIdx = order.findIndex(v => String(masterValue ?? '').toLowerCase() === v.toLowerCase());
      const dupIdx = order.findIndex(v => String(duplicateValue ?? '').toLowerCase() === v.toLowerCase());

      // Lower index = more advanced
      if (dupIdx !== -1 && (masterIdx === -1 || dupIdx > masterIdx)) {
        return { value: duplicateValue, rule: 'keep_most_advanced', source: 'duplicate' };
      }
      return { value: masterValue, rule: 'keep_most_advanced', source: 'master' };
    }

    default:
      return { value: masterValue, rule: 'keep_master', source: 'master' };
  }
}

/**
 * Execute merge with policy-driven field rules.
 *
 * Flow:
 * 1. Load dedup policy
 * 2. Check exclusion rules
 * 3. Execute HubSpot merge API (combines records)
 * 4. Apply field rules to build merged properties
 * 5. Enforce compliance fields
 * 6. Update master record with final merged properties
 */
export async function executeMerge(options: MergeOptions): Promise<MergeResult> {
  const { orgId, masterId, duplicateIds, accessToken, preMergeSnapshots, policyId } = options;

  // Load policy
  const policy = await loadDedupPolicy(orgId, policyId);
  if (!policy) {
    return {
      success: false,
      masterId,
      mergedIds: [],
      appliedRules: {},
      error: 'No dedup policy found',
    };
  }

  console.log('[Merge Executor] Using policy:', policy.name);

  // Load compound survivorship rule groups
  const groups = await loadSurvivorshipGroups(orgId, 'company');
  console.log(`[Merge Executor] Loaded ${groups.length} compound rule groups`);

  // Evaluate groups to determine survivor (happens once for the cluster)
  let effectiveMasterId = masterId;
  let effectiveDuplicateIds = [...duplicateIds];
  let groupResolution: string | null = null;

  if (groups.length > 0 && duplicateIds.length > 0) {
    const masterRecord = preMergeSnapshots[masterId] || {};
    const firstDuplicateId = duplicateIds[0];
    const duplicateRecord = preMergeSnapshots[firstDuplicateId] || {};

    const groupResult = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

    if (groupResult && groupResult.matched) {
      console.log(`[Merge Executor] Group matched: ${groupResult.matchedGroupName} (survivor: ${groupResult.survivor})`);
      groupResolution = `group:${groupResult.matchedGroupName}`;

      // If group selects duplicate as survivor, swap IDs
      if (groupResult.survivor === 'duplicate') {
        console.log('[Merge Executor] Swapping master/duplicate based on compound rule group');
        effectiveMasterId = firstDuplicateId;
        effectiveDuplicateIds = [masterId, ...duplicateIds.slice(1)];
      }
    }
  }

  // Check exclusion rules
  const exclusionError = await checkExclusionRules(
    policy,
    effectiveMasterId,
    effectiveDuplicateIds,
    preMergeSnapshots,
    accessToken
  );

  if (exclusionError) {
    return {
      success: false,
      masterId: effectiveMasterId,
      mergedIds: [],
      appliedRules: {},
      error: exclusionError,
    };
  }

  // Execute HubSpot merge API for each duplicate
  const successfullyMerged: string[] = [];
  const skippedRecords: Array<{ id: string; reason: string }> = [];

  for (const duplicateId of effectiveDuplicateIds) {
    const mergeRes = await fetch('https://api.hubapi.com/crm/v3/objects/companies/merge', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        primaryObjectId: effectiveMasterId,
        objectIdToMerge: duplicateId,
      }),
    });

    if (!mergeRes.ok) {
      const errorText = await mergeRes.text();
      console.error(`[Merge Executor] HubSpot merge failed for ${duplicateId}:`, errorText);

      // Parse error JSON if possible
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      // Check if this is a "forward reference" error (record already merged)
      const isAlreadyMerged =
        errorData.message?.includes('forward reference') ||
        errorData.message?.includes('Only canonical objects can be merged') ||
        errorData.category === 'VALIDATION_ERROR' && errorData.message?.includes('because it has a forward reference');

      if (isAlreadyMerged) {
        console.warn(`[Merge Executor] Skipping ${duplicateId} - already merged in HubSpot`);
        skippedRecords.push({
          id: duplicateId,
          reason: 'already_merged',
        });
        continue; // Skip this record and continue with others
      }

      // For other errors, fail the entire merge
      return {
        success: false,
        masterId: effectiveMasterId,
        mergedIds: successfullyMerged,
        appliedRules: {},
        error: `HubSpot merge API failed: ${errorData.message || errorText}`,
      };
    }

    successfullyMerged.push(duplicateId);
  }

  if (successfullyMerged.length === 0 && skippedRecords.length > 0) {
    // All records were already merged
    return {
      success: false,
      masterId: effectiveMasterId,
      mergedIds: [],
      appliedRules: {},
      error: `All ${skippedRecords.length} records were already merged in HubSpot`,
    };
  }

  console.log(`[Merge Executor] HubSpot merge completed: ${successfullyMerged.length} merged, ${skippedRecords.length} skipped`);

  // Build merged properties using field rules
  const masterSnapshot = preMergeSnapshots[effectiveMasterId] || {};
  const mergedProperties: Record<string, any> = {};
  const appliedRules: Record<string, { rule: MergeRuleType; source: string }> = {};

  // If group resolution happened, track it
  if (groupResolution) {
    appliedRules['__group_resolution__'] = { rule: 'keep_master' as MergeRuleType, source: groupResolution };
  }

  // Get all unique fields from all records
  const allFields = new Set<string>();
  for (const snapshot of Object.values(preMergeSnapshots)) {
    Object.keys(snapshot).forEach(field => allFields.add(field));
  }

  // Apply field rules for each successfully merged duplicate (in order)
  for (const duplicateId of successfullyMerged) {
    const duplicateSnapshot = preMergeSnapshots[duplicateId] || {};

    for (const field of Array.from(allFields)) {
      // Skip system fields
      if (field.startsWith('hs_object_id') || field === 'createdate') {
        continue;
      }

      const masterValue = masterSnapshot[field];
      const duplicateValue = duplicateSnapshot[field];

      const result = applyFieldRules(
        field,
        masterValue,
        duplicateValue,
        masterSnapshot,
        duplicateSnapshot,
        policy.field_rules
      );

      // Only update if value changed
      if (result.source === 'duplicate' && result.value !== masterValue) {
        mergedProperties[field] = result.value;
        appliedRules[field] = { rule: result.rule, source: result.source };
      }
    }
  }

  // Enforce compliance fields (always use most restrictive)
  for (const complianceField of policy.compliance_fields) {
    let mostRestrictive: any = masterSnapshot[complianceField];

    for (const duplicateId of successfullyMerged) {
      const dupValue = preMergeSnapshots[duplicateId]?.[complianceField];

      // For opt-out/bounce fields, true is more restrictive
      if (dupValue === true || dupValue === 'true') {
        mostRestrictive = true;
      }
    }

    if (mostRestrictive !== undefined) {
      mergedProperties[complianceField] = mostRestrictive;
      appliedRules[complianceField] = { rule: 'keep_master', source: 'compliance' };
    }
  }

  // Update master record with merged properties
  if (Object.keys(mergedProperties).length > 0) {
    const updateRes = await fetch(
      `https://api.hubapi.com/crm/v3/objects/companies/${effectiveMasterId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties: mergedProperties }),
      }
    );

    if (!updateRes.ok) {
      const error = await updateRes.text();
      console.error(`[Merge Executor] Failed to update master record:`, error);
      // Don't fail the merge - HubSpot merge already happened
    } else {
      console.log(`[Merge Executor] Applied ${Object.keys(mergedProperties).length} field updates`);
    }
  }

  // Track dedup_merge_executed event
  track({
    event: 'dedup_merge_executed',
    orgId,
    metadata: {
      master_id: effectiveMasterId,
      duplicate_ids: successfullyMerged,
      duplicate_count: successfullyMerged.length,
      skipped_count: skippedRecords.length,
      skipped_reasons: skippedRecords,
      fields_updated: Object.keys(mergedProperties).length,
      group_resolution: groupResolution,
    },
  });

  return {
    success: true,
    masterId: effectiveMasterId,
    mergedIds: successfullyMerged,
    appliedRules,
  };
}
