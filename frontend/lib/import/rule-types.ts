/**
 * Import Owner Assignment Rules - Type Definitions
 */

export type RuleField =
  | 'job_title_level'
  | 'job_title_contains'
  | 'company_name'
  | 'email_domain'
  | 'location_contains'
  | 'bucket'
  | 'email_domain_in';

export type RuleOperator =
  | 'is_one_of'
  | 'is_not_one_of'
  | 'contains'
  | 'does_not_contain'
  | 'starts_with';

export interface RuleCondition {
  field: RuleField;
  operator: RuleOperator;
  values: string[];
}

export interface AssignmentRule {
  id: string;
  conditions: RuleCondition[];
  owner_id: string;
  owner_name: string;
  priority: number;
}

export interface FallbackConfig {
  type: 'round_robin' | 'specific_owner' | 'unassigned';
  owners?: Array<{ id: string; name: string; weight: number }>;
  owner_id?: string;
}

export interface OwnerAssignmentConfig {
  rules: AssignmentRule[];
  fallback: FallbackConfig;
  override_existing: boolean;
  rule_set_id?: string;
}

export interface SavedRuleSet {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  rules: AssignmentRule[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Field value options
export const JOB_TITLE_LEVELS = [
  'C-Suite',
  'EVP',
  'SVP',
  'VP',
  'AVP',
  'Director',
  'Manager',
  'IC',
  'Founder',
  'Other',
  'Needs Review',
] as const;

export const BUCKET_OPTIONS = [
  'Customer',
  'Open Deal',
  'Former Customer',
  'Known Contact',
  'New Contact',
  'Needs Review',
] as const;

// Operator options per field type
export const FIELD_OPERATORS: Record<RuleField, RuleOperator[]> = {
  job_title_level: ['is_one_of', 'is_not_one_of'],
  job_title_contains: ['contains', 'does_not_contain'],
  email_domain: ['is_one_of', 'contains', 'starts_with'],
  email_domain_in: ['is_one_of'],
  location_contains: ['contains', 'does_not_contain'],
  bucket: ['is_one_of', 'is_not_one_of'],
  company_name: ['is_one_of', 'contains'],
};

// Field labels
export const FIELD_LABELS: Record<RuleField, string> = {
  job_title_level: 'Job title level',
  job_title_contains: 'Job title contains',
  email_domain: 'Email domain',
  email_domain_in: 'Email domain',
  location_contains: 'Location',
  bucket: 'Bucket',
  company_name: 'Company name',
};

// Operator labels
export const OPERATOR_LABELS: Record<RuleOperator, string> = {
  is_one_of: 'is one of',
  is_not_one_of: 'is not one of',
  contains: 'contains',
  does_not_contain: 'does not contain',
  starts_with: 'starts with',
};
