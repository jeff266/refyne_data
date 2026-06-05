/**
 * Condition Groups to HubSpot Filters Translator
 *
 * Converts ConditionBuilder's ConditionGroups format into HubSpot Search API filterGroups format.
 * Some operators (starts_with, ends_with, is_personal_email) cannot be translated and return null,
 * requiring client-side filtering after HubSpot fetch.
 */

import type { ConditionGroups, Condition } from '@/lib/harmonies/condition-evaluator';
import { evaluateConditionGroups } from '@/lib/harmonies/condition-evaluator';
import { PERSONAL_EMAIL_DOMAINS } from '@/lib/constants/personal-email-domains';

/**
 * Convert ConditionGroups to HubSpot Search API filterGroups format.
 *
 * Top-level match logic:
 * - 'all' = every group must match = AND between groups
 * - 'any' = at least one group must match = OR between groups
 *
 * HubSpot Search API naturally ORs between filterGroups, so:
 * - 'all' match = not directly supported, but we can achieve it by putting all conditions
 *   from all groups into a single filterGroup (AND within group)
 * - 'any' match = each group becomes a separate filterGroup
 *
 * Within-group match logic:
 * - 'all' = all conditions in one filterGroup (AND)
 * - 'any' = each condition gets its own filterGroup (OR)
 *
 * @returns Array of HubSpot filterGroups
 */
export function conditionGroupsToHubSpotFilters(
  conditionGroups: ConditionGroups
): Array<{ filters: Array<{ propertyName: string; operator: string; value?: any; values?: any[] }> }> {
  const hubspotFilterGroups: any[] = [];

  for (const group of conditionGroups.groups) {
    const filters: any[] = [];

    for (const condition of group.conditions) {
      const translated = translateCondition(condition);
      if (translated) {
        // between splits into two filters in same group
        if (Array.isArray(translated)) {
          filters.push(...translated);
        } else {
          filters.push(translated);
        }
      }
    }

    if (filters.length > 0) {
      if (group.match === 'all') {
        // AND within group: all filters in one filterGroup
        hubspotFilterGroups.push({ filters });
      } else {
        // OR within group: each filter gets its own filterGroup
        for (const filter of filters) {
          hubspotFilterGroups.push({ filters: [filter] });
        }
      }
    }
  }

  return hubspotFilterGroups;
}

/**
 * Translate a single condition to HubSpot Search API filter(s).
 *
 * Returns:
 * - Single filter object
 * - Array of filter objects (for 'between', 'is_not_personal_email')
 * - null if operator can't be translated (starts_with, ends_with, is_personal_email)
 */
function translateCondition(condition: Condition): any | any[] | null {
  const { field, operator, value } = condition;

  switch (operator) {
    case 'equals':
      return { propertyName: field, operator: 'EQ', value: String(value) };

    case 'not_equals':
      return { propertyName: field, operator: 'NEQ', value: String(value) };

    case 'contains':
      return { propertyName: field, operator: 'CONTAINS_TOKEN', value };

    case 'not_contains':
      return { propertyName: field, operator: 'NOT_CONTAINS_TOKEN', value };

    case 'starts_with':
      // HubSpot has no STARTS_WITH - fetch and filter in memory
      // Mark as client-side filter, skip HubSpot translation
      return null;

    case 'ends_with':
      // Same - no HubSpot equivalent
      return null;

    case 'trimmed_equals':
      return { propertyName: field, operator: 'EQ', value: String(value).trim() };

    case 'is_empty':
      return { propertyName: field, operator: 'NOT_HAS_PROPERTY' };

    case 'is_not_empty':
      return { propertyName: field, operator: 'HAS_PROPERTY' };

    case 'gt':
      return { propertyName: field, operator: 'GT', value: String(value) };

    case 'gte':
      return { propertyName: field, operator: 'GTE', value: String(value) };

    case 'lt':
      return { propertyName: field, operator: 'LT', value: String(value) };

    case 'lte':
      return { propertyName: field, operator: 'LTE', value: String(value) };

    case 'between':
      // value is [min, max] array
      return [
        { propertyName: field, operator: 'GTE', value: String(value[0]) },
        { propertyName: field, operator: 'LTE', value: String(value[1]) },
      ];

    case 'is_any_of':
      return { propertyName: field, operator: 'IN', values: value };

    case 'is_none_of':
      return { propertyName: field, operator: 'NOT_IN', values: value };

    case 'is_true':
      return { propertyName: field, operator: 'EQ', value: 'true' };

    case 'is_false':
      return { propertyName: field, operator: 'EQ', value: 'false' };

    case 'before':
      return { propertyName: field, operator: 'LT', value: String(new Date(value).getTime()) };

    case 'after':
      return { propertyName: field, operator: 'GT', value: String(new Date(value).getTime()) };

    case 'in_last_n_days': {
      const cutoff = Date.now() - (value * 24 * 60 * 60 * 1000);
      return { propertyName: field, operator: 'GTE', value: String(cutoff) };
    }

    case 'is_not_personal_email':
      // Generate one NOT_CONTAINS_TOKEN filter per domain
      // Put them all in same filterGroup (AND logic = none of these domains)
      return PERSONAL_EMAIL_DOMAINS.map(domain => ({
        propertyName: field,
        operator: 'NOT_CONTAINS_TOKEN',
        value: domain,
      }));

    case 'is_personal_email':
      // HubSpot can't do this as a server-side filter cleanly
      // Return null and let applyClientSideConditions handle it
      return null;

    default:
      return null;
  }
}

/**
 * Apply client-side conditions that couldn't be translated to HubSpot filters.
 *
 * Uses the existing evaluateConditionGroups() from condition-evaluator.ts
 * to filter records in memory after fetching from HubSpot.
 *
 * @param records - Records fetched from HubSpot
 * @param conditionGroups - Original condition groups
 * @returns Filtered records that pass all conditions
 */
export function applyClientSideConditions(
  records: any[],
  conditionGroups: ConditionGroups
): any[] {
  return records.filter(record =>
    evaluateConditionGroups(record.properties, conditionGroups)
  );
}
