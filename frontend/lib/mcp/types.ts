/**
 * MCP Tool Types - Phase 8: MCP Tool Definitions
 *
 * Defines input/output types for all MCP tools:
 * - enrichment_pull: Fetch data from providers with optional normalization
 * - enrichment_normalize: Apply Harmony pipeline to data
 * - harmony_list: List available Harmonies for field/entity
 * - harmony_test: Test a Harmony against sample data
 */

import type { ProviderResponse } from '../providers/types';
import type { ValidatedHarmony } from '../harmonies/spec/schema';
import type { TestResults } from '../harmonies/engine/test-runner';
import type { ResolutionStrategy } from '../harmonies/canonical/provenance';

// ─────────────────────────────────────────────────────────────
// Common Types
// ─────────────────────────────────────────────────────────────

/**
 * Supported provider identifiers.
 */
export type ProviderId =
  | 'apollo'
  | 'zoominfo'
  | 'serper'
  | 'clay'
  | 'graphiq'
  | 'yelp';

/**
 * Entity types for normalization.
 */
export type EntityType = 'company' | 'person';

/**
 * Error response from MCP tools.
 */
export interface McpError {
  code:
    | 'invalid_input'
    | 'provider_error'
    | 'harmony_not_found'
    | 'normalization_error'
    | 'test_error'
    | 'internal_error';
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Base response wrapper for all MCP tools.
 */
export interface McpResponse<T> {
  success: boolean;
  data?: T;
  error?: McpError;
  timing?: {
    totalMs: number;
    [key: string]: number;
  };
}

// ─────────────────────────────────────────────────────────────
// enrichment_pull Tool
// ─────────────────────────────────────────────────────────────

/**
 * Query parameters for enrichment_pull.
 */
export interface EnrichmentQuery {
  /** Company domain (e.g., "notion.com") */
  domain?: string;
  /** Company name (fallback if domain not provided) */
  name?: string;
  /** Search term (for search providers like Serper, Yelp) */
  term?: string;
  /** Location filter */
  location?: string;
  /** Industry filter */
  industry?: string;
  /** Job titles to filter contacts by */
  titles?: string[];
  /** Max results for search queries */
  limit?: number;
  /** Capabilities search (GraphIQ) */
  capabilities?: string[];
  /** Categories (Yelp) */
  categories?: string;
}

/**
 * Input for enrichment_pull tool.
 */
export interface EnrichmentPullInput {
  /** Provider to pull data from */
  provider: ProviderId;
  /** Query parameters */
  query: EnrichmentQuery;
  /**
   * Whether to normalize the result.
   * Default depends on org's normalization mode:
   * - Implicit mode: true (auto-normalize)
   * - Explicit mode: false (return raw)
   */
  normalize?: boolean;
  /**
   * Pipeline ID to use for normalization.
   * If not provided, uses org's default pipeline.
   */
  pipeline?: string;
  /**
   * Resolution strategy when pulling from multiple sources.
   * Defaults to 'priority'.
   */
  resolutionStrategy?: ResolutionStrategy;
}

/**
 * Normalized entity output from enrichment_pull.
 * Returned when normalize=true.
 */
export interface CanonicalCompanyOutput {
  _type: 'company';
  _pipeline?: string;
  _normalized_at: string;
  name?: string;
  domain?: string;
  industry?: string;
  employee_count?: number;
  revenue?: number;
  description?: string;
  founded_year?: number;
  headquarters?: {
    city?: string;
    state?: string;
    country?: string;
  };
  linkedin_url?: string;
  phone?: string;
  /** Sources that contributed to this entity */
  _sources: string[];
  /** Raw provider response for reference */
  _raw?: Record<string, unknown>;
}

/**
 * Normalized person entity output.
 */
export interface CanonicalPersonOutput {
  _type: 'person';
  _pipeline?: string;
  _normalized_at: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  seniority?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  company?: string;
  _sources: string[];
  _raw?: Record<string, unknown>;
}

/**
 * Output from enrichment_pull tool.
 */
export type EnrichmentPullOutput =
  | ProviderResponse
  | ProviderResponse[]
  | CanonicalCompanyOutput
  | CanonicalCompanyOutput[]
  | CanonicalPersonOutput
  | CanonicalPersonOutput[];

// ─────────────────────────────────────────────────────────────
// enrichment_normalize Tool
// ─────────────────────────────────────────────────────────────

/**
 * Input for enrichment_normalize tool.
 */
export interface EnrichmentNormalizeInput {
  /** Provider response(s) to normalize */
  data: ProviderResponse | ProviderResponse[];
  /** Entity type to normalize to */
  entity: EntityType;
  /**
   * Pipeline ID to use for normalization.
   * If not provided, uses org's default pipeline.
   */
  pipeline?: string;
  /**
   * Resolution strategy when normalizing multiple sources.
   * Defaults to 'priority'.
   */
  resolutionStrategy?: ResolutionStrategy;
  /**
   * Provider priority order for 'priority' strategy.
   */
  priorityOrder?: string[];
}

/**
 * Output from enrichment_normalize tool.
 */
export type EnrichmentNormalizeOutput =
  | CanonicalCompanyOutput
  | CanonicalPersonOutput
  | CanonicalCompanyOutput[]
  | CanonicalPersonOutput[];

// ─────────────────────────────────────────────────────────────
// harmony_list Tool
// ─────────────────────────────────────────────────────────────

/**
 * Input for harmony_list tool.
 */
export interface HarmonyListInput {
  /**
   * Filter by canonical field (e.g., 'company.name', 'person.title').
   * Returns Harmonies that apply to this field.
   */
  field?: string;
  /**
   * Filter by entity type.
   */
  entity?: EntityType;
  /**
   * Filter by category (e.g., 'contact-fields', 'business-entities').
   */
  category?: string;
  /**
   * Filter by tags (returns Harmonies matching any tag).
   */
  tags?: string[];
  /**
   * Include full spec in output (default: false for summary only).
   */
  includeSpec?: boolean;
}

/**
 * Summary of a single Harmony.
 */
export interface HarmonySummary {
  id: string;
  version: string;
  name: string;
  description: string;
  category: string;
  entity: string | undefined;
  fields: string[];
  tags: string[];
  enabled: boolean;
  /** Full spec (only included if includeSpec=true) */
  spec?: ValidatedHarmony['spec'];
}

/**
 * Output from harmony_list tool.
 */
export interface HarmonyListOutput {
  total: number;
  harmonies: HarmonySummary[];
  /** Breakdown by category */
  byCategory?: Record<string, number>;
  /** Breakdown by entity */
  byEntity?: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────
// harmony_test Tool
// ─────────────────────────────────────────────────────────────

/**
 * Input for harmony_test tool.
 */
export interface HarmonyTestInput {
  /** Harmony ID to test */
  harmonyId: string;
  /**
   * Test data to run through the Harmony.
   * If not provided, runs the Harmony's embedded tests.
   */
  testData?: Array<{
    input: unknown;
    expected?: unknown;
    context?: Record<string, unknown>;
  }>;
  /**
   * Source provider for test execution context.
   * Default: 'test'
   */
  source?: string;
}

/**
 * Result of a single test case.
 */
export interface HarmonyTestCaseResult {
  name: string;
  passed: boolean;
  skipped: boolean;
  input: unknown;
  expected: unknown;
  actual: unknown;
  ruleApplied: string | null;
  error?: string;
  executionMs: number;
}

/**
 * Output from harmony_test tool.
 */
export interface HarmonyTestOutput {
  harmonyId: string;
  harmonyVersion: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  allPassed: boolean;
  results: HarmonyTestCaseResult[];
  totalExecutionMs: number;
}

// ─────────────────────────────────────────────────────────────
// harmonies_preview Tool
// ─────────────────────────────────────────────────────────────

/**
 * Raw record input for preview/apply operations.
 * Flexible schema to accept CSV or JSON data.
 */
export interface RawRecord {
  /** Unique identifier for this record (row number, ID field, etc.) */
  _id: string;
  /** Human-readable label for display (e.g., company name) */
  _label?: string;
  /** All other fields from the source data */
  [key: string]: unknown;
}

/**
 * Field-level preview result showing current vs projected value.
 */
export interface FieldPreviewResult {
  /** Canonical field name (e.g., 'company.name') */
  field: string;
  /** Current value before transformation */
  current: unknown;
  /** Projected value after transformation */
  projected: unknown;
  /** Whether this field changed, stayed the same, or errored */
  status: 'changed' | 'unchanged' | 'error';
  /** Error message if status is 'error' */
  error?: string;
  /** Which Harmony was applied */
  harmonyId?: string;
}

/**
 * Record-level preview result containing all field changes.
 */
export interface RecordPreviewResult {
  /** Record identifier */
  record_id: string;
  /** Human-readable label for display */
  record_label: string;
  /** Field-by-field preview results */
  fields: FieldPreviewResult[];
  /** Overall record status */
  status: 'changed' | 'unchanged' | 'error';
}

/**
 * Input for harmonies_preview tool.
 */
export interface HarmoniesPreviewInput {
  /** Harmony IDs to apply in the preview */
  harmony_ids: string[];
  /** Records to preview transformations on */
  records: RawRecord[];
}

/**
 * Summary statistics for the preview.
 */
export interface PreviewSummary {
  /** Number of records with at least one change */
  changed: number;
  /** Number of records with no changes */
  unchanged: number;
  /** Number of records with at least one error */
  errors: number;
  /** Total records processed */
  total: number;
}

/**
 * Output from harmonies_preview tool.
 */
export interface HarmoniesPreviewOutput {
  /** Aggregate statistics */
  summary: PreviewSummary;
  /** Per-record preview results */
  results: RecordPreviewResult[];
}

// ─────────────────────────────────────────────────────────────
// harmonies_apply Tool
// ─────────────────────────────────────────────────────────────

/**
 * Input for harmonies_apply tool.
 */
export interface HarmoniesApplyInput {
  /** Harmony IDs to apply */
  harmony_ids: string[];
  /** Records to transform */
  records: RawRecord[];
}

/**
 * Error that occurred during apply.
 */
export interface ApplyError {
  /** Record that failed */
  record_id: string;
  /** Error message */
  error: string;
  /** Field that caused the error, if applicable */
  field?: string;
}

/**
 * Output from harmonies_apply tool.
 */
export interface HarmoniesApplyOutput {
  /** Number of records successfully transformed */
  applied: number;
  /** Errors that occurred during apply */
  errors: ApplyError[];
  /** The transformed records */
  records: RawRecord[];
}

// ─────────────────────────────────────────────────────────────
// Tool Registry Types
// ─────────────────────────────────────────────────────────────

/**
 * MCP tool definition.
 */
export interface McpToolDefinition<TInput, TOutput> {
  /** Tool name (e.g., 'enrichment_pull') */
  name: string;
  /** Tool description */
  description: string;
  /** JSON schema for input */
  inputSchema: Record<string, unknown>;
  /** Execute the tool */
  execute: (input: TInput) => Promise<McpResponse<TOutput>>;
}

/**
 * All MCP tools available.
 */
export type McpToolName =
  | 'enrichment_pull'
  | 'enrichment_normalize'
  | 'harmony_list'
  | 'harmony_test'
  | 'harmonies_preview'
  | 'harmonies_apply';
