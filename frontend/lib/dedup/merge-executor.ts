/**
 * Dedup Merge Executor
 *
 * Policy-driven merge execution with field-level rules and exclusion criteria.
 * Replaces direct HubSpot merge API calls with configurable merge logic.
 */

import { supabase } from '../db/supabase';
import { track } from '../telemetry/track';

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

  // Check exclusion rules
  const exclusionError = await checkExclusionRules(
    policy,
    masterId,
    duplicateIds,
    preMergeSnapshots,
    accessToken
  );

  if (exclusionError) {
    return {
      success: false,
      masterId,
      mergedIds: [],
      appliedRules: {},
      error: exclusionError,
    };
  }

  // Execute HubSpot merge API for each duplicate
  for (const duplicateId of duplicateIds) {
    const mergeRes = await fetch('https://api.hubapi.com/crm/v3/objects/companies/merge', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        primaryObjectId: masterId,
        objectIdToMerge: duplicateId,
      }),
    });

    if (!mergeRes.ok) {
      const error = await mergeRes.text();
      console.error(`[Merge Executor] HubSpot merge failed for ${duplicateId}:`, error);
      return {
        success: false,
        masterId,
        mergedIds: [],
        appliedRules: {},
        error: `HubSpot merge API failed: ${error}`,
      };
    }
  }

  console.log('[Merge Executor] HubSpot merge completed');

  // Build merged properties using field rules
  const masterSnapshot = preMergeSnapshots[masterId] || {};
  const mergedProperties: Record<string, any> = {};
  const appliedRules: Record<string, { rule: MergeRuleType; source: string }> = {};

  // Get all unique fields from all records
  const allFields = new Set<string>();
  for (const snapshot of Object.values(preMergeSnapshots)) {
    Object.keys(snapshot).forEach(field => allFields.add(field));
  }

  // Apply field rules for each duplicate (in order)
  for (const duplicateId of duplicateIds) {
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

    for (const duplicateId of duplicateIds) {
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
      `https://api.hubapi.com/crm/v3/objects/companies/${masterId}`,
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
      master_id: masterId,
      duplicate_ids: duplicateIds,
      duplicate_count: duplicateIds.length,
      fields_updated: Object.keys(mergedProperties).length,
    },
  });

  return {
    success: true,
    masterId,
    mergedIds: duplicateIds,
    appliedRules,
  };
}
