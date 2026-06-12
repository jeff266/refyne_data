/**
 * Survivorship Group Evaluator
 *
 * Evaluates compound survivorship rule groups BEFORE individual field rules.
 * Groups use AND logic: ALL conditions must match for a group to select a survivor.
 * First matching group wins.
 */

export interface SurvivorshipRuleGroup {
  id: string;
  org_id: string;
  name: string;
  group_priority: number;
  is_active: boolean;
  conditions: SurvivorshipCondition[];
}

export interface SurvivorshipCondition {
  id: string;
  group_id: string;
  field_key: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'is_populated' | 'is_empty' | 'contains';
  comparison_value?: string | null;
}

export interface GroupEvaluationResult {
  matched: boolean;
  matchedGroupId?: string;
  matchedGroupName?: string;
  survivor: 'master' | 'duplicate';
  reason: string;
}

/**
 * Evaluate compound rule groups BEFORE individual field rules.
 * Returns survivor record if any group matches exclusively for one record.
 *
 * Evaluation logic:
 * - Groups are evaluated in priority order (lower priority number = evaluated first)
 * - For each group, ALL conditions must match (AND logic)
 * - First group where ALL conditions match for ONE record (not both) wins
 * - If both records match, or neither matches, continue to next group
 * - If no group resolves, return null (fall through to field rules)
 */
export function evaluateSurvivorshipGroups(
  masterRecord: Record<string, any>,
  duplicateRecord: Record<string, any>,
  groups: SurvivorshipRuleGroup[]
): GroupEvaluationResult | null {
  // Sort by group_priority (lower = higher priority)
  const sortedGroups = [...groups]
    .filter(g => g.is_active)
    .sort((a, b) => a.group_priority - b.group_priority);

  for (const group of sortedGroups) {
    if (!group.conditions || group.conditions.length === 0) {
      continue; // Skip empty groups
    }

    const masterMatches = evaluateGroupConditions(masterRecord, group.conditions);
    const dupMatches = evaluateGroupConditions(duplicateRecord, group.conditions);

    // First group where ALL conditions match for ONE record (not both) wins
    if (masterMatches && !dupMatches) {
      return {
        matched: true,
        matchedGroupId: group.id,
        matchedGroupName: group.name,
        survivor: 'master',
        reason: `Matched group: ${group.name}`,
      };
    }

    if (dupMatches && !masterMatches) {
      return {
        matched: true,
        matchedGroupId: group.id,
        matchedGroupName: group.name,
        survivor: 'duplicate',
        reason: `Matched group: ${group.name}`,
      };
    }

    // Both match or neither match → try next group
  }

  return null; // No group resolved, fall through to field rules
}

/**
 * Evaluate all conditions in a group using AND logic.
 * ALL conditions must match for the group to match.
 */
function evaluateGroupConditions(
  record: Record<string, any>,
  conditions: SurvivorshipCondition[]
): boolean {
  return conditions.every(condition => evaluateCondition(record, condition));
}

/**
 * Evaluate a single condition against a record.
 *
 * Operators:
 * - gt: greater than (numeric)
 * - gte: greater than or equal to (numeric)
 * - lt: less than (numeric)
 * - lte: less than or equal to (numeric)
 * - eq: equals (string, case-insensitive)
 * - neq: not equals (string, case-insensitive)
 * - is_populated: has a non-empty value
 * - is_empty: is null, undefined, empty string, or '0'
 * - contains: string contains substring (case-insensitive)
 */
export function evaluateCondition(
  record: Record<string, any>,
  condition: SurvivorshipCondition
): boolean {
  const value = record[condition.field_key];
  const compValue = condition.comparison_value;

  switch (condition.operator) {
    case 'is_populated':
      // Populated means: not null, not undefined, not empty string, and not '0'
      return (
        value !== null &&
        value !== undefined &&
        value !== '' &&
        value !== '0' &&
        value !== 0
      );

    case 'is_empty':
      // Empty means: null, undefined, empty string, '0', or 0
      return (
        value === null ||
        value === undefined ||
        value === '' ||
        value === '0' ||
        value === 0
      );

    case 'eq':
      // Case-insensitive string equality
      return String(value ?? '').toLowerCase() === String(compValue ?? '').toLowerCase();

    case 'neq':
      // Case-insensitive string inequality
      return String(value ?? '').toLowerCase() !== String(compValue ?? '').toLowerCase();

    case 'contains':
      // Case-insensitive substring search
      return String(value ?? '').toLowerCase().includes(String(compValue ?? '').toLowerCase());

    case 'gt':
      // Greater than (numeric)
      return parseFloat(String(value ?? '0')) > parseFloat(String(compValue ?? '0'));

    case 'gte':
      // Greater than or equal to (numeric)
      return parseFloat(String(value ?? '0')) >= parseFloat(String(compValue ?? '0'));

    case 'lt':
      // Less than (numeric)
      return parseFloat(String(value ?? '0')) < parseFloat(String(compValue ?? '0'));

    case 'lte':
      // Less than or equal to (numeric)
      return parseFloat(String(value ?? '0')) <= parseFloat(String(compValue ?? '0'));

    default:
      console.warn(`Unknown operator: ${condition.operator}`);
      return false;
  }
}
