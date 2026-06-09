/**
 * Import Owner Assignment Rules - Engine
 *
 * Evaluates rules against contacts to determine owner assignments.
 * Used both client-side (live preview) and server-side (worker).
 */

import type {
  AssignmentRule,
  RuleCondition,
  FallbackConfig,
} from './rule-types';
import { classifyJobTitleLevel } from './client-job-classifier';
import { extractEmailDomain } from './name-cleaner';

interface ContactData {
  email?: string;
  job_title?: string;
  company?: string;
  location?: string;
  bucket?: string;
  email_domain?: string;
  job_title_level?: string;
}

/**
 * Apply owner assignment rules to a contact
 * Returns owner_id or null if unassigned
 */
export function applyOwnerRules(
  contact: ContactData,
  rules: AssignmentRule[],
  fallback: FallbackConfig
): string | null {
  // Evaluate rules in priority order
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    if (allConditionsMatch(contact, rule.conditions)) {
      return rule.owner_id;
    }
  }

  // No rule matched - apply fallback
  return applyFallback(contact, fallback);
}

/**
 * Check if all conditions in a rule match the contact
 */
export function allConditionsMatch(
  contact: ContactData,
  conditions: RuleCondition[]
): boolean {
  return conditions.every((c) => conditionMatches(contact, c));
}

/**
 * Check if a single condition matches the contact
 */
export function conditionMatches(
  contact: ContactData,
  condition: RuleCondition
): boolean {
  const value = getFieldValue(contact, condition.field);

  if (value === null || value === undefined) {
    return false;
  }

  switch (condition.operator) {
    case 'is_one_of':
      return condition.values.includes(value);

    case 'is_not_one_of':
      return !condition.values.includes(value);

    case 'contains':
      return condition.values.some((v) =>
        value.toLowerCase().includes(v.toLowerCase())
      );

    case 'does_not_contain':
      return !condition.values.some((v) =>
        value.toLowerCase().includes(v.toLowerCase())
      );

    case 'starts_with':
      return condition.values.some((v) =>
        value.toLowerCase().startsWith(v.toLowerCase())
      );

    default:
      return false;
  }
}

/**
 * Get field value from contact, with computed fields
 */
function getFieldValue(contact: ContactData, field: string): string {
  switch (field) {
    case 'job_title_level':
      return contact.job_title_level || classifyJobTitleLevel(contact.job_title);

    case 'job_title_contains':
      return contact.job_title || '';

    case 'email_domain':
    case 'email_domain_in':
      return contact.email_domain || extractEmailDomain(contact.email || '');

    case 'company_name':
      return contact.company || '';

    case 'location_contains':
      return contact.location || '';

    case 'bucket':
      return contact.bucket || '';

    default:
      return '';
  }
}

/**
 * Apply fallback logic when no rules match
 */
function applyFallback(contact: ContactData, fallback: FallbackConfig): string | null {
  switch (fallback.type) {
    case 'round_robin':
      return assignRoundRobin(contact, fallback.owners || []);

    case 'specific_owner':
      return fallback.owner_id || null;

    case 'unassigned':
      return null;

    default:
      return null;
  }
}

/**
 * Round-robin assignment based on email hash
 * Deterministic: same email always gets same owner
 */
function assignRoundRobin(
  contact: ContactData,
  owners: Array<{ id: string; weight: number }>
): string | null {
  if (owners.length === 0) {
    return null;
  }

  // Calculate total weight
  const totalWeight = owners.reduce((sum, o) => sum + o.weight, 0);
  if (totalWeight === 0) {
    return null;
  }

  // Use email hash to deterministically select owner
  const emailHash = hashString(contact.email || '');
  const position = emailHash % totalWeight;

  // Find owner at this position
  let cumulative = 0;
  for (const owner of owners) {
    cumulative += owner.weight;
    if (position < cumulative) {
      return owner.id;
    }
  }

  // Fallback to first owner
  return owners[0].id;
}

/**
 * Simple string hash for deterministic round-robin
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Preview assignments for all contacts
 * Returns counts per owner and source (rules vs fallback)
 */
export function previewAssignments(
  contacts: ContactData[],
  rules: AssignmentRule[],
  fallback: FallbackConfig
): {
  byOwner: Record<string, { rules: number; fallback: number; total: number }>;
  unassigned: number;
} {
  const byOwner: Record<string, { rules: number; fallback: number; total: number }> = {};
  let unassigned = 0;

  for (const contact of contacts) {
    // Check rules first
    let matched = false;
    let ownerId: string | null = null;

    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);
    for (const rule of sortedRules) {
      if (allConditionsMatch(contact, rule.conditions)) {
        ownerId = rule.owner_id;
        matched = true;
        break;
      }
    }

    // Apply fallback if no rule matched
    const source = matched ? 'rules' : 'fallback';
    if (!matched) {
      ownerId = applyFallback(contact, fallback);
    }

    // Track counts
    if (ownerId) {
      if (!byOwner[ownerId]) {
        byOwner[ownerId] = { rules: 0, fallback: 0, total: 0 };
      }
      byOwner[ownerId][source]++;
      byOwner[ownerId].total++;
    } else {
      unassigned++;
    }
  }

  return { byOwner, unassigned };
}
