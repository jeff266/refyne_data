/**
 * Survivorship Rules Engine
 *
 * Automatic field-level winner selection during merge operations.
 * Prevents lifecycle stage downgrades, fills data gaps, flags TLD mismatches.
 */

import { supabase } from '../db/supabase';

export interface SurvivorshipRule {
  id: string;
  org_id: string;
  field_key: string;
  rule_type: string;
  rule_config: Record<string, any>;
  is_active: boolean;
}

export interface FieldWinner {
  value: any;
  source: 'master' | 'duplicate';
  rule: string;
}

/**
 * Load rules for an org. Merges default rules with org-specific overrides.
 * Org-specific rules take precedence over __default__ rules for the same field.
 */
export async function loadRules(orgId: string): Promise<SurvivorshipRule[]> {
  if (!supabase) {
    console.warn('[Survivorship] Supabase not configured, using empty rules');
    return [];
  }

  const { data } = await supabase
    .from('dedup_survivorship_rules')
    .select('*')
    .in('org_id', ['__default__', orgId])
    .eq('is_active', true);

  const rules = data ?? [];

  // Org-specific rules override defaults for same field + rule_type
  const orgRules = rules.filter((r) => r.org_id === orgId);
  const defaultRules = rules.filter((r) => r.org_id === '__default__');

  const overriddenKeys = new Set(
    orgRules.map((r) => `${r.field_key}:${r.rule_type}`)
  );

  return [
    ...orgRules,
    ...defaultRules.filter(
      (r) => !overriddenKeys.has(`${r.field_key}:${r.rule_type}`)
    ),
  ];
}

/**
 * Load field-level source metadata from enrichment_field_sources table.
 * Attaches source info to records as _refyne_source_{fieldKey} properties.
 */
export async function loadFieldSources(
  orgId: string,
  companyIds: string[]
): Promise<Record<string, Record<string, string>>> {
  if (!supabase || companyIds.length === 0) {
    return {};
  }

  const { data } = await supabase
    .from('enrichment_field_sources')
    .select('hubspot_company_id, field_key, source')
    .eq('org_id', orgId)
    .in('hubspot_company_id', companyIds);

  const sources: Record<string, Record<string, string>> = {};

  for (const row of data ?? []) {
    if (!sources[row.hubspot_company_id]) {
      sources[row.hubspot_company_id] = {};
    }
    sources[row.hubspot_company_id][`_refyne_source_${row.field_key}`] = row.source;
  }

  return sources;
}

/**
 * Apply survivorship rules to determine field-level winners before merge.
 * Returns a map of fieldKey → winning value and which record it came from.
 */
export function applyRules(
  masterRecord: Record<string, any>,
  duplicateRecord: Record<string, any>,
  rules: SurvivorshipRule[]
): Record<string, FieldWinner> {
  const result: Record<string, FieldWinner> = {};

  const allFields = Array.from(new Set([
    ...Object.keys(masterRecord),
    ...Object.keys(duplicateRecord),
  ]));

  for (const field of allFields) {
    const masterVal = masterRecord[field];
    const dupVal = duplicateRecord[field];

    // Find applicable rules for this field
    const fieldRules = rules.filter(
      (r) => r.field_key === field || r.field_key === '*'
    );

    let winner: FieldWinner = {
      value: masterVal,
      source: 'master',
      rule: 'default_master',
    };

    for (const rule of fieldRules) {
      if (rule.rule_type === 'never_downgrade') {
        const order: string[] = rule.rule_config.order ?? [];
        const masterIdx = order.indexOf(
          String(masterVal ?? '').toLowerCase()
        );
        const dupIdx = order.indexOf(String(dupVal ?? '').toLowerCase());

        // Lower index = more advanced in funnel
        if (dupIdx !== -1 && (masterIdx === -1 || dupIdx < masterIdx)) {
          winner = {
            value: dupVal,
            source: 'duplicate',
            rule: 'never_downgrade',
          };
        }
      }

      if (rule.rule_type === 'prefer_nonempty') {
        const masterEmpty =
          masterVal === null || masterVal === undefined || masterVal === '';
        const dupNotEmpty =
          dupVal !== null && dupVal !== undefined && dupVal !== '';

        if (masterEmpty && dupNotEmpty) {
          winner = { value: dupVal, source: 'duplicate', rule: 'prefer_nonempty' };
        }
      }

      if (rule.rule_type === 'most_recent') {
        // Compare last modified timestamps on each record
        const masterModified = new Date(
          masterRecord['hs_lastmodifieddate'] ?? 0
        ).getTime();
        const dupModified = new Date(
          duplicateRecord['hs_lastmodifieddate'] ?? 0
        ).getTime();

        // Only apply if field has a value on the more recently modified record
        // and the field was modified more recently than the master's version
        const fieldModifiedKey = `hs_property_${field}_updated_at`;
        const masterFieldDate = masterRecord[fieldModifiedKey];
        const dupFieldDate = duplicateRecord[fieldModifiedKey];

        if (masterFieldDate && dupFieldDate) {
          // Use field-level timestamps if available
          if (new Date(dupFieldDate).getTime() > new Date(masterFieldDate).getTime() && dupVal) {
            winner = { value: dupVal, source: 'duplicate', rule: 'most_recent' };
          }
        } else {
          // Fall back to record-level modified date
          if (dupModified > masterModified && dupVal) {
            winner = { value: dupVal, source: 'duplicate', rule: 'most_recent' };
          }
        }
      }

      if (rule.rule_type === 'source_preference') {
        const sourceRank: string[] = rule.rule_config.source_rank ?? [];

        // Check field-level source metadata
        // Stored as _refyne_source_{fieldKey} on enriched records
        const masterSource = masterRecord[`_refyne_source_${field}`] ?? 'unknown';
        const dupSource = duplicateRecord[`_refyne_source_${field}`] ?? 'unknown';

        const masterRank = sourceRank.indexOf(masterSource);
        const dupRank = sourceRank.indexOf(dupSource);

        // Lower index = higher trust
        // Only override if duplicate has a better source AND a non-empty value
        if (
          dupRank !== -1 &&
          (masterRank === -1 || dupRank < masterRank) &&
          dupVal
        ) {
          winner = { value: dupVal, source: 'duplicate', rule: 'source_preference' };
        }
      }

      if (rule.rule_type === 'specific_value') {
        const valueOrder: string[] = rule.rule_config.value_order ?? [];

        const masterVal = String(masterRecord[field] ?? '').toLowerCase();
        const dupVal = String(duplicateRecord[field] ?? '').toLowerCase();

        const masterRank = valueOrder
          .map((v) => v.toLowerCase())
          .indexOf(masterVal);
        const dupRank = valueOrder
          .map((v) => v.toLowerCase())
          .indexOf(dupVal);

        // Lower index = higher priority
        // If duplicate has higher priority value, it wins
        if (
          dupRank !== -1 &&
          (masterRank === -1 || dupRank < masterRank) &&
          duplicateRecord[field]
        ) {
          winner = {
            value: duplicateRecord[field],
            source: 'duplicate',
            rule: 'specific_value',
          };
        }
      }

      if (rule.rule_type === 'rollup') {
        const method: string = rule.rule_config.method ?? 'max';

        const masterNum = parseFloat(String(masterRecord[field] ?? ''));
        const dupNum = parseFloat(String(duplicateRecord[field] ?? ''));

        const masterValid = !isNaN(masterNum);
        const dupValid = !isNaN(dupNum);

        if (!masterValid && dupValid) {
          winner = { value: dupNum, source: 'duplicate', rule: 'rollup' };
        } else if (masterValid && dupValid) {
          let result: number;

          switch (method) {
            case 'max':
              result = Math.max(masterNum, dupNum);
              break;
            case 'min':
              result = Math.min(masterNum, dupNum);
              break;
            case 'sum':
              result = masterNum + dupNum;
              break;
            case 'average':
              result = (masterNum + dupNum) / 2;
              break;
            default:
              result = masterNum;
          }

          const source =
            result === dupNum && result !== masterNum ? 'duplicate' : 'master';

          winner = { value: result, source, rule: 'rollup' };
        }
      }

      // NEW: boolean_union - true if ANY record has true
      if (rule.rule_type === 'boolean_union') {
        const masterBool = masterVal === 'true' || masterVal === true;
        const dupBool = dupVal === 'true' || dupVal === true;

        if (masterBool || dupBool) {
          winner = {
            value: 'true',
            source: masterBool ? 'master' : 'duplicate',
            rule: 'boolean_union',
          };
        } else {
          winner = {
            value: 'false',
            source: 'master',
            rule: 'boolean_union',
          };
        }
      }

      // NEW: append - concatenate values from both records
      if (rule.rule_type === 'append') {
        const separator = rule.rule_config.separator ?? '\n';
        const deduplicate = rule.rule_config.deduplicate ?? true;
        const maxLength = rule.rule_config.max_length;

        const values = [masterVal, dupVal].filter(
          (v) => v !== null && v !== undefined && v !== ''
        );

        const unique = deduplicate ? Array.from(new Set(values)) : values;
        let joined = unique.join(separator);

        if (maxLength && joined.length > maxLength) {
          joined = joined.slice(0, maxLength);
        }

        winner = {
          value: joined,
          source: 'master', // Combined from both
          rule: 'append',
        };
      }

      // NEW: prefer_if_populated - prefer record with non-zero numeric value
      if (rule.rule_type === 'prefer_if_populated') {
        const masterNum = parseFloat(String(masterVal ?? '0'));
        const dupNum = parseFloat(String(dupVal ?? '0'));

        const masterPopulated = !isNaN(masterNum) && masterNum > 0;
        const dupPopulated = !isNaN(dupNum) && dupNum > 0;

        // If only one record has a value > 0, prefer that record
        if (dupPopulated && !masterPopulated) {
          winner = {
            value: dupNum,
            source: 'duplicate',
            rule: 'prefer_if_populated',
          };
        } else if (masterPopulated && !dupPopulated) {
          winner = {
            value: masterNum,
            source: 'master',
            rule: 'prefer_if_populated',
          };
        }
        // If both populated or both empty, fall through to master (default winner)
      }
    }

    result[field] = winner;
  }

  return result;
}

/**
 * Apply survivorship rules with support for closed won priority.
 * This requires checking HubSpot deals, so it's separated from field-level rules.
 */
export function applyRulesWithClosedWonPriority(
  masterRecord: Record<string, any>,
  duplicateRecord: Record<string, any>,
  rules: SurvivorshipRule[],
  masterHasClosedWon: boolean,
  duplicateHasClosedWon: boolean
): Record<string, FieldWinner> {
  // Check if closed_won_priority rule exists and applies
  const closedWonRule = rules.find((r) => r.rule_type === 'closed_won_priority');

  if (closedWonRule && masterHasClosedWon !== duplicateHasClosedWon) {
    // One has closed won, the other doesn't
    // Swap master/duplicate if duplicate has closed won
    if (duplicateHasClosedWon) {
      return applyRules(duplicateRecord, masterRecord, rules);
    }
  }

  // Otherwise, apply normal rules
  return applyRules(masterRecord, duplicateRecord, rules);
}

/**
 * Check if a cluster should be downgraded from Grade A due to TLD mismatch.
 * Returns a confidence penalty to apply.
 */
export function getTldPenalty(
  domain1: string | null,
  domain2: string | null,
  rules: SurvivorshipRule[]
): number {
  if (!domain1 || !domain2) return 0;

  const tldRule = rules.find((r) => r.rule_type === 'tld_disqualifier');
  if (!tldRule) return 0;

  const tldPairs: string[][] = tldRule.rule_config.tld_pairs_to_flag ?? [];
  const penalty: number = tldRule.rule_config.confidence_penalty ?? 20;

  const getTld = (domain: string) => {
    const parts = domain.toLowerCase().replace(/^www\./, '').split('.');
    if (parts.length >= 3) return `.${parts.slice(-2).join('.')}`;
    return `.${parts.slice(-1)[0]}`;
  };

  const tld1 = getTld(domain1);
  const tld2 = getTld(domain2);

  const isFlagged = tldPairs.some(
    ([a, b]) => (tld1 === a && tld2 === b) || (tld1 === b && tld2 === a)
  );

  return isFlagged ? penalty : 0;
}
