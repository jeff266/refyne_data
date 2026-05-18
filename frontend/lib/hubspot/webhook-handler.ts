/**
 * HubSpot Webhook Handler
 *
 * H4: Webhook + Real-Time
 *
 * Handles incoming HubSpot webhook events with:
 * - Signature validation (v1 and v3)
 * - Event deduplication
 * - Async processing with retry logic
 * - Mode-conditional behavior (implicit/explicit)
 */

import crypto from 'crypto';
import type { HubSpotClient, CompanyIndex } from './client';
import type { RawRecord } from '../mcp/types';
import type {
  HubSpotWebhookEvent,
  WebhookEventRecord,
  WebhookEventStatus,
  WebhookProcessResult,
  NormalizationMode,
  DedupGateResult,
} from './write-types';
import { checkDedupGate, addToReviewQueue } from './dedup-gate';
import { canonicalToHubSpotProperties, getDefaultWriteMappings } from './inverse-mapper';
import type { FieldMapping } from './types';
import { DEFAULT_COMPANY_PROPERTIES } from './types';
import { processAndWriteRecordFields } from '../compliance/normalized-records-writer';

// ─────────────────────────────────────────────────────────────
// Signature Validation
// ─────────────────────────────────────────────────────────────

/**
 * Validate HubSpot webhook signature (v3).
 * v3 signatures use: HMAC-SHA256(clientSecret + method + URI + body + timestamp)
 */
export function validateSignatureV3(
  clientSecret: string,
  method: string,
  uri: string,
  body: string,
  timestamp: string | null,
  signature: string | null
): boolean {
  if (!signature || !timestamp) return false;

  // Check timestamp freshness (reject if older than 5 minutes)
  const eventTime = parseInt(timestamp, 10);
  const now = Date.now();
  if (isNaN(eventTime) || now - eventTime > 5 * 60 * 1000) {
    return false;
  }

  const sourceString = clientSecret + method + uri + body + timestamp;
  const computed = crypto
    .createHash('sha256')
    .update(sourceString)
    .digest('base64');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computed)
    );
  } catch {
    return false;
  }
}

/**
 * Validate HubSpot webhook signature (v1).
 * v1 signatures use: HMAC-SHA256(clientSecret + body)
 */
export function validateSignatureV1(
  clientSecret: string,
  body: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  const computed = crypto
    .createHmac('sha256', clientSecret)
    .update(body)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computed)
    );
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Event Storage (In-Memory for Serverless)
// ─────────────────────────────────────────────────────────────

// In-memory event store for serverless environment
// In production, this would be backed by a database
interface EventStore {
  events: Map<string, WebhookEventRecord>;
  getEvent(orgId: string, eventId: string): WebhookEventRecord | undefined;
  setEvent(record: WebhookEventRecord): void;
  isDuplicate(orgId: string, eventId: string): boolean;
}

function getEventStore(): EventStore {
  if (typeof globalThis !== 'undefined' && (globalThis as any).__hubspotWebhookEvents) {
    return (globalThis as any).__hubspotWebhookEvents;
  }

  const store: EventStore = {
    events: new Map(),
    getEvent(orgId: string, eventId: string) {
      return this.events.get(`${orgId}:${eventId}`);
    },
    setEvent(record: WebhookEventRecord) {
      this.events.set(`${record.orgId}:${record.hubspotEventId}`, record);
    },
    isDuplicate(orgId: string, eventId: string) {
      const existing = this.events.get(`${orgId}:${eventId}`);
      return existing !== undefined && existing.status !== 'pending';
    },
  };

  if (typeof globalThis !== 'undefined') {
    (globalThis as any).__hubspotWebhookEvents = store;
  }

  return store;
}

// ─────────────────────────────────────────────────────────────
// Retry Logic
// ─────────────────────────────────────────────────────────────

/**
 * Retry configuration for webhook processing.
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000, // 1s, 4s, 16s exponential backoff
  maxDelayMs: 60000,
};

/**
 * Calculate delay for exponential backoff.
 */
export function calculateBackoff(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const delay = config.baseDelayMs * Math.pow(4, attempt);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Sleep for a given duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────
// Event Processing
// ─────────────────────────────────────────────────────────────

/**
 * Store a webhook event and check for duplicates.
 */
export function recordEvent(
  orgId: string,
  event: HubSpotWebhookEvent
): { isDuplicate: boolean; record: WebhookEventRecord } {
  const store = getEventStore();
  const eventIdStr = String(event.eventId);

  // Check for duplicate
  if (store.isDuplicate(orgId, eventIdStr)) {
    const existing = store.getEvent(orgId, eventIdStr)!;
    return { isDuplicate: true, record: existing };
  }

  // Create new record
  const record: WebhookEventRecord = {
    id: crypto.randomUUID(),
    orgId,
    hubspotEventId: eventIdStr,
    portalId: String(event.portalId),
    objectId: String(event.objectId),
    eventType: event.subscriptionType,
    status: 'pending',
    propertyName: event.propertyName || null,
    propertyValue: event.propertyValue || null,
    attemptNumber: event.attemptNumber,
    errorMessage: null,
    receivedAt: new Date().toISOString(),
    processedAt: null,
  };

  store.setEvent(record);
  return { isDuplicate: false, record };
}

/**
 * Update event status.
 */
export function updateEventStatus(
  orgId: string,
  eventId: string,
  status: WebhookEventStatus,
  errorMessage?: string
): void {
  const store = getEventStore();
  const record = store.getEvent(orgId, eventId);
  if (record) {
    record.status = status;
    record.processedAt = new Date().toISOString();
    if (errorMessage) {
      record.errorMessage = errorMessage;
    }
    store.setEvent(record);
  }
}

/**
 * Transform HubSpot company to RawRecord.
 */
function transformToRawRecord(company: {
  id: string;
  properties: Record<string, string | null>;
}): RawRecord {
  return {
    _id: company.id,
    _hubspot_id: company.id,
    _label: company.properties.name || company.properties.domain || company.id,
    name: company.properties.name,
    domain: company.properties.domain,
    industry: company.properties.industry,
    revenue: company.properties.annualrevenue,
    employees: company.properties.numberofemployees,
    phone: company.properties.phone,
    city: company.properties.city,
    state: company.properties.state,
    country: company.properties.country,
    postal_code: company.properties.zip,
    street: company.properties.address,
    linkedin_url: company.properties.linkedin_company_page,
    description: company.properties.description,
  };
}

/**
 * Process a single webhook event.
 *
 * Flow:
 * 1. Fetch full company record from HubSpot
 * 2. Transform to RawRecord
 * 3. Run through dedup gate
 * 4. Mode-conditional behavior:
 *    - Implicit: auto-apply normalized values
 *    - Explicit: queue for review
 */
export async function processWebhookEvent(
  event: HubSpotWebhookEvent,
  client: HubSpotClient,
  orgId: string,
  mode: NormalizationMode,
  mappings?: FieldMapping[],
  companyIndex?: CompanyIndex
): Promise<WebhookProcessResult> {
  const eventIdStr = String(event.eventId);
  const objectIdStr = String(event.objectId);

  try {
    // Skip deletion events
    if (event.subscriptionType === 'company.deletion') {
      updateEventStatus(orgId, eventIdStr, 'processed');
      return {
        eventId: eventIdStr,
        objectId: objectIdStr,
        action: 'skipped',
      };
    }

    // Fetch full company record
    const companies = await client.getCompaniesByIds(
      [objectIdStr],
      DEFAULT_COMPANY_PROPERTIES
    );

    if (companies.length === 0) {
      updateEventStatus(orgId, eventIdStr, 'failed', 'Company not found in HubSpot');
      return {
        eventId: eventIdStr,
        objectId: objectIdStr,
        action: 'failed',
        error: 'Company not found in HubSpot',
      };
    }

    const company = companies[0];
    const record = transformToRawRecord(company);

    // Run dedup gate
    const dedupResult = await checkDedupGate(record, client, orgId, companyIndex);

    // Mode-conditional behavior
    if (mode === 'explicit') {
      // Explicit mode: queue for review UI, do not write silently
      addToReviewQueue(record, dedupResult);
      updateEventStatus(orgId, eventIdStr, 'processed');
      return {
        eventId: eventIdStr,
        objectId: objectIdStr,
        action: 'queued_for_review',
        dedupResult,
      };
    }

    // Implicit mode: auto-apply
    const fieldMappings = mappings || getDefaultWriteMappings();

    if (dedupResult.action === 'upsert' && dedupResult.targetHubSpotId) {
      // Update existing record
      const currentValues = company.properties;
      const { properties, decisions } = canonicalToHubSpotProperties(
        record,
        fieldMappings,
        currentValues
      );

      const fieldsToWrite = decisions.filter(d => d.action === 'write');

      if (fieldsToWrite.length > 0 && Object.keys(properties).length > 0) {
        await client.batchUpdateCompanies([{
          id: dedupResult.targetHubSpotId,
          properties,
        }]);

        // Write compliance records (fire-and-forget)
        processAndWriteRecordFields(
          orgId,
          dedupResult.targetHubSpotId,
          'company',
          record as Record<string, unknown>,
          'hubspot'
        ).catch(err => console.error('Error writing compliance records:', err));
      }

      updateEventStatus(orgId, eventIdStr, 'processed');
      return {
        eventId: eventIdStr,
        objectId: objectIdStr,
        action: 'processed',
        dedupResult,
        fieldsUpdated: fieldsToWrite.map(d => d.hubspotProperty),
      };
    }

    if (dedupResult.action === 'review') {
      // Queue for review even in implicit mode
      addToReviewQueue(record, dedupResult);
      updateEventStatus(orgId, eventIdStr, 'processed');
      return {
        eventId: eventIdStr,
        objectId: objectIdStr,
        action: 'queued_for_review',
        dedupResult,
      };
    }

    if (dedupResult.action === 'insert') {
      // New record - normalize and update in place
      const { properties, decisions } = canonicalToHubSpotProperties(
        record,
        fieldMappings,
        company.properties
      );

      const fieldsToWrite = decisions.filter(d => d.action === 'write');

      if (fieldsToWrite.length > 0 && Object.keys(properties).length > 0) {
        await client.batchUpdateCompanies([{
          id: objectIdStr,
          properties,
        }]);

        // Write compliance records (fire-and-forget)
        processAndWriteRecordFields(
          orgId,
          objectIdStr,
          'company',
          record as Record<string, unknown>,
          'hubspot'
        ).catch(err => console.error('Error writing compliance records:', err));
      }

      updateEventStatus(orgId, eventIdStr, 'processed');
      return {
        eventId: eventIdStr,
        objectId: objectIdStr,
        action: 'processed',
        dedupResult,
        fieldsUpdated: fieldsToWrite.map(d => d.hubspotProperty),
      };
    }

    // Skip action
    updateEventStatus(orgId, eventIdStr, 'processed');
    return {
      eventId: eventIdStr,
      objectId: objectIdStr,
      action: 'skipped',
      dedupResult,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    updateEventStatus(orgId, eventIdStr, 'failed', errorMessage);
    return {
      eventId: eventIdStr,
      objectId: objectIdStr,
      action: 'failed',
      error: errorMessage,
    };
  }
}

/**
 * Process webhook event with retry logic.
 */
export async function processWithRetry(
  event: HubSpotWebhookEvent,
  client: HubSpotClient,
  orgId: string,
  mode: NormalizationMode,
  mappings?: FieldMapping[],
  companyIndex?: CompanyIndex,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<WebhookProcessResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retryConfig.maxAttempts; attempt++) {
    try {
      const result = await processWebhookEvent(
        event,
        client,
        orgId,
        mode,
        mappings,
        companyIndex
      );

      // If not a transient failure, return immediately
      if (result.action !== 'failed' || !isRetryableError(result.error)) {
        return result;
      }

      lastError = new Error(result.error);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Don't retry non-transient errors
      if (!isRetryableError(lastError.message)) {
        throw lastError;
      }
    }

    // Wait before retry (exponential backoff)
    if (attempt < retryConfig.maxAttempts - 1) {
      const delay = calculateBackoff(attempt, retryConfig);
      await sleep(delay);
    }
  }

  // All retries exhausted
  return {
    eventId: String(event.eventId),
    objectId: String(event.objectId),
    action: 'failed',
    error: `Max retries exceeded: ${lastError?.message || 'Unknown error'}`,
  };
}

/**
 * Check if an error is retryable (transient).
 */
function isRetryableError(error?: string): boolean {
  if (!error) return false;

  // Rate limiting
  if (error.includes('429') || error.includes('rate limit')) return true;

  // Server errors (5xx)
  if (error.includes('500') || error.includes('502') || error.includes('503') || error.includes('504')) {
    return true;
  }

  // Timeout
  if (error.includes('timeout') || error.includes('ETIMEDOUT')) return true;

  // Network errors
  if (error.includes('ECONNRESET') || error.includes('ENOTFOUND')) return true;

  return false;
}

// ─────────────────────────────────────────────────────────────
// Batch Processing
// ─────────────────────────────────────────────────────────────

/**
 * Process multiple webhook events (batch from a single webhook call).
 * Groups events by objectId to avoid duplicate processing.
 */
export async function processBatchEvents(
  events: HubSpotWebhookEvent[],
  client: HubSpotClient,
  orgId: string,
  mode: NormalizationMode,
  mappings?: FieldMapping[],
  companyIndex?: CompanyIndex
): Promise<WebhookProcessResult[]> {
  const results: WebhookProcessResult[] = [];

  // Group events by objectId (multiple property changes for same company)
  const eventsByObject = new Map<number, HubSpotWebhookEvent[]>();
  for (const event of events) {
    const existing = eventsByObject.get(event.objectId) || [];
    existing.push(event);
    eventsByObject.set(event.objectId, existing);
  }

  // Process each unique object once (using the latest event)
  for (const [_objectId, objectEvents] of Array.from(eventsByObject.entries())) {
    // Sort by occurredAt to get the latest event
    objectEvents.sort((a, b) => b.occurredAt - a.occurredAt);
    const latestEvent = objectEvents[0];

    // Record all events but only process the latest
    for (const event of objectEvents) {
      const { isDuplicate, record } = recordEvent(orgId, event);
      if (isDuplicate) {
        results.push({
          eventId: String(event.eventId),
          objectId: String(event.objectId),
          action: 'duplicate',
        });
      } else if (event !== latestEvent) {
        // Mark non-latest events as processed (skipped)
        updateEventStatus(orgId, String(event.eventId), 'processed');
        results.push({
          eventId: String(event.eventId),
          objectId: String(event.objectId),
          action: 'skipped',
        });
      }
    }

    // Process the latest event with retry
    const result = await processWithRetry(
      latestEvent,
      client,
      orgId,
      mode,
      mappings,
      companyIndex
    );
    results.push(result);
  }

  return results;
}
