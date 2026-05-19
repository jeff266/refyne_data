/**
 * Dedup Configurator Types
 *
 * Type definitions for dedup configuration and suppression rules.
 */

// ─────────────────────────────────────────────────────────────
// Dedup Config
// ─────────────────────────────────────────────────────────────

export type AutoMergeGrade = 'disabled' | 'A' | 'AB';
export type ParentAction = 'block' | 'review';
export type ParentSameAction = 'block' | 'review' | 'score';
export type SurvivorshipStrategy = 'most_associated' | 'oldest' | 'most_complete' | 'highest_score';
export type ScanTrigger = 'on_sync' | 'hourly' | 'daily' | 'manual';

/**
 * Dedup configuration for an organization.
 */
export interface DedupConfig {
  orgId: string;

  // Confidence bands
  autoMergeGrade: AutoMergeGrade;
  autoMergeThreshold: number;
  reviewFloorThreshold: number;

  // Signal weights
  signalPhoneWeight: number;
  signalAddressWeight: number;
  signalNameWeight: number;

  // Name matching
  nameLevenshteinFloor: number;
  nameDivergenceGuard: boolean;
  nameDivergenceFloor: number;
  stopwords: string[];

  // Parent-child behavior
  parentDirectAction: ParentAction;
  parentSameAction: ParentSameAction;
  parentOneMultiplier: number;
  parentDifferentScore: number;

  // Survivorship
  survivorshipDefault: SurvivorshipStrategy;
  bulkSurvivorship: SurvivorshipStrategy;

  // Core display fields
  coreDisplayFields: string[];

  // Post-merge
  archiveLosingRecord: boolean;
  transferAssociations: boolean;
  rollbackWindowHours: number;
  notifyOnAutoMerge: boolean;

  // Scan
  scanTrigger: ScanTrigger;

  createdAt: string;
  updatedAt: string;
}

/**
 * Database row format (snake_case).
 */
export interface DedupConfigRow {
  org_id: string;
  auto_merge_grade: AutoMergeGrade;
  auto_merge_threshold: number;
  review_floor_threshold: number;
  signal_phone_weight: number;
  signal_address_weight: number;
  signal_name_weight: number;
  name_levenshtein_floor: number;
  name_divergence_guard: boolean;
  name_divergence_floor: number;
  stopwords: string[];
  parent_direct_action: ParentAction;
  parent_same_action: ParentSameAction;
  parent_one_multiplier: number;
  parent_different_score: number;
  survivorship_default: SurvivorshipStrategy;
  bulk_survivorship: SurvivorshipStrategy;
  core_display_fields: string[];
  archive_losing_record: boolean;
  transfer_associations: boolean;
  rollback_window_hours: number;
  notify_on_auto_merge: boolean;
  scan_trigger: ScanTrigger;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────
// Suppression Rules
// ─────────────────────────────────────────────────────────────

export type SuppressionAction = 'block' | 'review' | 'require_approval';
export type ConditionOperator = 'AND' | 'OR';

export type RuleConditionOperator =
  | 'is_blank'
  | 'is_not_blank'
  | 'equals'
  | 'not_equals'
  | 'differs_between'
  | 'matches_between'
  | 'contains';

export type ConditionScope = 'record_a' | 'record_b' | 'both' | 'either';

/**
 * A single condition in a suppression rule.
 */
export interface RuleCondition {
  field: string;
  operator: RuleConditionOperator;
  value: string | null;
  scope: ConditionScope;
}

/**
 * Suppression rule for dedup pairs.
 */
export interface SuppressionRule {
  id: string;
  orgId: string;
  name: string;
  priority: number;
  enabled: boolean;
  action: SuppressionAction;
  approverUserId: string | null;
  conditionOperator: ConditionOperator;
  conditions: RuleCondition[];
  uiNote: string | null;
  suppressedCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Database row format (snake_case).
 */
export interface SuppressionRuleRow {
  id: string;
  org_id: string;
  name: string;
  priority: number;
  enabled: boolean;
  action: SuppressionAction;
  approver_user_id: string | null;
  condition_operator: ConditionOperator;
  conditions: RuleCondition[];
  ui_note: string | null;
  suppressed_count: number;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────
// API Request/Response Types
// ─────────────────────────────────────────────────────────────

/**
 * Partial config for PUT requests.
 */
export type DedupConfigUpdate = Partial<Omit<DedupConfig, 'orgId' | 'createdAt' | 'updatedAt'>>;

/**
 * Create suppression rule request.
 */
export interface CreateSuppressionRuleRequest {
  name: string;
  action: SuppressionAction;
  approverUserId?: string;
  conditionOperator: ConditionOperator;
  conditions: RuleCondition[];
  uiNote?: string;
}

/**
 * Update suppression rule request.
 */
export type UpdateSuppressionRuleRequest = Partial<Omit<
  SuppressionRule,
  'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'suppressedCount'
>>;

/**
 * Reorder rules request.
 */
export interface ReorderRulesRequest {
  ids: string[];
}

// ─────────────────────────────────────────────────────────────
// Conversion Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Convert database row to DedupConfig.
 */
export function rowToConfig(row: DedupConfigRow): DedupConfig {
  return {
    orgId: row.org_id,
    autoMergeGrade: row.auto_merge_grade,
    autoMergeThreshold: row.auto_merge_threshold,
    reviewFloorThreshold: row.review_floor_threshold,
    signalPhoneWeight: Number(row.signal_phone_weight),
    signalAddressWeight: Number(row.signal_address_weight),
    signalNameWeight: Number(row.signal_name_weight),
    nameLevenshteinFloor: Number(row.name_levenshtein_floor),
    nameDivergenceGuard: row.name_divergence_guard,
    nameDivergenceFloor: Number(row.name_divergence_floor),
    stopwords: row.stopwords,
    parentDirectAction: row.parent_direct_action,
    parentSameAction: row.parent_same_action,
    parentOneMultiplier: Number(row.parent_one_multiplier),
    parentDifferentScore: Number(row.parent_different_score),
    survivorshipDefault: row.survivorship_default,
    bulkSurvivorship: row.bulk_survivorship,
    coreDisplayFields: row.core_display_fields,
    archiveLosingRecord: row.archive_losing_record,
    transferAssociations: row.transfer_associations,
    rollbackWindowHours: row.rollback_window_hours,
    notifyOnAutoMerge: row.notify_on_auto_merge,
    scanTrigger: row.scan_trigger,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert DedupConfigUpdate to database columns.
 */
export function configUpdateToRow(
  update: DedupConfigUpdate
): Partial<Omit<DedupConfigRow, 'org_id' | 'created_at'>> {
  const row: Record<string, unknown> = {};

  if (update.autoMergeGrade !== undefined) row.auto_merge_grade = update.autoMergeGrade;
  if (update.autoMergeThreshold !== undefined) row.auto_merge_threshold = update.autoMergeThreshold;
  if (update.reviewFloorThreshold !== undefined) row.review_floor_threshold = update.reviewFloorThreshold;
  if (update.signalPhoneWeight !== undefined) row.signal_phone_weight = update.signalPhoneWeight;
  if (update.signalAddressWeight !== undefined) row.signal_address_weight = update.signalAddressWeight;
  if (update.signalNameWeight !== undefined) row.signal_name_weight = update.signalNameWeight;
  if (update.nameLevenshteinFloor !== undefined) row.name_levenshtein_floor = update.nameLevenshteinFloor;
  if (update.nameDivergenceGuard !== undefined) row.name_divergence_guard = update.nameDivergenceGuard;
  if (update.nameDivergenceFloor !== undefined) row.name_divergence_floor = update.nameDivergenceFloor;
  if (update.stopwords !== undefined) row.stopwords = update.stopwords;
  if (update.parentDirectAction !== undefined) row.parent_direct_action = update.parentDirectAction;
  if (update.parentSameAction !== undefined) row.parent_same_action = update.parentSameAction;
  if (update.parentOneMultiplier !== undefined) row.parent_one_multiplier = update.parentOneMultiplier;
  if (update.parentDifferentScore !== undefined) row.parent_different_score = update.parentDifferentScore;
  if (update.survivorshipDefault !== undefined) row.survivorship_default = update.survivorshipDefault;
  if (update.bulkSurvivorship !== undefined) row.bulk_survivorship = update.bulkSurvivorship;
  if (update.coreDisplayFields !== undefined) row.core_display_fields = update.coreDisplayFields;
  if (update.archiveLosingRecord !== undefined) row.archive_losing_record = update.archiveLosingRecord;
  if (update.transferAssociations !== undefined) row.transfer_associations = update.transferAssociations;
  if (update.rollbackWindowHours !== undefined) row.rollback_window_hours = update.rollbackWindowHours;
  if (update.notifyOnAutoMerge !== undefined) row.notify_on_auto_merge = update.notifyOnAutoMerge;
  if (update.scanTrigger !== undefined) row.scan_trigger = update.scanTrigger;

  row.updated_at = new Date().toISOString();

  return row as Partial<Omit<DedupConfigRow, 'org_id' | 'created_at'>>;
}

/**
 * Convert database row to SuppressionRule.
 */
export function rowToRule(row: SuppressionRuleRow): SuppressionRule {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    priority: row.priority,
    enabled: row.enabled,
    action: row.action,
    approverUserId: row.approver_user_id,
    conditionOperator: row.condition_operator,
    conditions: row.conditions,
    uiNote: row.ui_note,
    suppressedCount: row.suppressed_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert CreateSuppressionRuleRequest to database columns.
 */
export function createRequestToRow(
  orgId: string,
  priority: number,
  request: CreateSuppressionRuleRequest
): Omit<SuppressionRuleRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    org_id: orgId,
    name: request.name,
    priority,
    enabled: true,
    action: request.action,
    approver_user_id: request.approverUserId || null,
    condition_operator: request.conditionOperator,
    conditions: request.conditions,
    ui_note: request.uiNote || null,
    suppressed_count: 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Dedup Pairs
// ─────────────────────────────────────────────────────────────

export type PairGrade = 'A' | 'B' | 'C' | 'D';
export type PairStatus = 'pending' | 'approved' | 'rejected' | 'suppressed' | 'merged' | 'reversed';

/**
 * Signal that fired for a dedup pair.
 */
export interface FiredSignal {
  tier: number;
  type: string;
  deterministic: boolean;
  score: number;
}

/**
 * Field selection for merge.
 */
export type FieldSelection = 'record_a' | 'record_b';

/**
 * Dedup pair representing two potentially duplicate records.
 */
export interface DedupPair {
  id: string;
  orgId: string;
  recordAId: string;
  recordBId: string;
  recordAName?: string; // Company name from HubSpot
  recordBName?: string; // Company name from HubSpot
  confidence: number;
  grade: PairGrade;
  nameSimilarity: number | null;
  signalsFired: FiredSignal[];
  status: PairStatus;
  suppressionRuleId: string | null;
  survivingRecordId: string | null;
  mergedAt: string | null;
  mergedBy: string | null;
  fieldSelections: Record<string, FieldSelection> | null;
  detectedAt: string;
  updatedAt: string;
}

/**
 * Database row format for dedup_pairs.
 */
export interface DedupPairRow {
  id: string;
  org_id: string;
  record_a_id: string;
  record_b_id: string;
  connection_id: string | null;
  portal_id: string | null;
  confidence: number;
  grade: PairGrade;
  name_similarity: number | null;
  signals_fired: FiredSignal[];
  status: PairStatus;
  suppression_rule_id: string | null;
  surviving_record_id: string | null;
  merged_at: string | null;
  merged_by: string | null;
  field_selections: Record<string, FieldSelection> | null;
  detected_at: string;
  updated_at: string;
}

/**
 * Convert database row to DedupPair.
 */
export function rowToPair(row: DedupPairRow): DedupPair {
  return {
    id: row.id,
    orgId: row.org_id,
    recordAId: row.record_a_id,
    recordBId: row.record_b_id,
    confidence: Number(row.confidence),
    grade: row.grade,
    nameSimilarity: row.name_similarity !== null ? Number(row.name_similarity) : null,
    signalsFired: row.signals_fired,
    status: row.status,
    suppressionRuleId: row.suppression_rule_id,
    survivingRecordId: row.surviving_record_id,
    mergedAt: row.merged_at,
    mergedBy: row.merged_by,
    fieldSelections: row.field_selections,
    detectedAt: row.detected_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────
// Pairs API Types
// ─────────────────────────────────────────────────────────────

export interface PairsQueryParams {
  grade?: PairGrade | 'all';
  status?: PairStatus | 'all';
  signal?: string;
  sort?: 'confidence_desc' | 'confidence_asc' | 'detected_asc';
  page?: number;
  perPage?: number;
}

export interface PairsCounts {
  byGrade: Record<PairGrade, number>;
  byStatus: Record<PairStatus, number>;
}

export interface PairsListResponse {
  pairs: DedupPair[];
  total: number;
  counts: PairsCounts;
}

export interface BulkApproveRequest {
  pairIds: string[];
  survivorship?: 'record_a' | 'record_b' | 'config_default';
}

export interface BulkApproveResponse {
  queued: number;
  jobIds: string[];
}

export interface BulkRejectRequest {
  pairIds: string[];
}

export interface BulkRejectResponse {
  rejected: number;
}

export interface SingleApproveRequest {
  fieldSelections?: Record<string, FieldSelection>;
}

export interface SingleApproveResponse {
  jobId: string;
}
