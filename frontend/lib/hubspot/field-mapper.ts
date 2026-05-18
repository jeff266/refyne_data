/**
 * HubSpot Field Mapper
 *
 * Maps HubSpot company records to canonical format and vice versa.
 */

import type { HubSpotCompany, FieldMapping } from './types';
import type { RawRecord } from '../mcp/types';
import { DEFAULT_FIELD_MAPPINGS } from './types';

/**
 * Reverse mapping: HubSpot property → canonical field.
 */
type ReverseMapping = Map<string, string>;

/**
 * Build reverse mapping from field mappings.
 */
function buildReverseMapping(mappings: FieldMapping[]): ReverseMapping {
  const reverse = new Map<string, string>();

  for (const mapping of mappings) {
    if (mapping.isActive && (mapping.direction === 'read' || mapping.direction === 'bidirectional')) {
      reverse.set(mapping.hubspotProperty, mapping.canonicalField);
    }
  }

  return reverse;
}

/**
 * Convert a canonical field path to a flat key.
 * e.g., 'company.address.city' → 'hq_city'
 *
 * We use the canonical company schema field names from company.ts:
 * - company.name → name
 * - company.domain → domain
 * - company.industry → industry (or industry_raw)
 * - company.revenue → annual_revenue
 * - company.employees → employee_count
 * - company.phone → phone
 * - company.address.country → hq_country
 * - company.address.state → hq_state
 * - company.address.city → hq_city
 * - company.address.street → hq_address
 * - company.address.postal_code → hq_postal_code
 * - company.linkedin_url → linkedin_url
 * - company.description → description
 * - company.website → website
 * - company.founded_year → founded_year
 */
const CANONICAL_FIELD_MAP: Record<string, string> = {
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
 * Convert canonical field path to flat key.
 */
function canonicalToFlatKey(canonicalField: string): string {
  return CANONICAL_FIELD_MAP[canonicalField] || canonicalField;
}

/**
 * Parse numeric value from HubSpot string.
 */
function parseNumeric(value: string | null | undefined): number | null {
  if (!value) return null;
  const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? null : num;
}

/**
 * Map a HubSpot company to a RawRecord for the normalization pipeline.
 */
export function hubspotToRawRecord(
  company: HubSpotCompany,
  mappings: FieldMapping[] = getDefaultMappings()
): RawRecord {
  const reverseMapping = buildReverseMapping(mappings);

  const record: RawRecord = {
    _id: company.id,
    _hubspot_id: company.id,
    _label: company.properties.name || company.properties.domain || company.id,
  };

  // Map each HubSpot property to canonical field
  for (const [hsProperty, value] of Object.entries(company.properties)) {
    if (value === null || value === undefined) continue;

    const canonicalField = reverseMapping.get(hsProperty);
    if (canonicalField) {
      const flatKey = canonicalToFlatKey(canonicalField);

      // Convert numeric fields
      if (flatKey === 'annual_revenue' || flatKey === 'employee_count' || flatKey === 'founded_year') {
        record[flatKey] = parseNumeric(value);
      } else {
        record[flatKey] = value;
      }
    } else {
      // Include unmapped properties with hubspot_ prefix for reference
      record[`hubspot_${hsProperty}`] = value;
    }
  }

  // Also include raw properties for debugging
  record._raw_properties = company.properties;

  return record;
}

/**
 * Map multiple HubSpot companies to RawRecords.
 */
export function hubspotToRawRecords(
  companies: HubSpotCompany[],
  mappings: FieldMapping[] = getDefaultMappings()
): RawRecord[] {
  return companies.map(c => hubspotToRawRecord(c, mappings));
}

/**
 * Get default field mappings as FieldMapping array.
 */
function getDefaultMappings(): FieldMapping[] {
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

/**
 * Get the list of HubSpot properties to fetch based on field mappings.
 */
export function getPropertiesToFetch(mappings: FieldMapping[]): string[] {
  const properties = new Set<string>();

  for (const mapping of mappings) {
    if (mapping.isActive && (mapping.direction === 'read' || mapping.direction === 'bidirectional')) {
      properties.add(mapping.hubspotProperty);
    }
  }

  return Array.from(properties);
}

/**
 * Summary of a mapping operation.
 */
export interface MappingSummary {
  totalRecords: number;
  mappedFields: string[];
  unmappedHubSpotProperties: string[];
  sampleRecord: RawRecord | null;
}

/**
 * Get summary statistics for a mapping operation.
 */
export function getMappingSummary(
  companies: HubSpotCompany[],
  mappings: FieldMapping[]
): MappingSummary {
  if (companies.length === 0) {
    return {
      totalRecords: 0,
      mappedFields: [],
      unmappedHubSpotProperties: [],
      sampleRecord: null,
    };
  }

  const reverseMapping = buildReverseMapping(mappings);
  const allHsProperties = new Set<string>();

  // Collect all properties from all companies
  for (const company of companies) {
    for (const prop of Object.keys(company.properties)) {
      if (company.properties[prop] !== null) {
        allHsProperties.add(prop);
      }
    }
  }

  const mappedFields = Array.from(reverseMapping.keys()).filter(p => allHsProperties.has(p));
  const unmappedHubSpotProperties = Array.from(allHsProperties).filter(p => !reverseMapping.has(p));

  // Map first company as sample
  const sampleRecord = hubspotToRawRecord(companies[0], mappings);

  return {
    totalRecords: companies.length,
    mappedFields,
    unmappedHubSpotProperties,
    sampleRecord,
  };
}
