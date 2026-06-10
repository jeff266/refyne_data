/**
 * Field Exclusions UI - Plain Language Mappings
 *
 * Converts between user-friendly labels and database values.
 */

export interface FieldOption {
  label: string;
  value: string;
  category?: string;
}

export interface ExclusionTypeOption {
  label: string;
  value: 'never_merge' | 'union_true' | 'append';
  description: string;
}

export interface SeparatorOption {
  label: string;
  value: '\n' | '; ' | ', ';
}

// Compliance fields that are auto-protected
export const COMPLIANCE_FIELDS = [
  'HasOptedOutOfEmail',
  'DoNotCall',
  'hs_email_optout',
  'hs_email_bounce',
];

export const COMPANY_COMMON_FIELDS: FieldOption[] = [
  // Notes & Descriptions
  { label: 'Notes', value: 'notes', category: 'Notes & Descriptions' },
  { label: 'Description', value: 'description', category: 'Notes & Descriptions' },
  { label: 'Company notes', value: 'hs_note_body', category: 'Notes & Descriptions' },
  // Hierarchy
  { label: 'Parent company ID', value: 'hs_parent_company_id', category: 'Hierarchy' },
  { label: 'Account type', value: 'type', category: 'Hierarchy' },
];

export const CONTACT_COMMON_FIELDS: FieldOption[] = [
  // Notes & Descriptions
  { label: 'Notes', value: 'notes', category: 'Notes & Descriptions' },
  { label: 'Description', value: 'description', category: 'Notes & Descriptions' },
  // Identity
  { label: 'Lead source', value: 'hs_lead_source', category: 'Identity' },
  { label: 'Original source', value: 'hs_analytics_source', category: 'Identity' },
];

export const EXCLUSION_TYPES: ExclusionTypeOption[] = [
  {
    label: 'Never merge',
    value: 'never_merge',
    description: 'Field is never touched during merge. Surviving record keeps its value.',
  },
  {
    label: 'Append',
    value: 'append',
    description: 'Values from all records are combined. Best for notes and descriptions.',
  },
  {
    label: 'If any = true',
    value: 'union_true',
    description: 'Result is true if ANY record is true. Best for boolean opt-out fields.',
  },
];

export const SEPARATOR_OPTIONS: SeparatorOption[] = [
  { label: 'New line', value: '\n' },
  { label: 'Semicolon', value: '; ' },
  { label: 'Comma', value: ', ' },
];

export function getExclusionTypeLabel(type: string): string {
  return EXCLUSION_TYPES.find((t) => t.value === type)?.label || type;
}

export function getSeparatorLabel(separator: string): string {
  return SEPARATOR_OPTIONS.find((s) => s.value === separator)?.label || separator;
}

export function getFieldLabel(fieldValue: string, objectType: 'company' | 'contact'): string {
  const fields = objectType === 'company' ? COMPANY_COMMON_FIELDS : CONTACT_COMMON_FIELDS;
  const found = fields.find((f) => f.value === fieldValue);
  return found ? found.label : fieldValue;
}

export function isComplianceField(fieldName: string): boolean {
  return COMPLIANCE_FIELDS.includes(fieldName);
}

/**
 * Get badge color for exclusion type
 */
export function getTypeBadgeColor(type: string): {
  background: string;
  color: string;
} {
  switch (type) {
    case 'never_merge':
      return { background: 'rgba(255,255,255,0.1)', color: '#888' };
    case 'append':
      return { background: 'rgba(46,107,168,0.2)', color: '#6B9BD1' };
    case 'union_true':
      return { background: 'rgba(217,119,6,0.2)', color: '#F59E0B' };
    default:
      return { background: 'rgba(255,255,255,0.1)', color: '#888' };
  }
}
