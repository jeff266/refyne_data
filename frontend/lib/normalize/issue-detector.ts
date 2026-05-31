/**
 * Normalize Issue Detector
 *
 * Counts companies with non-canonical values for each harmony field.
 * Supports both lookup harmonies (reference table) and format harmonies (validation rules).
 */

import type { HubSpotClient } from '../hubspot/client';
import type { Harmony } from '../harmonies/normalization-engine';
import { supabase } from '../db/supabase';
import { getFieldAssignments } from '../harmonies/field-assignments';

/**
 * Get HubSpot property name for a harmony using field assignments.
 * Falls back to extracting from canonical field if no assignment found.
 */
async function getHubSpotProperty(
  harmony: Harmony,
  orgId: string
): Promise<string | null> {
  // Try to get from field assignments first
  try {
    const assignments = await getFieldAssignments(orgId, harmony.objectType);
    const assignment = assignments.find(a => a.harmonyId === harmony.id);

    if (assignment) {
      return assignment.hubspotProperty;
    }
  } catch (err) {
    console.warn('[Issue Detector] Failed to get field assignment:', err);
  }

  // Fallback: extract from canonical field (legacy behavior)
  if (harmony.field.includes('.')) {
    return harmony.field.split('.').pop() || null;
  }
  return harmony.field;
}

/**
 * Count companies with issues for a specific harmony.
 * Handles both lookup and format harmonies.
 */
export async function countIssues(
  harmony: Harmony,
  hubspot: HubSpotClient,
  orgId: string
): Promise<number> {
  if (harmony.transformType === 'lookup') {
    return countLookupIssues(harmony, hubspot, orgId);
  } else {
    return countFormatIssues(harmony, hubspot, orgId);
  }
}

/**
 * Count issues for lookup harmonies.
 * Fetches canonical values from reference table, then counts companies with non-canonical values.
 */
async function countLookupIssues(
  harmony: Harmony,
  hubspot: HubSpotClient,
  orgId: string
): Promise<number> {
  if (!supabase || !harmony.referenceTable) {
    console.warn(`[Issue Detector] Cannot count lookup issues - missing supabase or reference table`);
    return 0;
  }

  try {
    // Fetch canonical values from reference table
    const { data: referenceData, error: refError } = await supabase
      .from('harmony_reference_data')
      .select('canonical_value')
      .eq('table_name', harmony.referenceTable)
      .eq('is_active', true)
      .or(`org_id.is.null,org_id.eq.${orgId}`); // Include global and org-specific

    if (refError) {
      console.error(`[Issue Detector] Failed to fetch reference data:`, refError);
      return 0;
    }

    const canonicalValues = new Set(
      (referenceData || []).map(r => r.canonical_value.toLowerCase())
    );

    if (canonicalValues.size === 0) {
      console.warn(`[Issue Detector] No canonical values found for ${harmony.referenceTable}`);
      return 0;
    }

    // Get HubSpot property name from field assignments
    const propertyName = await getHubSpotProperty(harmony, orgId);
    if (!propertyName) {
      console.warn(`[Issue Detector] No property mapping found for harmony ${harmony.id}`);
      return 0;
    }

    // Fetch all companies with this field set
    const companies = await hubspot.searchCompanies(
      [
        {
          filters: [
            {
              propertyName,
              operator: 'HAS_PROPERTY',
            },
          ],
        },
      ],
      [propertyName],
      100
    );

    // Count companies with non-canonical values
    let issueCount = 0;
    for (const company of companies) {
      const value = company.properties[propertyName];
      if (value && !canonicalValues.has(value.toLowerCase())) {
        issueCount++;
      }
    }

    return issueCount;
  } catch (error) {
    console.error(`[Issue Detector] Error counting lookup issues:`, error);
    return 0;
  }
}

/**
 * Count issues for format harmonies.
 * Fetches companies with field set, then validates each against format rules.
 */
async function countFormatIssues(
  harmony: Harmony,
  hubspot: HubSpotClient,
  orgId: string
): Promise<number> {
  try {
    // Get HubSpot property name from field assignments
    const propertyName = await getHubSpotProperty(harmony, orgId);
    if (!propertyName) {
      console.warn(`[Issue Detector] No property mapping found for harmony ${harmony.id}`);
      return 0;
    }

    // Fetch companies with this field set
    const companies = await hubspot.searchCompanies(
      [
        {
          filters: [
            {
              propertyName,
              operator: 'HAS_PROPERTY',
            },
          ],
        },
      ],
      [propertyName],
      100
    );

    // Count companies with non-canonical format
    let issueCount = 0;
    for (const company of companies) {
      const value = company.properties[propertyName];
      if (value && !matchesCanonicalFormat(harmony.id, value)) {
        issueCount++;
      }
    }

    return issueCount;
  } catch (error) {
    console.error(`[Issue Detector] Error counting format issues:`, error);
    return 0;
  }
}

/**
 * Check if a value matches the canonical format for a harmony.
 * Returns true if value is already canonical, false if it needs normalization.
 */
export function matchesCanonicalFormat(harmonyId: string, value: string): boolean {
  switch (harmonyId) {
    case 'phone': // Company phone harmony
    case 'contact-phone-e164': // Contact phone harmony
      return isE164Phone(value);

    case 'company-name':
      return isTitleCase(value);

    case 'linkedin-url':
      return isCanonicalLinkedIn(value);

    default:
      // Unknown harmony - assume it's canonical
      return true;
  }
}

/**
 * Check if phone number is in E.164 format.
 * Pattern: +[country code][number]
 * Example: +14155552671
 */
export function isE164Phone(value: string): boolean {
  // E.164 format: + followed by 1-3 digit country code and 6-14 digit number
  // Total length: 7-15 digits after the +
  return /^\+[1-9]\d{6,14}$/.test(value.trim());
}

/**
 * Check if input has mixed-case context suggesting intentional branding.
 * True if the string has both lowercase and uppercase letters.
 */
function hasMixedCaseContext(input: string): boolean {
  return /[a-z]/.test(input) && /[A-Z]/.test(input);
}

/**
 * Smart title case for company names.
 * Handles parentheses, abbreviations, brands, and conjunctions.
 */
export function toSmartTitleCase(input: string): string {
  const conjunctions = new Set([
    'and', 'or', 'the', 'of', 'in', 'for', 'with', 'at', 'by', 'to', 'a', 'an'
  ]);

  return input
    .trim()
    .split(/(\s+|(?=[(/])|(?<=[)/]))/) // Split on spaces and around parens
    .map((token, index) => {
      // Preserve punctuation tokens
      if (/^[()\/\-&,.]$/.test(token)) return token;
      if (!token.trim()) return token;

      // Strip leading/trailing whitespace for checks but preserve in output
      const trimmed = token.trim();

      // Rule 1: All-caps token 3 chars or fewer → preserve uppercase (includes acronyms in parens)
      if (/^[A-Z]{1,3}$/.test(trimmed)) return token;

      // Rule 2: All-caps 4-5 chars in mixed-case context → preserve
      if (/^[A-Z]{4,5}$/.test(trimmed) && hasMixedCaseContext(input)) return token;

      // Rule 3: Mixed-case brand token (camelCase/PascalCase brands)
      if (/^[a-z].*[A-Z]/.test(trimmed) || /^[A-Z][a-z]+[A-Z]/.test(trimmed)) return token;

      // Rule 4: Conjunctions lowercase unless first word
      const lower = token.toLowerCase();
      if (index > 0 && conjunctions.has(trimmed.toLowerCase())) return lower;

      // Rule 5: Standard title case
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

/**
 * Check if company name is already in smart title case.
 * Uses the same logic as toSmartTitleCase to determine if transformation is needed.
 */
export function isTitleCase(value: string): boolean {
  return toSmartTitleCase(value) === value;
}

/**
 * Check if LinkedIn URL is in canonical format.
 * Canonical: https://www.linkedin.com/company/[slug]
 */
export function isCanonicalLinkedIn(value: string): boolean {
  const trimmed = value.trim();

  // Canonical format must start with https://www.linkedin.com/company/
  if (!trimmed.startsWith('https://www.linkedin.com/company/')) {
    return false;
  }

  // Must not end with trailing slash
  if (trimmed.endsWith('/')) {
    return false;
  }

  // Must not have query params or fragments
  if (trimmed.includes('?') || trimmed.includes('#')) {
    return false;
  }

  return true;
}
