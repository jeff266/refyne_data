/**
 * HubSpot Write Path Types
 *
 * Type definitions for H2: Write Path + Dedup Gate.
 */

import type { RawRecord } from '../mcp/types';

/**
 * Dedup gate action for a single record.
 */
export type DedupAction = 'upsert' | 'insert' | 'review' | 'skip';

/**
 * Result of dedup gate check for a single record.
 */
export interface DedupGateResult {
  /** Action to take */
  action: DedupAction;
  /** HubSpot ID if action is 'upsert' */
  targetHubSpotId: string | null;
  /** Similarity score if match found */
  similarityScore: number | null;
  /** Per-field similarity breakdown */
  fieldComparison: Record<string, {
    incoming: unknown;
    existing: unknown;
    similarity: number;
  }> | null;
  /** Matched HubSpot record properties (for review) */
  matchedRecord: Record<string, unknown> | null;
  /** Warning message (e.g., potential duplicates found) */
  warning?: string;
}

/**
 * Field-level write decision.
 */
export interface FieldWriteDecision {
  /** Canonical field name */
  fieldName: string;
  /** HubSpot property name */
  hubspotProperty: string;
  /** Action taken */
  action: 'write' | 'skip';
  /** Reason for the action */
  reason:
    | 'always_overwrite'
    | 'blank_in_hubspot'
    | 'we_last_wrote'
    | 'never_overwrite'
    | 'hubspot_has_different_value'
    | 'no_change'
    | 'enum_mismatch'
    | 'enum_translated';
  /** Current value in HubSpot */
  currentValue: unknown;
  /** New value to write */
  newValue: unknown;
  /** Translated value (if enum_translated) */
  translatedValue?: string;
}

/**
 * Write result for a single record.
 */
export interface RecordWriteResult {
  /** Record ID from input */
  recordId: string;
  /** HubSpot object ID (null if not written) */
  hubspotId: string | null;
  /** Action taken */
  action: 'created' | 'updated' | 'skipped' | 'queued_for_review' | 'error';
  /** Dedup gate outcome */
  dedupOutcome: DedupGateResult;
  /** Fields that were updated */
  fieldsUpdated: FieldWriteDecision[];
  /** Fields that were skipped */
  fieldsSkipped: FieldWriteDecision[];
  /** Error message if action is 'error' */
  error?: string;
}

/**
 * Batch write result.
 */
export interface BatchWriteResult {
  /** Total records processed */
  total: number;
  /** Records created */
  created: number;
  /** Records updated */
  updated: number;
  /** Records skipped */
  skipped: number;
  /** Records queued for review */
  queuedForReview: number;
  /** Records with errors */
  errors: number;
  /** Per-record results */
  results: RecordWriteResult[];
  /** Timing breakdown */
  timing: {
    totalMs: number;
    dedupCheckMs: number;
    writeMs: number;
  };
}

/**
 * Input for batch write operation.
 */
export interface BatchWriteInput {
  /** Records to write */
  records: RawRecord[];
  /** Dry run - compute what would happen without writing */
  dryRun?: boolean;
}

/**
 * Review queue item for manual dedup resolution.
 */
export interface ReviewQueueItem {
  /** Queue item ID */
  id: string;
  /** Incoming record */
  incomingRecord: RawRecord;
  /** Matched HubSpot ID */
  matchedHubSpotId: string;
  /** Similarity score */
  similarityScore: number;
  /** Per-field comparison */
  fieldComparison: DedupGateResult['fieldComparison'];
  /** Status */
  status: 'pending' | 'approved' | 'rejected';
  /** Created timestamp */
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// H4: Webhook Types
// ─────────────────────────────────────────────────────────────

/**
 * Property value change in HubSpot webhook.
 */
export interface HubSpotPropertyChange {
  sourceId: string;
  value: string;
  previousValue?: string;
}

/**
 * HubSpot webhook event from payload.
 */
export interface HubSpotWebhookEvent {
  eventId: number;
  subscriptionId: number;
  portalId: number;
  appId: number;
  occurredAt: number;
  subscriptionType: 'company.creation' | 'company.propertyChange' | 'company.deletion' | 'contact.propertyChange';
  attemptNumber: number;
  objectId: number;
  propertyName?: string;
  propertyValue?: string | HubSpotPropertyChange;
}

/**
 * Webhook event status in database.
 */
export type WebhookEventStatus = 'pending' | 'processed' | 'failed' | 'duplicate';

/**
 * Stored webhook event record.
 */
export interface WebhookEventRecord {
  id: string;
  orgId: string;
  hubspotEventId: string;
  portalId: string;
  objectId: string;
  eventType: string;
  status: WebhookEventStatus;
  propertyName: string | null;
  propertyValue: string | null;
  attemptNumber: number;
  errorMessage: string | null;
  receivedAt: string;
  processedAt: string | null;
}

/**
 * Result of webhook processing.
 */
export interface WebhookProcessResult {
  eventId: string;
  objectId: string;
  action: 'processed' | 'queued_for_review' | 'skipped' | 'failed' | 'duplicate';
  dedupResult?: DedupGateResult;
  fieldsUpdated?: string[];
  error?: string;
}

/**
 * Normalization mode for webhook processing.
 */
export type NormalizationMode = 'implicit' | 'explicit';
