/**
 * Signal Groups UI - Plain Language Mappings
 *
 * Converts between user-friendly labels and database values.
 */

export interface FieldOption {
  label: string;
  value: string;
  category?: string;
}

export interface MatchTypeOption {
  label: string;
  value: 'exact' | 'fuzzy' | 'normalized';
  description: string;
}

export interface AccuracyOption {
  label: string;
  value: number;
  description: string;
}

export const COMPANY_FIELDS: FieldOption[] = [
  // Company info
  { label: 'Company name', value: 'name', category: 'Company info' },
  { label: 'Website domain', value: 'domain', category: 'Company info' },
  { label: 'Phone number', value: 'phone', category: 'Company info' },
  { label: 'LinkedIn URL', value: 'linkedin_company_page', category: 'Company info' },
  // Location
  { label: 'Street address', value: 'address', category: 'Location' },
  { label: 'City', value: 'city', category: 'Location' },
  { label: 'State / Region', value: 'state', category: 'Location' },
  { label: 'Country', value: 'country', category: 'Location' },
  { label: 'Postal code', value: 'zip', category: 'Location' },
  // Classification
  { label: 'Industry', value: 'industry', category: 'Classification' },
  { label: 'Employee count', value: 'numberofemployees', category: 'Classification' },
];

export const CONTACT_FIELDS: FieldOption[] = [
  // Identity
  { label: 'Email address', value: 'email', category: 'Identity' },
  { label: 'First name', value: 'firstname', category: 'Identity' },
  { label: 'Last name', value: 'lastname', category: 'Identity' },
  { label: 'LinkedIn URL', value: 'linkedin_url', category: 'Identity' },
  { label: 'Phone number', value: 'phone', category: 'Identity' },
  // Association
  { label: 'Company name', value: 'company', category: 'Association' },
  { label: 'Account ID', value: 'associatedcompanyid', category: 'Association' },
];

export const MATCH_TYPES: MatchTypeOption[] = [
  {
    label: 'Must match',
    value: 'exact',
    description: 'exact match after normalization',
  },
  {
    label: 'Similar to',
    value: 'fuzzy',
    description: 'fuzzy match (Jaro-Winkler)',
  },
  {
    label: 'Normalized match',
    value: 'normalized',
    description: 'normalize first, then exact (best for phone, URL, email)',
  },
];

export const ACCURACY_LEVELS: AccuracyOption[] = [
  { label: 'Very high', value: 0.95, description: 'Nearly identical spelling' },
  { label: 'High', value: 0.90, description: 'Minor differences OK' },
  { label: 'Medium', value: 0.85, description: 'Some variation allowed' },
  { label: 'Low', value: 0.75, description: 'Significant variation OK' },
];

export function getFieldLabel(fieldValue: string, objectType: 'company' | 'contact'): string {
  const fields = objectType === 'company' ? COMPANY_FIELDS : CONTACT_FIELDS;
  return fields.find((f) => f.value === fieldValue)?.label || fieldValue;
}

export function getMatchTypeLabel(matchType: string): string {
  return MATCH_TYPES.find((m) => m.value === matchType)?.label || matchType;
}

export function getAccuracyLabel(threshold: number): string {
  // Find closest match
  const closest = ACCURACY_LEVELS.reduce((prev, curr) =>
    Math.abs(curr.value - threshold) < Math.abs(prev.value - threshold) ? curr : prev
  );
  return closest.label;
}

/**
 * Template presets for quick setup
 */
export const TEMPLATES = {
  standard: {
    name: 'Standard',
    description: 'Domain + Name',
    conditions: [
      { field: 'domain', match_type: 'exact' as const, fuzzy_threshold: 0.85, weight: 10 },
      { field: 'name', match_type: 'fuzzy' as const, fuzzy_threshold: 0.90, weight: 10 },
    ],
  },
  strict: {
    name: 'Strict',
    description: 'Domain + Name + Address',
    conditions: [
      { field: 'domain', match_type: 'exact' as const, fuzzy_threshold: 0.85, weight: 10 },
      { field: 'name', match_type: 'exact' as const, fuzzy_threshold: 0.85, weight: 10 },
      { field: 'address', match_type: 'exact' as const, fuzzy_threshold: 0.85, weight: 10 },
      { field: 'country', match_type: 'exact' as const, fuzzy_threshold: 0.85, weight: 10 },
    ],
  },
  nameLocation: {
    name: 'Name + Location',
    description: 'Name + Street + City + Country',
    conditions: [
      { field: 'name', match_type: 'fuzzy' as const, fuzzy_threshold: 0.90, weight: 10 },
      { field: 'address', match_type: 'exact' as const, fuzzy_threshold: 0.85, weight: 10 },
      { field: 'city', match_type: 'exact' as const, fuzzy_threshold: 0.85, weight: 10 },
      { field: 'country', match_type: 'exact' as const, fuzzy_threshold: 0.85, weight: 10 },
    ],
  },
};
