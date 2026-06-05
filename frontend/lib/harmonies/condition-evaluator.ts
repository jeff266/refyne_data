/**
 * Condition Evaluator for Harmonies
 *
 * Implements conditional execution logic following the Openprise model:
 * - Harmonies run on ALL records by default
 * - Optional conditions restrict which records qualify
 * - Branching = separate harmonies with different conditions
 *
 * Features:
 * - 33 operators across 5 field types (string, number, enumeration, bool, date)
 * - Nested AND/OR logic (groups + conditions within groups)
 * - Case-insensitive string comparison
 * - Soft failure for missing fields (returns false, logs warning)
 * - No I/O operations (pure in-memory evaluation)
 */

import { PERSONAL_EMAIL_DOMAINS } from '@/lib/constants/personal-email-domains';

// ============================================================================
// Types
// ============================================================================

export type FieldType = 'string' | 'number' | 'enumeration' | 'bool' | 'date';

export type StringOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty'
  | 'trimmed_equals'
  | 'is_personal_email'
  | 'is_not_personal_email';

export type NumberOperator =
  | 'equals'
  | 'not_equals'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'is_empty'
  | 'is_not_empty';

export type EnumOperator =
  | 'equals'
  | 'not_equals'
  | 'is_any_of'
  | 'is_none_of'
  | 'is_empty'
  | 'is_not_empty';

export type BoolOperator =
  | 'is_true'
  | 'is_false'
  | 'is_empty';

export type DateOperator =
  | 'equals'
  | 'before'
  | 'after'
  | 'between'
  | 'in_last_n_days'
  | 'is_empty'
  | 'is_not_empty';

export type Operator = StringOperator | NumberOperator | EnumOperator | BoolOperator | DateOperator;

export interface Condition {
  field: string;              // HubSpot property name (e.g., 'country', 'lifecyclestage')
  fieldLabel: string;         // Human-readable label (e.g., 'Country/Region')
  fieldType: FieldType;       // Determines which operators are available
  operator: Operator;         // Comparison operator
  value: any;                 // Expected value (type varies by operator)
}

export interface ConditionGroup {
  match: 'all' | 'any';       // AND or OR within this group
  conditions: Condition[];
}

export interface ConditionGroups {
  match: 'all' | 'any';       // AND or OR between groups
  groups: ConditionGroup[];
}

export interface OperatorDefinition {
  value: Operator;
  label: string;
}

// ============================================================================
// Operator Definitions (used by UI to render operator dropdowns)
// ============================================================================

export const OPERATORS_BY_TYPE: Record<FieldType, OperatorDefinition[]> = {
  string: [
    { value: 'equals',                label: 'equals' },
    { value: 'not_equals',            label: 'does not equal' },
    { value: 'contains',              label: 'contains' },
    { value: 'not_contains',          label: 'does not contain' },
    { value: 'starts_with',           label: 'starts with' },
    { value: 'ends_with',             label: 'ends with' },
    { value: 'is_empty',              label: 'is empty' },
    { value: 'is_not_empty',          label: 'is not empty' },
    { value: 'trimmed_equals',        label: 'trimmed equals' },
    { value: 'is_personal_email',     label: 'is personal email' },
    { value: 'is_not_personal_email', label: 'is not personal email' },
  ],
  number: [
    { value: 'equals',          label: 'equals' },
    { value: 'not_equals',      label: 'does not equal' },
    { value: 'gt',              label: 'greater than' },
    { value: 'gte',             label: 'greater than or equal' },
    { value: 'lt',              label: 'less than' },
    { value: 'lte',             label: 'less than or equal' },
    { value: 'between',         label: 'is between' },
    { value: 'is_empty',        label: 'is empty' },
    { value: 'is_not_empty',    label: 'is not empty' },
  ],
  enumeration: [
    { value: 'equals',          label: 'equals' },
    { value: 'not_equals',      label: 'does not equal' },
    { value: 'is_any_of',       label: 'is any of' },
    { value: 'is_none_of',      label: 'is none of' },
    { value: 'is_empty',        label: 'is empty' },
    { value: 'is_not_empty',    label: 'is not empty' },
  ],
  bool: [
    { value: 'is_true',         label: 'is true' },
    { value: 'is_false',        label: 'is false' },
    { value: 'is_empty',        label: 'is empty' },
  ],
  date: [
    { value: 'equals',          label: 'is on' },
    { value: 'before',          label: 'is before' },
    { value: 'after',           label: 'is after' },
    { value: 'between',         label: 'is between' },
    { value: 'in_last_n_days',  label: 'is in the last N days' },
    { value: 'is_empty',        label: 'is empty' },
    { value: 'is_not_empty',    label: 'is not empty' },
  ],
};

// ============================================================================
// Core Evaluation Functions
// ============================================================================

/**
 * Evaluate condition groups against a record's properties.
 *
 * Returns true if the record matches the conditions, false otherwise.
 * NULL conditionGroups = always returns true (runs on all records).
 *
 * @param properties - Record properties (e.g., { country: 'US', phone: '555-867-5309' })
 * @param conditionGroups - Condition groups to evaluate (NULL = always true)
 * @returns true if record matches conditions, false otherwise
 */
export function evaluateConditionGroups(
  properties: Record<string, any>,
  conditionGroups: ConditionGroups | null
): boolean {
  // NULL conditions = run on all records (existing behavior)
  if (!conditionGroups) return true;

  // Evaluate each group
  const groupResults = conditionGroups.groups.map(group => {
    const conditionResults = group.conditions.map(condition => {
      try {
        return evaluateSingleCondition(
          properties[condition.field],
          condition.operator,
          condition.value,
          condition.fieldType
        );
      } catch (err) {
        // Soft failure: log warning but don't crash normalization
        console.warn(
          `[Condition Evaluator] Error evaluating condition for field '${condition.field}':`,
          err
        );
        return false; // Missing/invalid field = condition fails
      }
    });

    // Group match: all = AND, any = OR
    return group.match === 'all'
      ? conditionResults.every(Boolean)
      : conditionResults.some(Boolean);
  });

  // Top-level match: all = AND between groups, any = OR between groups
  return conditionGroups.match === 'all'
    ? groupResults.every(Boolean)
    : groupResults.some(Boolean);
}

/**
 * Evaluate a single condition against a field value.
 *
 * @param rawValue - Field value from record (can be string, number, boolean, null, undefined)
 * @param operator - Comparison operator
 * @param conditionValue - Expected value to compare against
 * @param fieldType - Field type (determines operator behavior)
 * @returns true if condition passes, false otherwise
 */
function evaluateSingleCondition(
  rawValue: any,
  operator: Operator,
  conditionValue: any,
  fieldType: FieldType
): boolean {
  // Delegate to type-specific evaluators
  switch (fieldType) {
    case 'string':
      return evaluateStringCondition(rawValue, operator as StringOperator, conditionValue);
    case 'number':
      return evaluateNumberCondition(rawValue, operator as NumberOperator, conditionValue);
    case 'enumeration':
      return evaluateEnumCondition(rawValue, operator as EnumOperator, conditionValue);
    case 'bool':
      return evaluateBoolCondition(rawValue, operator as BoolOperator);
    case 'date':
      return evaluateDateCondition(rawValue, operator as DateOperator, conditionValue);
    default:
      console.warn(`[Condition Evaluator] Unknown field type: ${fieldType}`);
      return false;
  }
}

// ============================================================================
// String Operators
// ============================================================================

function evaluateStringCondition(
  rawValue: any,
  operator: StringOperator,
  conditionValue: any
): boolean {
  const value = rawValue?.toString() ?? '';
  const expected = conditionValue?.toString() ?? '';

  switch (operator) {
    case 'equals':
      return value.toLowerCase() === expected.toLowerCase();

    case 'not_equals':
      return value.toLowerCase() !== expected.toLowerCase();

    case 'contains':
      return value.toLowerCase().includes(expected.toLowerCase());

    case 'not_contains':
      return !value.toLowerCase().includes(expected.toLowerCase());

    case 'starts_with':
      return value.toLowerCase().startsWith(expected.toLowerCase());

    case 'ends_with':
      return value.toLowerCase().endsWith(expected.toLowerCase());

    case 'is_empty':
      return !rawValue || value.trim() === '';

    case 'is_not_empty':
      return !!rawValue && value.trim() !== '';

    case 'trimmed_equals':
      return value.trim().toLowerCase() === expected.trim().toLowerCase();

    case 'is_personal_email': {
      // Extract domain from email (part after @)
      const domain = value.split('@')[1]?.toLowerCase() || '';
      return PERSONAL_EMAIL_DOMAINS.includes(domain);
    }

    case 'is_not_personal_email': {
      // Extract domain from email (part after @)
      const domain = value.split('@')[1]?.toLowerCase() || '';
      return !PERSONAL_EMAIL_DOMAINS.includes(domain);
    }

    default:
      console.warn(`[Condition Evaluator] Unknown string operator: ${operator}`);
      return false;
  }
}

// ============================================================================
// Number Operators
// ============================================================================

function evaluateNumberCondition(
  rawValue: any,
  operator: NumberOperator,
  conditionValue: any
): boolean {
  // Handle is_empty/is_not_empty first (don't require numeric conversion)
  if (operator === 'is_empty') {
    return rawValue === null || rawValue === undefined || rawValue === '';
  }
  if (operator === 'is_not_empty') {
    return rawValue !== null && rawValue !== undefined && rawValue !== '';
  }

  // Convert to number
  const numValue = Number(rawValue);
  if (isNaN(numValue)) {
    // Non-numeric value = condition fails (except for is_empty which already returned)
    return false;
  }

  switch (operator) {
    case 'equals':
      return numValue === Number(conditionValue);

    case 'not_equals':
      return numValue !== Number(conditionValue);

    case 'gt':
      return numValue > Number(conditionValue);

    case 'gte':
      return numValue >= Number(conditionValue);

    case 'lt':
      return numValue < Number(conditionValue);

    case 'lte':
      return numValue <= Number(conditionValue);

    case 'between': {
      // conditionValue should be { min, max } or [min, max]
      const min = Array.isArray(conditionValue)
        ? Number(conditionValue[0])
        : Number(conditionValue.min);
      const max = Array.isArray(conditionValue)
        ? Number(conditionValue[1])
        : Number(conditionValue.max);
      return numValue >= min && numValue <= max;
    }

    default:
      console.warn(`[Condition Evaluator] Unknown number operator: ${operator}`);
      return false;
  }
}

// ============================================================================
// Enumeration Operators
// ============================================================================

function evaluateEnumCondition(
  rawValue: any,
  operator: EnumOperator,
  conditionValue: any
): boolean {
  const value = rawValue?.toString() ?? '';

  switch (operator) {
    case 'equals':
      return value.toLowerCase() === conditionValue?.toString().toLowerCase();

    case 'not_equals':
      return value.toLowerCase() !== conditionValue?.toString().toLowerCase();

    case 'is_any_of': {
      // conditionValue should be string[]
      const options = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
      return options.some(opt => opt?.toString().toLowerCase() === value.toLowerCase());
    }

    case 'is_none_of': {
      // conditionValue should be string[]
      const options = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
      return !options.some(opt => opt?.toString().toLowerCase() === value.toLowerCase());
    }

    case 'is_empty':
      return !rawValue || value.trim() === '';

    case 'is_not_empty':
      return !!rawValue && value.trim() !== '';

    default:
      console.warn(`[Condition Evaluator] Unknown enum operator: ${operator}`);
      return false;
  }
}

// ============================================================================
// Boolean Operators
// ============================================================================

function evaluateBoolCondition(
  rawValue: any,
  operator: BoolOperator
): boolean {
  switch (operator) {
    case 'is_true':
      return rawValue === true || rawValue === 'true' || rawValue === '1' || rawValue === 1;

    case 'is_false':
      return rawValue === false || rawValue === 'false' || rawValue === '0' || rawValue === 0;

    case 'is_empty':
      return rawValue === null || rawValue === undefined || rawValue === '';

    default:
      console.warn(`[Condition Evaluator] Unknown bool operator: ${operator}`);
      return false;
  }
}

// ============================================================================
// Date Operators
// ============================================================================

function evaluateDateCondition(
  rawValue: any,
  operator: DateOperator,
  conditionValue: any
): boolean {
  // Handle is_empty/is_not_empty first (don't require date conversion)
  if (operator === 'is_empty') {
    return !rawValue || rawValue === '';
  }
  if (operator === 'is_not_empty') {
    return !!rawValue && rawValue !== '';
  }

  // Convert to Date
  const date = new Date(rawValue);
  if (isNaN(date.getTime())) {
    // Invalid date = condition fails
    console.warn(`[Condition Evaluator] Invalid date value: ${rawValue}`);
    return false;
  }

  switch (operator) {
    case 'equals': {
      const expectedDate = new Date(conditionValue);
      if (isNaN(expectedDate.getTime())) return false;
      // Compare date-only (ignore time) using UTC to avoid timezone issues
      return (
        date.getUTCFullYear() === expectedDate.getUTCFullYear() &&
        date.getUTCMonth() === expectedDate.getUTCMonth() &&
        date.getUTCDate() === expectedDate.getUTCDate()
      );
    }

    case 'before': {
      const expectedDate = new Date(conditionValue);
      if (isNaN(expectedDate.getTime())) return false;
      return date < expectedDate;
    }

    case 'after': {
      const expectedDate = new Date(conditionValue);
      if (isNaN(expectedDate.getTime())) return false;
      return date > expectedDate;
    }

    case 'between': {
      // conditionValue should be { from, to } or [from, to]
      const from = new Date(Array.isArray(conditionValue) ? conditionValue[0] : conditionValue.from);
      const to = new Date(Array.isArray(conditionValue) ? conditionValue[1] : conditionValue.to);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) return false;
      return date >= from && date <= to;
    }

    case 'in_last_n_days': {
      // conditionValue should be number (days)
      const days = Number(conditionValue);
      if (isNaN(days)) return false;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      return date >= cutoffDate;
    }

    default:
      console.warn(`[Condition Evaluator] Unknown date operator: ${operator}`);
      return false;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract all unique field names referenced in condition groups.
 * Used by normalization engine to determine which properties to fetch.
 *
 * @param conditionGroups - Condition groups
 * @returns Set of field names
 */
export function getConditionFields(conditionGroups: ConditionGroups | null): Set<string> {
  const fields = new Set<string>();

  if (!conditionGroups) return fields;

  for (const group of conditionGroups.groups) {
    for (const condition of group.conditions) {
      fields.add(condition.field);
    }
  }

  return fields;
}

/**
 * Count total number of conditions across all groups.
 * Used by UI to show badge like "⚡ 3 conditions".
 *
 * @param conditionGroups - Condition groups
 * @returns Total condition count
 */
export function countConditions(conditionGroups: ConditionGroups | null): number {
  if (!conditionGroups) return 0;
  return conditionGroups.groups.reduce(
    (sum, group) => sum + group.conditions.length,
    0
  );
}
