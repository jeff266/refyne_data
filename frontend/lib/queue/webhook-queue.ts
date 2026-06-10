/**
 * Webhook Queue
 *
 * BullMQ queue for processing HubSpot webhook events.
 * Provides rate limiting, retries, and concurrency control.
 *
 * Rate limits are dynamic based on portal configuration:
 * - Reads rate_limit_per_10s from hubspot_connections
 * - Uses 50% of limit to leave headroom
 * - Defaults to 50 if not yet observed
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { createRedisConnection, isRedisConfigured } from './redis';
import { startStalledJobMonitoring, stopStalledJobMonitoring } from './stalled-job-detector';
import type { HubSpotWebhookEvent, NormalizationMode } from '../hubspot/write-types';
import {
  recordEvent,
  updateEventStatus,
  processWebhookEvent,
} from '../hubspot/webhook-handler';
import { createHubSpotClient } from '../hubspot/client';
import { getPortalBurstLimit, isPortalPaused } from '../hubspot/rate-limiter';
import type { CompanyIndex } from '../hubspot/client';

// ─────────────────────────────────────────────────────────────
// Queue Configuration
// ─────────────────────────────────────────────────────────────

const QUEUE_NAME = 'hubspot-webhooks';

/**
 * Worker concurrency - how many jobs to process in parallel.
 * Set low to respect HubSpot rate limits.
 */
const WORKER_CONCURRENCY = 5;

/**
 * Default rate limit (used when rate_limit_per_10s not yet observed).
 */
const DEFAULT_RATE_LIMIT_PER_10S = 100;

/**
 * Headroom factor - use this fraction of the observed limit.
 * 0.5 = 50% of limit, leaving room for other API calls.
 */
const RATE_LIMIT_HEADROOM_FACTOR = 0.5;

/**
 * Calculate rate limit for a portal.
 * Uses floor(rate_limit_per_10s * 0.5), defaults to 50.
 */
export function calculatePortalRateLimit(portalId: string): { max: number; duration: number } {
  const burstLimit = getPortalBurstLimit(portalId);
  const effectiveLimit = Math.floor(burstLimit * RATE_LIMIT_HEADROOM_FACTOR);

  // Ensure at least 10 req/10sec to prevent stalling
  const max = Math.max(effectiveLimit, 10);

  return {
    max,
    duration: 10_000, // 10 seconds
  };
}

/**
 * Retry settings with exponential backoff.
 */
const RETRY_SETTINGS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000, // 1s, 2s, 4s
  },
};

// ─────────────────────────────────────────────────────────────
// Job Types
// ─────────────────────────────────────────────────────────────

/**
 * Data for a webhook job.
 */
export interface WebhookJobData {
  event: HubSpotWebhookEvent;
  orgId: string;
  accessToken: string;
  mode: NormalizationMode;
  receivedAt: string;
  /** Stored rate limit from hubspot_connections */
  storedRateLimit?: number;
}

/**
 * Result from processing a webhook job.
 */
export interface WebhookJobResult {
  eventId: string;
  objectId: string;
  action: 'processed' | 'queued_for_review' | 'skipped' | 'failed';
  fieldsUpdated?: string[];
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Queue Instance
// ─────────────────────────────────────────────────────────────

let webhookQueue: Queue<WebhookJobData, WebhookJobResult> | null = null;
let webhookWorker: Worker<WebhookJobData, WebhookJobResult> | null = null;
let webhookMonitoringInterval: NodeJS.Timeout | null = null;
let queueEvents: QueueEvents | null = null;

/**
 * Get or create the webhook queue.
 */
export function getWebhookQueue(): Queue<WebhookJobData, WebhookJobResult> | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - webhook queue disabled');
    return null;
  }

  if (!webhookQueue) {
    const connection = createRedisConnection();
    webhookQueue = new Queue<WebhookJobData, WebhookJobResult>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: RETRY_SETTINGS.attempts,
        backoff: RETRY_SETTINGS.backoff,
        removeOnComplete: {
          count: 1000, // Keep last 1000 completed jobs
          age: 24 * 60 * 60, // Remove after 24 hours
        },
        removeOnFail: {
          count: 5000, // Keep last 5000 failed jobs
          age: 7 * 24 * 60 * 60, // Remove after 7 days
        },
      },
    });
  }

  return webhookQueue;
}

/**
 * Enqueue a webhook event for processing.
 *
 * @param event - HubSpot webhook event
 * @param orgId - Organization ID
 * @param accessToken - HubSpot access token
 * @param mode - Normalization mode
 * @param storedRateLimit - Optional rate limit from hubspot_connections
 */
export async function enqueueWebhookEvent(
  event: HubSpotWebhookEvent,
  orgId: string,
  accessToken: string,
  mode: NormalizationMode,
  storedRateLimit?: number
): Promise<{ queued: boolean; jobId?: string; reason?: string }> {
  const queue = getWebhookQueue();

  if (!queue) {
    return { queued: false, reason: 'Queue not configured' };
  }

  // Check if portal is paused due to daily limit
  const portalId = String(event.portalId);
  if (isPortalPaused(portalId)) {
    return { queued: false, reason: 'Portal paused due to rate limit' };
  }

  // Check for duplicate before enqueueing
  const { isDuplicate } = recordEvent(orgId, event);
  if (isDuplicate) {
    return { queued: false, reason: 'Duplicate event' };
  }

  const jobData: WebhookJobData = {
    event,
    orgId,
    accessToken,
    mode,
    receivedAt: new Date().toISOString(),
    storedRateLimit,
  };

  // Use eventId as job ID for deduplication at queue level
  const jobId = `${orgId}:${event.eventId}`;

  // Get job priority based on org's subscription tier
  const { getJobPriority } = await import('@/lib/billing/job-priority');
  const priority = await getJobPriority(orgId);

  try {
    const job = await queue.add('process-webhook', jobData, {
      jobId,
      priority,
    });

    return { queued: true, jobId: job.id };
  } catch (error) {
    // Job with same ID already exists - duplicate
    if (error instanceof Error && error.message.includes('exists')) {
      return { queued: false, reason: 'Job already queued' };
    }
    throw error;
  }
}

/**
 * Enqueue multiple webhook events (batch from single webhook call).
 */
export async function enqueueWebhookBatch(
  events: HubSpotWebhookEvent[],
  orgId: string,
  accessToken: string,
  mode: NormalizationMode,
  storedRateLimit?: number
): Promise<{
  queued: number;
  duplicates: number;
  errors: number;
}> {
  let queued = 0;
  let duplicates = 0;
  let errors = 0;

  for (const event of events) {
    try {
      const result = await enqueueWebhookEvent(event, orgId, accessToken, mode, storedRateLimit);
      if (result.queued) {
        queued++;
      } else if (result.reason?.includes('Duplicate') || result.reason?.includes('exists')) {
        duplicates++;
      }
    } catch {
      errors++;
    }
  }

  return { queued, duplicates, errors };
}

// ─────────────────────────────────────────────────────────────
// Worker
// ─────────────────────────────────────────────────────────────

/**
 * Process a single webhook job.
 */
async function processWebhookJob(
  job: Job<WebhookJobData, WebhookJobResult>
): Promise<WebhookJobResult> {
  const { event, orgId, accessToken, mode, storedRateLimit } = job.data;
  const eventIdStr = String(event.eventId);
  const objectIdStr = String(event.objectId);
  const portalId = String(event.portalId);

  try {
    // Check if portal is paused
    if (isPortalPaused(portalId)) {
      // Delay and retry later
      throw new Error(`Portal ${portalId} is paused due to rate limit`);
    }

    // Create HubSpot client with stored rate limit
    const clientResult = await createHubSpotClient(accessToken, storedRateLimit);
    if ('error' in clientResult) {
      throw new Error(clientResult.error);
    }

    const { client } = clientResult;

    // Process the event
    const result = await processWebhookEvent(
      event,
      client,
      orgId,
      mode
    );

    return {
      eventId: eventIdStr,
      objectId: objectIdStr,
      action: result.action === 'duplicate' ? 'skipped' : result.action,
      fieldsUpdated: result.fieldsUpdated,
      error: result.error,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if retryable
    if (isRetryableError(errorMessage) && (job.attemptsMade || 0) < RETRY_SETTINGS.attempts) {
      // Let BullMQ retry
      throw error;
    }

    // Mark as failed in our tracking
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
 * Check if an error is retryable.
 */
function isRetryableError(error: string): boolean {
  // Rate limiting
  if (error.includes('429') || error.includes('rate limit')) return true;
  if (error.includes('paused')) return true;

  // Server errors
  if (error.includes('500') || error.includes('502') || error.includes('503') || error.includes('504')) {
    return true;
  }

  // Network errors
  if (error.includes('ETIMEDOUT') || error.includes('ECONNRESET') || error.includes('ENOTFOUND')) {
    return true;
  }

  return false;
}

/**
 * Start the webhook worker.
 * Call this from a worker process (e.g., Railway worker dyno).
 */
export function startWebhookWorker(): Worker<WebhookJobData, WebhookJobResult> | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - webhook worker disabled');
    return null;
  }

  if (webhookWorker) {
    return webhookWorker;
  }

  const connection = createRedisConnection();

  // Default rate limit for worker (will be overridden per-job)
  const defaultRateLimit = {
    max: Math.floor(DEFAULT_RATE_LIMIT_PER_10S * RATE_LIMIT_HEADROOM_FACTOR),
    duration: 10_000,
  };

  webhookWorker = new Worker<WebhookJobData, WebhookJobResult>(
    QUEUE_NAME,
    processWebhookJob,
    {
      connection,
      concurrency: WORKER_CONCURRENCY,
      limiter: defaultRateLimit,
    }
  );

  // Event handlers
  webhookWorker.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed: ${result.action}`);
  });

  webhookWorker.on('failed', (job, error) => {
    console.error(`Job ${job?.id} failed:`, error.message);
  });

  webhookWorker.on('error', (error) => {
    console.error('Worker error:', error);
  });

  console.log(`Webhook worker started with concurrency=${WORKER_CONCURRENCY}, default rate limit=${defaultRateLimit.max}/${defaultRateLimit.duration}ms`);

  // Start stalled job monitoring
  const queue = getWebhookQueue();
  if (queue) {
    webhookMonitoringInterval = startStalledJobMonitoring(queue, 'Webhook Queue');
  }

  return webhookWorker;
}

/**
 * Stop the webhook worker gracefully.
 */
export async function stopWebhookWorker(): Promise<void> {
  if (webhookMonitoringInterval) {
    stopStalledJobMonitoring(webhookMonitoringInterval, 'Webhook Worker');
    webhookMonitoringInterval = null;
  }

  if (webhookWorker) {
    await webhookWorker.close();
    webhookWorker = null;
  }

  if (queueEvents) {
    await queueEvents.close();
    queueEvents = null;
  }

  if (webhookQueue) {
    await webhookQueue.close();
    webhookQueue = null;
  }
}

// ─────────────────────────────────────────────────────────────
// Queue Stats
// ─────────────────────────────────────────────────────────────

/**
 * Get queue statistics.
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
} | null> {
  const queue = getWebhookQueue();
  if (!queue) return null;

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Get worker concurrency setting.
 */
export function getWorkerConcurrency(): number {
  return WORKER_CONCURRENCY;
}

/**
 * Get rate limit settings for a portal.
 */
export function getRateLimitSettings(portalId?: string): { max: number; duration: number } {
  if (portalId) {
    return calculatePortalRateLimit(portalId);
  }
  // Return default
  return {
    max: Math.floor(DEFAULT_RATE_LIMIT_PER_10S * RATE_LIMIT_HEADROOM_FACTOR),
    duration: 10_000,
  };
}
