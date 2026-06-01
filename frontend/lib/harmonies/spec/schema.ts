import { z } from 'zod';

/**
 * Semver validation regex.
 * Matches: 1.0.0, 2.1.3, 0.0.1-alpha, 1.0.0-beta.1
 */
const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;

/**
 * Error handling policies for Harmony rules.
 * - fail-loud: Raise error, halt pipeline
 * - fail-silent-log: Skip rule, log warning, continue
 * - fail-default: Use declared default value, continue
 */
export const ErrorPolicySchema = z.enum([
  'fail-loud',
  'fail-silent-log',
  'fail-default',
]);
export type ErrorPolicy = z.infer<typeof ErrorPolicySchema>;

/**
 * Categories for organizing Harmonies in the library.
 */
export const HarmonyCategorySchema = z.enum([
  'business-entities',   // Company name normalization
  'geography',           // Country, state, address normalization
  'industry',            // Industry taxonomy mapping
  'contact-fields',      // Phone, email, name parsing
  'firmographics',       // Employee count, revenue normalization
  'social',              // LinkedIn, Twitter URL normalization
  'custom',              // User-defined
]);
export type HarmonyCategory = z.infer<typeof HarmonyCategorySchema>;

/**
 * A single rule within a Harmony.
 * Rules are evaluated in order; first matching rule wins.
 */
export const HarmonyRuleSchema = z.object({
  // Unique identifier within this Harmony
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, {
    message: 'Rule ID must be lowercase alphanumeric with hyphens only',
  }),

  // Human-readable description of what this rule does
  description: z.string().min(1),

  // JSONata condition - rule only runs if this evaluates to true
  // If omitted, rule always runs
  when: z.string().optional(),

  // JSONata transformation expression
  // The input is available as `value`, the full record as `$record`
  transform: z.string().min(1),

  // Default value if transform fails and policy is 'fail-default'
  default: z.unknown().optional(),
});
export type HarmonyRule = z.infer<typeof HarmonyRuleSchema>;

/**
 * Test case for a Harmony.
 * Every Harmony must have at least one test case.
 */
export const HarmonyTestCaseSchema = z.object({
  // Optional name for the test case
  name: z.string().optional(),

  // Input value to transform
  input: z.unknown(),

  // Expected output after transformation
  expected: z.unknown(),

  // Optional: full record context for rules that use $record
  context: z.record(z.string(), z.unknown()).optional(),

  // Should this test be skipped?
  skip: z.boolean().optional(),
});
export type HarmonyTestCase = z.infer<typeof HarmonyTestCaseSchema>;

/**
 * Scope definition - which fields this Harmony applies to.
 */
export const HarmonyScopeSchema = z.object({
  // Canonical field paths this Harmony targets
  // e.g., ['company.name', 'company.industry']
  fields: z.array(z.string().min(1)).min(1),

  // Optional: entity type restriction
  entity: z.enum(['company', 'person']).optional(),
});
export type HarmonyScope = z.infer<typeof HarmonyScopeSchema>;

/**
 * Output format option for structured harmonies.
 * Defines available output formats when harmony returns an object.
 */
export const OutputFormatOptionSchema = z.object({
  // Key to extract from output object (e.g., 'abbreviation', 'name', 'iso2')
  key: z.string().min(1),

  // Display label for UI (e.g., 'Abbreviation (CA)', 'Full name (California)')
  label: z.string().min(1),

  // Is this the default format?
  default: z.boolean().optional(),
});
export type OutputFormatOption = z.infer<typeof OutputFormatOptionSchema>;

/**
 * Complete Harmony specification.
 * This is the schema for YAML Harmony documents.
 */
export const HarmonySpecSchema = z.object({
  // Unique identifier (lowercase with hyphens)
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, {
    message: 'Harmony ID must be lowercase alphanumeric with hyphens only',
  }),

  // Semantic version
  version: z.string().regex(semverRegex, {
    message: 'Version must be valid semver (e.g., 1.0.0)',
  }),

  // Human-readable name
  name: z.string().min(1).max(100),

  // Detailed description of what this Harmony does
  description: z.string().min(1).max(500),

  // Category for organization
  category: HarmonyCategorySchema,

  // Author identifier (e.g., 'revops-impact', 'system', or org slug)
  author: z.string().min(1),

  // Which fields this Harmony targets
  applies_to: HarmonyScopeSchema,

  // Optional: restrict to specific providers
  // Empty array means all providers
  sources: z.array(z.string()).default([]),

  // Transformation rules (evaluated in order)
  rules: z.array(HarmonyRuleSchema).min(1),

  // Test cases (required, at least one)
  tests: z.array(HarmonyTestCaseSchema).min(1),

  // Error handling policy (default: fail-silent-log)
  on_error: ErrorPolicySchema.default('fail-silent-log'),

  // Optional: tags for search/filtering
  tags: z.array(z.string()).optional(),

  // Optional: dependencies on other Harmonies
  // These must run before this one
  depends_on: z.array(z.string()).optional(),

  // Optional: is this Harmony enabled by default in new pipelines?
  default_enabled: z.boolean().default(true),

  // Optional: output format options for structured harmonies
  // If present, harmony returns an object and user can choose which field to extract
  output_formats: z.array(OutputFormatOptionSchema).optional(),

  // Optional: rule explanation template with {{oldValue}} and {{newValue}} placeholders
  ruleExplanation: z.string().optional(),

  // Optional: transform type for harmonies ('lookup' or 'format')
  // - lookup: Uses reference table for value mapping
  // - format: Uses transform function for value transformation
  transformType: z.enum(['lookup', 'format']).optional(),

  // Optional: reference table name for lookup harmonies
  // Maps to reference data tables (e.g., 'countries', 'industries', 'contact_titles')
  referenceTable: z.string().optional(),

  // Optional: transform function identifier for format harmonies
  // Maps to FORMAT_FUNCTIONS in normalization engine (e.g., 'e164_phone', 'smart_title_case')
  transformFunction: z.string().optional(),

  // Optional: configuration object passed to transform function
  // Example: { default_country_code: "1", strip_extensions: true }
  transformConfig: z.record(z.string(), z.unknown()).optional(),
});
export type HarmonySpec = z.infer<typeof HarmonySpecSchema>;

/**
 * Validated Harmony with additional metadata.
 * This is what the engine works with after parsing.
 */
export interface ValidatedHarmony {
  spec: HarmonySpec;
  source: 'library' | 'custom';
  org_id?: string;
  compiled_at: string;
  hash: string; // SHA256 of spec for cache invalidation
}

/**
 * Validation result for a Harmony.
 */
export interface HarmonyValidationResult {
  valid: boolean;
  harmony?: HarmonySpec;
  errors: HarmonyValidationError[];
  warnings: HarmonyValidationWarning[];
}

export interface HarmonyValidationError {
  path: string;
  message: string;
  code: string;
}

export interface HarmonyValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

/**
 * Validate a raw object against the HarmonySpec schema.
 */
export function validateHarmonySpec(data: unknown): HarmonyValidationResult {
  const result = HarmonySpecSchema.safeParse(data);

  if (result.success) {
    return {
      valid: true,
      harmony: result.data,
      errors: [],
      warnings: collectWarnings(result.data),
    };
  }

  // Zod uses .issues for validation errors
  const issues = result.error.issues ?? [];

  return {
    valid: false,
    errors: issues.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code,
    })),
    warnings: [],
  };
}

/**
 * Collect warnings for valid but potentially problematic Harmonies.
 */
function collectWarnings(spec: HarmonySpec): HarmonyValidationWarning[] {
  const warnings: HarmonyValidationWarning[] = [];

  // Warn if no tests for edge cases
  if (spec.tests.length < 3) {
    warnings.push({
      path: 'tests',
      message: 'Consider adding more test cases for edge cases (null, empty string, etc.)',
      suggestion: 'Add tests for: normal input, null input, empty string input',
    });
  }

  // Warn if rules have no conditions
  const unconditionalRules = spec.rules.filter((r) => !r.when);
  if (unconditionalRules.length > 1) {
    warnings.push({
      path: 'rules',
      message: `${unconditionalRules.length} rules have no 'when' condition - only first will ever run`,
      suggestion: 'Add conditions to rules or merge into a single rule',
    });
  }

  // Warn if using fail-loud in production
  if (spec.on_error === 'fail-loud') {
    warnings.push({
      path: 'on_error',
      message: 'fail-loud policy will halt the entire pipeline on error',
      suggestion: 'Consider fail-silent-log or fail-default for production',
    });
  }

  return warnings;
}

/**
 * Get canonical field paths for an entity type.
 * Used to validate applies_to.fields.
 */
export function getCanonicalFieldPaths(entity: 'company' | 'person'): string[] {
  if (entity === 'company') {
    return [
      'company.name',
      'company.domain',
      'company.industry',
      'company.industry_raw',
      'company.employee_count',
      'company.employee_band',
      'company.annual_revenue',
      'company.revenue_band',
      'company.hq_country',
      'company.hq_state',
      'company.hq_city',
      'company.hq_address',
      'company.hq_postal_code',
      'company.founded_year',
      'company.linkedin_url',
      'company.description',
      'company.logo_url',
      'company.phone',
      'company.website',
      'company.technologies',
      'company.twitter_url',
      'company.facebook_url',
    ];
  }

  return [
    'person.first_name',
    'person.last_name',
    'person.full_name',
    'person.email',
    'person.email_status',
    'person.phone',
    'person.phone_type',
    'person.mobile',
    'person.title_raw',
    'person.title_normalized',
    'person.role',
    'person.seniority',
    'person.company_name',
    'person.company_domain',
    'person.linkedin_url',
    'person.city',
    'person.state',
    'person.country',
  ];
}

/**
 * Validate that field paths are valid canonical fields.
 */
export function validateFieldPaths(
  fields: string[],
  entity?: 'company' | 'person'
): { valid: boolean; invalidFields: string[] } {
  const validPaths = entity
    ? getCanonicalFieldPaths(entity)
    : [...getCanonicalFieldPaths('company'), ...getCanonicalFieldPaths('person')];

  const invalidFields = fields.filter((f) => !validPaths.includes(f));

  return {
    valid: invalidFields.length === 0,
    invalidFields,
  };
}
