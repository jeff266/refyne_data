/**
 * Compliance Dashboard Types
 *
 * Type definitions for the compliance scoring and monitoring system.
 */

// ─────────────────────────────────────────────────────────────
// Status Types
// ─────────────────────────────────────────────────────────────

/**
 * Compliance status of a normalized record field.
 *
 * - 'compliant': harmony_version matches current published version
 * - 'stale': harmony_version is older than current version (needs re-run)
 * - 'unprocessed': harmony_id is null (never been through normalization)
 */
export type ComplianceStatus = 'compliant' | 'stale' | 'unprocessed';

/**
 * Record type being tracked.
 */
export type RecordType = 'company' | 'contact';

/**
 * Insight type for auto-generated compliance insights.
 */
export type InsightType = 'pattern_gap' | 'new_source';

// ─────────────────────────────────────────────────────────────
// Database Row Types
// ─────────────────────────────────────────────────────────────

/**
 * Row from normalized_records table.
 */
export interface NormalizedRecordRow {
  id: string;
  org_id: string;
  record_id: string;
  record_type: RecordType;
  source: string | null;
  field: string;
  raw_value: string | null;
  normalized_value: string | null;
  harmony_id: string | null;
  harmony_version: string | null;
  status: ComplianceStatus;
  normalized_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Row from compliance_score_history table.
 */
export interface ComplianceScoreHistoryRow {
  id: string;
  org_id: string;
  score: number;
  compliant: number;
  stale: number;
  unprocessed: number;
  total: number;
  computed_at: string;
}

/**
 * Row from compliance_alerts table.
 */
export interface ComplianceAlertRow {
  id: string;
  org_id: string;
  score_threshold: number | null;
  harmony_threshold: number | null;
  unprocessed_threshold: number | null;
  notify_email: boolean;
  notify_slack_webhook: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Row from compliance_insights table.
 */
export interface ComplianceInsightRow {
  id: string;
  org_id: string;
  harmony_id: string | null;
  field: string | null;
  insight_type: InsightType;
  message: string;
  record_count: number;
  sample_values: unknown[] | null;
  created_at: string;
  dismissed_at: string | null;
}

// ─────────────────────────────────────────────────────────────
// Score Types
// ─────────────────────────────────────────────────────────────

/**
 * Current compliance score for an organization.
 */
export interface ComplianceScore {
  /** Compliance score as percentage (0-100) */
  score: number;
  /** Number of compliant records */
  compliant: number;
  /** Number of stale records (outdated Harmony version) */
  stale: number;
  /** Number of unprocessed records (never normalized) */
  unprocessed: number;
  /** Total records tracked */
  total: number;
  /** When this score was last computed */
  lastComputedAt: string | null;
}

/**
 * Per-Harmony breakdown of compliance.
 */
export interface HarmonyBreakdown {
  harmonyId: string;
  harmonyName?: string;
  description?: string;
  compliant: number;
  stale: number;
  unprocessed: number;
  /** Raw count of records affected (unprocessed + stale) */
  recordsAffected: number;
  /** Compliance rate for this Harmony (0-100) */
  rate: number;
  /** Delta vs previous score history entry */
  trend: number | null;
  /** Change since last scan (+/-%) */
  delta: number | null;
  /** Estimated score points gained if all records fixed */
  estimatedScoreImpact: number;
  /** Whether there's a clear fix action available */
  actionable: boolean;
  /** Route to navigate to for fixing this harmony */
  actionRoute: string | null;
}

/**
 * Per-field breakdown of compliance.
 */
export interface FieldBreakdown {
  field: string;
  compliant: number;
  stale: number;
  unprocessed: number;
  /** Compliance rate for this field (0-100) */
  rate: number;
}

/**
 * Score trend data point.
 */
export interface ScoreTrendPoint {
  score: number;
  compliant: number;
  stale: number;
  unprocessed: number;
  total: number;
  computedAt: string;
}

// ─────────────────────────────────────────────────────────────
// Drill-down Types
// ─────────────────────────────────────────────────────────────

/**
 * Filters for drill-down queries.
 */
export interface DrilldownFilters {
  harmonyId?: string;
  field?: string;
  status?: ComplianceStatus;
  recordType?: RecordType;
  page?: number;
  pageSize?: number;
}

/**
 * Single record in drill-down results.
 */
export interface DrilldownRecord {
  recordId: string;
  recordName?: string;
  field: string;
  rawValue: string | null;
  normalizedValue: string | null;
  status: ComplianceStatus;
  harmonyId: string | null;
  normalizedAt: string | null;
}

/**
 * Paginated drill-down result.
 */
export interface DrilldownResult {
  records: DrilldownRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─────────────────────────────────────────────────────────────
// Alert Types
// ─────────────────────────────────────────────────────────────

/**
 * Alert configuration for an organization.
 */
export interface AlertConfig {
  /** Alert when overall score drops below this (0-100) */
  scoreThreshold: number | null;
  /** Alert when any Harmony drops below this (0-100) */
  harmonyThreshold: number | null;
  /** Alert when unprocessed count exceeds this */
  unprocessedThreshold: number | null;
  /** Send email notifications */
  notifyEmail: boolean;
  /** Slack webhook URL for notifications */
  notifySlackWebhook: string | null;
}

/**
 * Alert evaluation result.
 */
export interface AlertEvaluation {
  triggered: boolean;
  reasons: AlertReason[];
}

/**
 * Reason an alert was triggered.
 */
export interface AlertReason {
  type: 'score_below' | 'harmony_below' | 'unprocessed_exceeded';
  threshold: number;
  actual: number;
  harmonyId?: string;
}

// ─────────────────────────────────────────────────────────────
// Insight Types
// ─────────────────────────────────────────────────────────────

/**
 * Compliance insight (pattern gap or new source issue).
 */
export interface ComplianceInsight {
  id: string;
  harmonyId: string | null;
  field: string | null;
  type: InsightType;
  message: string;
  recordCount: number;
  sampleValues: string[];
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// Scanner Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of a compliance scan job.
 */
export interface ScanResult {
  orgId: string;
  recordsScanned: number;
  fieldsProcessed: number;
  compliantCount: number;
  staleCount: number;
  unprocessedCount: number;
  insightsGenerated: number;
  alertsTriggered: boolean;
  durationMs: number;
  completedAt: string;
}

/**
 * Input for writing to normalized_records.
 */
export interface NormalizedRecordInput {
  orgId: string;
  recordId: string;
  recordType: RecordType;
  source?: string;
  field: string;
  rawValue: string | null;
  normalizedValue: string | null;
  harmonyId: string | null;
  harmonyVersion: string | null;
}

// ─────────────────────────────────────────────────────────────
// API Response Types
// ─────────────────────────────────────────────────────────────

/**
 * Response from GET /api/compliance/score
 */
export interface ScoreResponse {
  score: number;
  compliant: number;
  stale: number;
  unprocessed: number;
  total: number;
  lastComputedAt: string | null;
  trendDelta: number | null;
}

/**
 * Response from GET /api/compliance/breakdown
 */
export interface BreakdownResponse {
  by: 'harmony' | 'field';
  items: HarmonyBreakdown[] | FieldBreakdown[];
}

/**
 * Response from POST /api/compliance/scan
 */
export interface ScanEnqueueResponse {
  success: boolean;
  jobId: string;
}
