/**
 * Inverse Field Mapper
 *
 * Maps canonical RawRecord fields back to HubSpot properties.
 * Implements field-level write policies and enum validation.
 */

import type { RawRecord } from '../mcp/types';
import type { FieldMapping, WritePolicy, EnumValueOption, CanonicalToHubSpotMap } from './types';
import type { FieldWriteDecision } from './write-types';
import { DEFAULT_FIELD_MAPPINGS } from './types';

/**
 * Flat canonical key to HubSpot property mapping.
 * Reverse of CANONICAL_FIELD_MAP from field-mapper.ts.
 */
const FLAT_TO_HUBSPOT: Record<string, string> = {
  name: 'name',
  domain: 'domain',
  industry: 'industry',
  annual_revenue: 'annualrevenue',
  employee_count: 'numberofemployees',
  phone: 'phone',
  hq_country: 'country',
  hq_state: 'state',
  hq_city: 'city',
  hq_address: 'address',
  hq_postal_code: 'zip',
  linkedin_url: 'linkedin_company_page',
  description: 'description',
  website: 'website',
  founded_year: 'founded_year',
};

/**
 * Canonical field path to flat key mapping.
 * Used to match field mappings to record fields.
 */
const CANONICAL_TO_FLAT: Record<string, string> = {
  'company.name': 'name',
  'company.domain': 'domain',
  'company.industry': 'industry',
  'company.revenue': 'annual_revenue',
  'company.employees': 'employee_count',
  'company.phone': 'phone',
  'company.address.country': 'hq_country',
  'company.address.state': 'hq_state',
  'company.address.city': 'hq_city',
  'company.address.street': 'hq_address',
  'company.address.postal_code': 'hq_postal_code',
  'company.linkedin_url': 'linkedin_url',
  'company.description': 'description',
  'company.website': 'website',
  'company.founded_year': 'founded_year',
};

/**
 * Write mapping info for a single field.
 */
interface WriteMappingInfo {
  property: string;
  policy: WritePolicy;
  validValues: EnumValueOption[] | null;
  fieldType: string | null;
  canonicalToHubspotMap: CanonicalToHubSpotMap | null;
}

/**
 * Build a mapping from canonical field paths to HubSpot property info.
 * Filters to only 'write' or 'bidirectional' mappings.
 */
export function buildWriteMappings(
  mappings: FieldMapping[]
): Map<string, WriteMappingInfo> {
  const writeMappings = new Map<string, WriteMappingInfo>();

  for (const mapping of mappings) {
    if (!mapping.isActive) continue;
    if (mapping.direction !== 'write' && mapping.direction !== 'bidirectional') continue;

    writeMappings.set(mapping.canonicalField, {
      property: mapping.hubspotProperty,
      policy: mapping.writePolicy,
      validValues: mapping.validValues,
      fieldType: mapping.fieldType,
      canonicalToHubspotMap: mapping.canonicalToHubspotMap,
    });
  }

  return writeMappings;
}

/**
 * Determine if a field should be written based on write policy.
 */
function shouldWriteField(
  newValue: unknown,
  currentHubSpotValue: unknown,
  policy: WritePolicy
): { write: boolean; reason: FieldWriteDecision['reason'] } {
  // Skip if values are the same
  const newStr = formatValue(newValue);
  const currentStr = formatValue(currentHubSpotValue);

  if (newStr === currentStr) {
    return { write: false, reason: 'no_change' };
  }

  switch (policy) {
    case 'always_overwrite':
      return { write: true, reason: 'always_overwrite' };

    case 'never_overwrite':
      return { write: false, reason: 'never_overwrite' };

    case 'overwrite_if_blank_or_ours':
      // Write if HubSpot value is blank
      if (
        currentHubSpotValue === null ||
        currentHubSpotValue === undefined ||
        currentHubSpotValue === ''
      ) {
        return { write: true, reason: 'blank_in_hubspot' };
      }
      // For now, don't write if HubSpot has a different value
      // (Provenance tracking for 'we_last_wrote' would require database)
      return { write: false, reason: 'hubspot_has_different_value' };

    default:
      return { write: false, reason: 'never_overwrite' };
  }
}

/**
 * Format a value for comparison and HubSpot API.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    // Handle normalized industry objects from linkedin-url harmony
    if ('url' in value) return String((value as { url: string }).url);
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Get the value to write to HubSpot.
 * Handles type conversion and special cases.
 */
function getWriteValue(value: unknown): string | number | null {
  if (value === null || value === undefined || value === '') return null;

  // Handle normalized objects (e.g., linkedin-url returns { url, type, ... })
  if (typeof value === 'object' && value !== null) {
    if ('url' in value) return String((value as { url: string }).url);
    return null; // Skip complex objects we can't serialize
  }

  if (typeof value === 'number') return value;
  return String(value);
}

/**
 * Check if a value is valid for an enum field.
 * Returns the translated value if a mapping exists, or null if invalid.
 *
 * Priority order:
 * 1. Explicit canonicalToHubspotMap entry (if exists but invalid, fail immediately)
 * 2. Direct value match in valid_values
 * 3. Label match in valid_values (case-insensitive)
 */
function checkEnumValue(
  value: unknown,
  validValues: EnumValueOption[] | null,
  canonicalToHubspotMap: CanonicalToHubSpotMap | null
): { valid: boolean; translatedValue: string | null; reason: 'enum_translated' | 'enum_mismatch' | null } {
  // No enum validation needed
  if (!validValues || validValues.length === 0) {
    return { valid: true, translatedValue: null, reason: null };
  }

  const stringValue = String(value);

  // Check if there's an explicit canonical-to-HubSpot mapping
  if (canonicalToHubspotMap && stringValue in canonicalToHubspotMap) {
    const translatedValue = canonicalToHubspotMap[stringValue];
    // Verify the translated value is in valid_values
    if (validValues.some(opt => opt.value === translatedValue)) {
      return { valid: true, translatedValue, reason: 'enum_translated' };
    }
    // Explicit mapping exists but points to invalid value - fail, don't fall back
    return { valid: false, translatedValue: null, reason: 'enum_mismatch' };
  }

  // Check if the value directly matches a valid HubSpot enum value
  if (validValues.some(opt => opt.value === stringValue)) {
    return { valid: true, translatedValue: null, reason: null };
  }

  // Check if the value matches by label (case-insensitive)
  const matchByLabel = validValues.find(
    opt => opt.label.toLowerCase() === stringValue.toLowerCase()
  );
  if (matchByLabel) {
    return { valid: true, translatedValue: matchByLabel.value, reason: 'enum_translated' };
  }

  // No valid mapping found
  return { valid: false, translatedValue: null, reason: 'enum_mismatch' };
}

/**
 * Log a blocked write due to enum mismatch.
 */
function logEnumMismatch(
  fieldName: string,
  hubspotProperty: string,
  value: unknown,
  validValues: EnumValueOption[]
): void {
  const validValuesList = validValues.slice(0, 5).map(v => v.value).join(', ');
  const moreCount = validValues.length > 5 ? ` (+${validValues.length - 5} more)` : '';
  console.warn(
    `[inverse-mapper] Blocked write for ${fieldName} → ${hubspotProperty}: ` +
    `value "${value}" not in valid_values [${validValuesList}${moreCount}]. ` +
    `Reason: enum_mismatch`
  );
}

/**
 * Convert canonical RawRecord fields to HubSpot properties.
 * Applies field-level write policies and enum validation.
 *
 * @param record - Normalized record to convert
 * @param mappings - Field mappings with write policies
 * @param currentHubSpotValues - Current values in HubSpot for policy check
 * @returns Properties to write and per-field decisions
 */
export function canonicalToHubSpotProperties(
  record: RawRecord,
  mappings: FieldMapping[],
  currentHubSpotValues: Record<string, string | null>
): {
  properties: Record<string, string | number | null>;
  decisions: FieldWriteDecision[];
} {
  const properties: Record<string, string | number | null> = {};
  const decisions: FieldWriteDecision[] = [];

  const writeMappings = buildWriteMappings(mappings);

  // Process each writable mapping
  for (const [canonicalField, { property, policy, validValues, canonicalToHubspotMap }] of Array.from(writeMappings.entries())) {
    // Get the flat key for this canonical field
    const flatKey = CANONICAL_TO_FLAT[canonicalField] || canonicalField;

    // Get value from record
    const newValue = record[flatKey];
    const currentValue = currentHubSpotValues[property];

    // Skip if no new value
    if (newValue === undefined) continue;

    // Check enum validation if field has valid_values
    if (validValues && validValues.length > 0) {
      const enumCheck = checkEnumValue(newValue, validValues, canonicalToHubspotMap);

      if (!enumCheck.valid) {
        // Block write due to enum mismatch
        logEnumMismatch(flatKey, property, newValue, validValues);
        decisions.push({
          fieldName: flatKey,
          hubspotProperty: property,
          action: 'skip',
          reason: 'enum_mismatch',
          currentValue,
          newValue,
        });
        continue;
      }

      // If we have a translation, use it
      if (enumCheck.translatedValue) {
        const { write, reason: policyReason } = shouldWriteField(enumCheck.translatedValue, currentValue, policy);

        decisions.push({
          fieldName: flatKey,
          hubspotProperty: property,
          action: write ? 'write' : 'skip',
          reason: write ? 'enum_translated' : policyReason,
          currentValue,
          newValue,
          translatedValue: enumCheck.translatedValue,
        });

        if (write) {
          properties[property] = enumCheck.translatedValue;
        }
        continue;
      }
    }

    // Standard policy check (no enum or value directly valid)
    const { write, reason } = shouldWriteField(newValue, currentValue, policy);
    const writeValue = getWriteValue(newValue);

    const decision: FieldWriteDecision = {
      fieldName: flatKey,
      hubspotProperty: property,
      action: write ? 'write' : 'skip',
      reason,
      currentValue,
      newValue,
    };

    decisions.push(decision);

    if (write && writeValue !== null) {
      properties[property] = writeValue;
    }
  }

  return { properties, decisions };
}

/**
 * Get default field mappings as FieldMapping array.
 */
export function getDefaultWriteMappings(): FieldMapping[] {
  return DEFAULT_FIELD_MAPPINGS.map((m, i) => ({
    id: `default-${i}`,
    canonicalField: m.canonicalField,
    hubspotProperty: m.hubspotProperty,
    direction: 'bidirectional' as const,
    writePolicy: 'overwrite_if_blank_or_ours' as const,
    validValues: null,
    fieldType: null,
    canonicalToHubspotMap: null,
    isActive: true,
  }));
}
