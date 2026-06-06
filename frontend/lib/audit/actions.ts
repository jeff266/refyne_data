/**
 * Audit Log Action Constants
 *
 * Naming convention: {object}.{verb}
 * Phase 1: Core actions for dedup, harmonies, normalize, and policies
 */

export const AUDIT_ACTIONS = {
  // Dedup
  DEDUP_MERGE_EXECUTED: 'dedup.merge_executed',

  // Harmonies
  HARMONY_CREATED: 'harmony.created',
  HARMONY_UPDATED: 'harmony.updated',

  // Normalize
  NORMALIZE_APPLIED: 'normalize.applied',

  // Policies
  DEDUP_POLICY_UPDATED: 'dedup_policy.updated',

  // Enrichment
  ENRICH_RUN_STARTED: 'enrich_run.started',
  ENRICH_RUN_APPLIED: 'enrich_run.applied',
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];
