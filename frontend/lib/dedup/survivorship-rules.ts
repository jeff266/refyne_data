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
    }

    result[field] = winner;
  }

  return result;
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
