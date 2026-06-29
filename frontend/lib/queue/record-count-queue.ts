/**
 * Record Count Queue
 *
 * BullMQ queue for fetching HubSpot record counts after OAuth connection.
 * Calculates total records and suggests appropriate billing plan.
 */

import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection, isRedisConfigured } from './redis';
import { supabaseAdmin } from '@/lib/db/admin-client';

// ─────────────────────────────────────────────────────────────
// Queue Configuration
// ─────────────────────────────────────────────────────────────

const QUEUE_NAME = 'hubspot-record-count';

/**
 * Worker concurrency - low priority background task.
 */
const WORKER_CONCURRENCY = 2;

/**
 * Retry settings with exponential backoff.
 */
const RETRY_SETTINGS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000, // 2s, 4s, 8s
  },
};

// ─────────────────────────────────────────────────────────────
// Job Types
// ─────────────────────────────────────────────────────────────

/**
 * Data for a record count job.
 */
export interface RecordCountJobData {
  orgId: string;
  portalId: string;
  accessToken: string;
}

/**
 * Result from processing a record count job.
 */
export interface RecordCountJobResult {
  orgId: string;
  portalId: string;
  companyCount: number;
  contactCount: number;
  totalRecords: number;
  suggestedPlan: 'starter' | 'growth' | 'scale' | 'enterprise';
}

// ─────────────────────────────────────────────────────────────
// Queue Instance
// ─────────────────────────────────────────────────────────────

let recordCountQueue: Queue<RecordCountJobData, RecordCountJobResult> | null = null;
let recordCountWorker: Worker<RecordCountJobData, RecordCountJobResult> | null = null;

/**
 * Get or create the record count queue.
 * Note: In serverless environments, the queue instance is created per-invocation.
 */
export function getRecordCountQueue(): Queue<RecordCountJobData, RecordCountJobResult> | null {
  if (!isRedisConfigured()) {
    console.warn('[RecordCount] Redis not configured - queue disabled');
    return null;
  }

  if (!recordCountQueue) {
    try {
      const connection = createRedisConnection();

      recordCountQueue = new Queue<RecordCountJobData, RecordCountJobResult>(QUEUE_NAME, {
        connection,
        defaultJobOptions: {
          attempts: RETRY_SETTINGS.attempts,
          backoff: RETRY_SETTINGS.backoff,
          removeOnComplete: {
            count: 100, // Keep last 100 completed jobs
            age: 7 * 24 * 60 * 60, // Remove after 7 days
          },
          removeOnFail: {
            count: 500, // Keep last 500 failed jobs
            age: 30 * 24 * 60 * 60, // Remove after 30 days
          },
        },
      });

      console.log('[RecordCount] Queue created successfully');
    } catch (error) {
      console.error('[RecordCount] Failed to create queue:', error instanceof Error ? error.message : error);
      return null; // Return null instead of throwing in serverless
    }
  }

  return recordCountQueue;
}

/**
 * Enqueue a record count job.
 *
 * @param orgId - Organization ID
 * @param portalId - HubSpot portal ID
 * @param accessToken - HubSpot access token
 */
export async function enqueueRecordCountJob(
  orgId: string,
  portalId: string,
  accessToken: string
): Promise<{ queued: boolean; jobId?: string; reason?: string }> {
  const queue = getRecordCountQueue();

  if (!queue) {
    return { queued: false, reason: 'Queue not configured' };
  }

  const jobData: RecordCountJobData = {
    orgId,
    portalId,
    accessToken,
  };

  // Use orgId-portalId as job ID for deduplication (BullMQ doesn't allow colons)
  const jobId = `${orgId}-${portalId}`;

  try {
    const job = await queue.add('fetch-record-count', jobData, {
      jobId,
      priority: 10, // Low priority background task
    });

    console.log(`[RecordCount] Enqueued job ${job.id} for org ${orgId}`);
    return { queued: true, jobId: job.id };
  } catch (error) {
    // Job with same ID already exists - duplicate
    if (error instanceof Error && error.message.includes('exists')) {
      console.log(`[RecordCount] Job already queued for org ${orgId}`);
      return { queued: false, reason: 'Job already queued' };
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Worker
// ─────────────────────────────────────────────────────────────

/**
 * Calculate suggested plan based on total record count.
 */
function calculateSuggestedPlan(totalRecords: number): 'starter' | 'growth' | 'scale' | 'enterprise' {
  if (totalRecords <= 25_000) return 'starter';
  if (totalRecords <= 75_000) return 'growth';
  if (totalRecords <= 200_000) return 'scale';
  return 'enterprise';
}

/**
 * Fetch record counts from HubSpot API.
 */
async function fetchRecordCounts(
  accessToken: string
): Promise<{ companyCount: number; contactCount: number }> {
  // Fetch company count
  const companyRes = await fetch('https://api.hubapi.com/crm/v3/objects/companies?limit=1', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!companyRes.ok) {
    throw new Error(`Failed to fetch company count: ${companyRes.status} ${companyRes.statusText}`);
  }

  const companyData = await companyRes.json();
  const companyCount = companyData.total || 0;

  // Fetch contact count
  const contactRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!contactRes.ok) {
    throw new Error(`Failed to fetch contact count: ${contactRes.status} ${contactRes.statusText}`);
  }

  const contactData = await contactRes.json();
  const contactCount = contactData.total || 0;

  return { companyCount, contactCount };
}

/**
 * Process a single record count job.
 */
async function processRecordCountJob(
  job: Job<RecordCountJobData, RecordCountJobResult>
): Promise<RecordCountJobResult> {
  const { orgId, portalId, accessToken } = job.data;

  console.log(`[RecordCount] Processing job ${job.id} for org ${orgId}`);

  try {
    // Fetch counts from HubSpot
    const { companyCount, contactCount } = await fetchRecordCounts(accessToken);
    const totalRecords = companyCount + contactCount;
    const suggestedPlan = calculateSuggestedPlan(totalRecords);

    console.log(`[RecordCount] Fetched counts for org ${orgId}: ${companyCount} companies, ${contactCount} contacts, total ${totalRecords}, suggested plan: ${suggestedPlan}`);

    // Get org's current effective plan
    const { getOrgPlan } = await import('@/lib/billing/get-org-plan');
    const { getRecordLimit } = await import('@/lib/billing/plan-features');

    const currentPlan = await getOrgPlan(orgId);

    if (!currentPlan) {
      console.error(`[RecordCount] Could not determine plan for org ${orgId}`);
      throw new Error('Unable to determine org plan');
    }

    // Evaluate thresholds (enterprise plan has no limits)
    let isNearLimit = false;
    let isOverLimit = false;
    let overLimitFirstDetectedAt: string | null = null;
    let gracePeriodEndsAt: string | null = null;
    let gracePeriodExpired = false;

    const planLimit = getRecordLimit(currentPlan);

    // Enterprise plan has no limit (Infinity), skip threshold checks
    if (planLimit !== Infinity) {
        const pct = totalRecords / planLimit;
        isNearLimit = pct >= 0.90 && pct < 1.0;
        isOverLimit = pct >= 1.0;

        console.log(`[RecordCount] Threshold check for org ${orgId}: ${totalRecords}/${planLimit} (${(pct * 100).toFixed(1)}%) - nearLimit=${isNearLimit}, overLimit=${isOverLimit}`);

        // If over limit, check for existing over_limit_first_detected_at
        if (isOverLimit) {
          const { data: existingRecord } = await supabaseAdmin
            .from('hubspot_record_counts')
            .select('over_limit_first_detected_at')
            .eq('org_id', orgId)
            .order('fetched_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingRecord?.over_limit_first_detected_at) {
            // Use existing first detected time
            overLimitFirstDetectedAt = existingRecord.over_limit_first_detected_at;
          } else {
            // First time over limit
            overLimitFirstDetectedAt = new Date().toISOString();
          }

          // Calculate grace period end (14 days from first detection)
          const firstDetected = new Date(overLimitFirstDetectedAt!);
          const gracePeriodEnd = new Date(firstDetected.getTime() + 14 * 24 * 60 * 60 * 1000);
          gracePeriodEndsAt = gracePeriodEnd.toISOString();
          gracePeriodExpired = new Date() > gracePeriodEnd;

          console.log(`[RecordCount] Over limit - first detected: ${overLimitFirstDetectedAt}, grace ends: ${gracePeriodEndsAt}, expired: ${gracePeriodExpired}`);
        }
        // If NOT over limit, clear grace period fields (they upgraded or deleted records)
      }

    // Insert into hubspot_record_counts table with threshold fields
    const { error: insertError } = await supabaseAdmin
      .from('hubspot_record_counts')
      .insert({
        org_id: orgId,
        portal_id: portalId,
        company_count: companyCount,
        contact_count: contactCount,
        total_records: totalRecords,
        suggested_plan: suggestedPlan,
        fetched_at: new Date().toISOString(),
        is_near_limit: isNearLimit,
        is_over_limit: isOverLimit,
        over_limit_first_detected_at: overLimitFirstDetectedAt,
        grace_period_ends_at: gracePeriodEndsAt,
        grace_period_expired: gracePeriodExpired,
      });

    if (insertError) {
      console.error(`[RecordCount] Failed to insert record counts for org ${orgId}:`, insertError);
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    console.log(`[RecordCount] Stored record counts for org ${orgId}`);

    // Send notifications if needed (best-effort, don't fail job if notifications fail)
    // Only send for plans with limits (enterprise/exempt orgs have planLimit = Infinity)
    if (planLimit !== Infinity) {
      try {
        const { sendRecordLimitNotifications } = await import('@/lib/billing/record-limit-notifier');

        await sendRecordLimitNotifications(
          {
            orgId,
            totalRecords,
            planLimit,
            currentPlan,
            gracePeriodEndsAt,
          },
          isNearLimit,
          isOverLimit,
          gracePeriodExpired
        );
      } catch (notificationError) {
        console.error(`[RecordCount] Failed to send notifications for org ${orgId}:`, notificationError);
        // Don't fail the job - notifications are best-effort
      }
    }

    return {
      orgId,
      portalId,
      companyCount,
      contactCount,
      totalRecords,
      suggestedPlan,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[RecordCount] Job ${job.id} failed:`, errorMessage);

    // Check if retryable
    if (isRetryableError(errorMessage) && (job.attemptsMade || 0) < RETRY_SETTINGS.attempts) {
      console.log(`[RecordCount] Retrying job ${job.id} (attempt ${(job.attemptsMade || 0) + 1}/${RETRY_SETTINGS.attempts})`);
      throw error; // Let BullMQ retry
    }

    // Not retryable or max attempts reached
    throw error;
  }
}

/**
 * Check if an error is retryable.
 */
function isRetryableError(error: string): boolean {
  // Rate limiting
  if (error.includes('429') || error.includes('rate limit')) return true;

  // Server errors
  if (error.includes('500') || error.includes('502') || error.includes('503') || error.includes('504')) {
    return true;
  }

  // Network errors
  if (error.includes('ETIMEDOUT') || error.includes('ECONNRESET') || error.includes('ENOTFOUND')) {
    return true;
  }

  // Token errors (OAuth might be refreshing)
  if (error.includes('401')) return true;

  return false;
}

/**
 * Start the record count worker.
 * Call this from a worker process (e.g., Railway worker dyno).
 */
export function startRecordCountWorker(): Worker<RecordCountJobData, RecordCountJobResult> | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - record count worker disabled');
    return null;
  }

  if (recordCountWorker) {
    return recordCountWorker;
  }

  const connection = createRedisConnection();

  recordCountWorker = new Worker<RecordCountJobData, RecordCountJobResult>(
    QUEUE_NAME,
    processRecordCountJob,
    {
      connection,
      concurrency: WORKER_CONCURRENCY,
    }
  );

  // Event handlers
  recordCountWorker.on('completed', (job, result) => {
    console.log(`[RecordCount] Job ${job.id} completed: ${result.totalRecords} records, suggested plan: ${result.suggestedPlan}`);
  });

  recordCountWorker.on('failed', (job, error) => {
    console.error(`[RecordCount] Job ${job?.id} failed:`, error.message);
  });

  recordCountWorker.on('error', (error) => {
    console.error('[RecordCount] Worker error:', error);
  });

  console.log(`[RecordCount] Worker started with concurrency=${WORKER_CONCURRENCY}`);

  return recordCountWorker;
}

/**
 * Stop the record count worker gracefully.
 */
export async function stopRecordCountWorker(): Promise<void> {
  if (recordCountWorker) {
    await recordCountWorker.close();
    recordCountWorker = null;
    console.log('[RecordCount] Worker stopped');
  }

  if (recordCountQueue) {
    await recordCountQueue.close();
    recordCountQueue = null;
    console.log('[RecordCount] Queue closed');
  }
}

/**
 * Get queue statistics.
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
} | null> {
  const queue = getRecordCountQueue();
  if (!queue) return null;

  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}
