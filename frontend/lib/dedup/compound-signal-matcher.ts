/**
 * Compound Signal Matching
 *
 * Configurable signal groups with AND logic within groups, OR logic between groups.
 * Falls back to cascade matching when no signal groups are configured.
 */

import type { CompanyProperties } from './company-signals';
import { evaluateCompanyPair } from './company-signals';
import { jaroWinkler } from '@/lib/import/matcher';

export interface SignalGroup {
  id: string;
  name: string;
  group_order: number;
  conditions: SignalCondition[];
}

export interface SignalCondition {
  id: string;
  field: string;
  match_type: 'exact' | 'fuzzy' | 'normalized';
  fuzzy_threshold: number;
  weight: number;
}

export interface SignalMatchResult {
  matched: boolean;
  score: number;
  signalsFired: string[];
  confidence: number;
}

/**
 * Normalize field value for comparison
 */
function normalizeForComparison(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Get field value from company record
 */
function getFieldValue(
  company: CompanyProperties,
  field: string
): string | null | undefined {
  // CompanyProperties can be either flat {name, domain, ...} or nested {properties: {name, domain, ...}}
  const props = (company as any).properties || company;
  return (props as Record<string, any>)[field];
}

/**
 * Normalize field based on field type
 */
function normalizeField(value: string, field: string): string {
  // Phone normalization (E.164)
  if (field === 'phone' || field.includes('phone')) {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
    return `+${digits}`;
  }

  // URL normalization (canonical)
  if (field === 'domain' || field.includes('url') || field.includes('website')) {
    return value
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/$/, '')
      .split('/')[0];
  }

  // Default: lowercase + trim
  return normalizeForComparison(value);
}

/**
 * Check if a single signal group matches
 * ALL conditions must match (AND logic)
 */
export function matchesSignalGroup(
  companyA: CompanyProperties,
  companyB: CompanyProperties,
  group: SignalGroup
): { matched: boolean; score: number; signalsFired: string[] } {
  const signalsFired: string[] = [];
  let totalWeight = 0;
  let matchedWeight = 0;

  for (const condition of group.conditions) {
    totalWeight += condition.weight;
    const valueA = getFieldValue(companyA, condition.field);
    const valueB = getFieldValue(companyB, condition.field);

    if (!valueA || !valueB) {
      // Required field missing - group doesn't match
      return { matched: false, score: 0, signalsFired: [] };
    }

    let matched = false;

    switch (condition.match_type) {
      case 'exact': {
        matched =
          normalizeForComparison(valueA) === normalizeForComparison(valueB);
        break;
      }

      case 'fuzzy': {
        const similarity = jaroWinkler(
          normalizeForComparison(valueA),
          normalizeForComparison(valueB)
        );
        matched = similarity >= condition.fuzzy_threshold;
        break;
      }

      case 'normalized': {
        matched =
          normalizeField(valueA, condition.field) ===
          normalizeField(valueB, condition.field);
        break;
      }
    }

    if (matched) {
      signalsFired.push(condition.field);
      matchedWeight += condition.weight;
    } else {
      // Required field in group failed - group doesn't match
      return { matched: false, score: 0, signalsFired: [] };
    }
  }

  const score = totalWeight > 0 ? matchedWeight / totalWeight : 0;

  return {
    matched: signalsFired.length === group.conditions.length,
    score,
    signalsFired,
  };
}

/**
 * Evaluate signal groups with OR logic between groups
 * Returns result from first matching group
 */
export function evaluateSignalGroups(
  companyA: CompanyProperties,
  companyB: CompanyProperties,
  groups: SignalGroup[]
): SignalMatchResult {
  // Try each group in order (OR logic between groups)
  for (const group of groups) {
    const result = matchesSignalGroup(companyA, companyB, group);

    if (result.matched) {
      // Convert score to confidence percentage
      const confidence = Math.round(result.score * 100);

      return {
        matched: true,
        score: result.score,
        signalsFired: result.signalsFired,
        confidence,
      };
    }
  }

  // No group matched
  return {
    matched: false,
    score: 0,
    signalsFired: [],
    confidence: 0,
  };
}

/**
 * Main matching function - uses signal groups if available, falls back to cascade
 */
export function evaluateCompanyPairWithSignalGroups(
  companyA: CompanyProperties,
  companyB: CompanyProperties,
  signalGroups: SignalGroup[]
): {
  confidence: number;
  grade: string;
  signalsFired: string[];
  nameSimilarity: number;
} {
  // Use signal groups if configured
  if (signalGroups && signalGroups.length > 0) {
    const result = evaluateSignalGroups(companyA, companyB, signalGroups);

    // Determine grade based on confidence
    let grade = 'D';
    if (result.confidence >= 97) grade = 'A';
    else if (result.confidence >= 85) grade = 'B';
    else if (result.confidence >= 70) grade = 'C';

    return {
      confidence: result.confidence,
      grade,
      signalsFired: result.signalsFired,
      nameSimilarity: 0, // Not used in signal groups mode
    };
  }

  // Fall back to existing cascade matching
  const cascadeResult = evaluateCompanyPair(companyA, companyB);
  return {
    confidence: cascadeResult.confidence,
    grade: cascadeResult.grade,
    signalsFired: cascadeResult.signalsFired.map((signal: any) => signal.type || signal),
    nameSimilarity: cascadeResult.nameSimilarity || 0,
  };
}
