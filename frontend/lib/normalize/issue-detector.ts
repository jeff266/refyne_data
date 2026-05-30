/**
 * Normalize Issue Detector
 *
 * Counts companies with non-canonical values for each harmony field.
 * Supports both lookup harmonies (reference table) and format harmonies (validation rules).
 */

import type { HubSpotClient } from '../hubspot/client';
import type { Harmony } from '../harmonies/normalization-engine';
import { supabase } from '../db/supabase';

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
    return countFormatIssues(harmony, hubspot);
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

    // Fetch all companies with this field set
    const companies = await hubspot.searchCompanies(
      [
        {
          filters: [
            {
              propertyName: harmony.field,
              operator: 'HAS_PROPERTY',
            },
          ],
        },
      ],
      [harmony.field],
      100
    );

    // Count companies with non-canonical values
    let issueCount = 0;
    for (const company of companies) {
      const value = company.properties[harmony.field];
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
  hubspot: HubSpotClient
): Promise<number> {
  try {
    // Fetch companies with this field set
    const companies = await hubspot.searchCompanies(
      [
        {
          filters: [
            {
              propertyName: harmony.field,
              operator: 'HAS_PROPERTY',
            },
          ],
        },
      ],
      [harmony.field],
      100
    );

    // Count companies with non-canonical format
    let issueCount = 0;
    for (const company of companies) {
      const value = company.properties[harmony.field];
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
    case 'phone-e164':
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
 * Check if company name is in Title Case.
 * First letter of each word should be uppercase.
 * Handles common exceptions: LLC, Inc, Corp, Ltd
 */
export function isTitleCase(value: string): boolean {
  const words = value.split(/\s+/);

  return words.every(word => {
    // Handle common business suffixes that should be all caps
    const allCapsWords = ['LLC', 'INC', 'CORP', 'LTD', 'LP', 'LLP', 'PC'];
    if (allCapsWords.includes(word.toUpperCase())) {
      return true;
    }

    // Handle lowercase connectors
    const lowercaseWords = ['and', 'or', 'the', 'of', 'in', 'at', 'by', 'for'];
    if (lowercaseWords.includes(word.toLowerCase())) {
      return true;
    }

    // Check if first letter is uppercase
    return /^[A-Z]/.test(word);
  });
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
