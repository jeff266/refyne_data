/**
 * Digest Queue
 *
 * BullMQ queue for Always On digest processing.
 * Runs nightly scans, sends email digests, and posts to Slack.
 */

import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection, isRedisConfigured } from './redis';
import { processDigestJob } from '../jobs/always-on-digest';

// ─────────────────────────────────────────────────────────────
// Queue Configuration
// ─────────────────────────────────────────────────────────────

const QUEUE_NAME = 'always-on-digest';

/**
 * Worker concurrency - how many digest jobs to process in parallel.
 */
const WORKER_CONCURRENCY = 2;

/**
 * Retry settings - digest jobs shouldn't retry automatically.
 * Failures are recorded in digest_runs table.
 */
const RETRY_SETTINGS = {
  attempts: 1, // No retries
};

// ─────────────────────────────────────────────────────────────
// Job Types
// ─────────────────────────────────────────────────────────────

/**
 * Data for a digest job.
 */
export interface DigestJobData {
  orgId: string;
  connectionId?: string; // If specified, only process this connection
  triggeredBy: 'schedule' | 'manual';
}

/**
 * Result from processing a digest job.
 */
export interface DigestJobResult {
  runId: string;
  status: 'completed' | 'failed' | 'skipped';
  scoreDelta: number | null;
  digestSent: boolean;
  slackSent: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Queue Instance
// ─────────────────────────────────────────────────────────────

let digestQueue: Queue<DigestJobData, DigestJobResult> | null = null;
let digestWorker: Worker<DigestJobData, DigestJobResult> | null = null;

/**
 * Get or create the digest queue.
 */
export function getDigestQueue(): Queue<DigestJobData, DigestJobResult> | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - digest queue disabled');
    return null;
  }

  if (!digestQueue) {
    const connection = createRedisConnection();
    digestQueue = new Queue<DigestJobData, DigestJobResult>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: RETRY_SETTINGS.attempts,
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs only
          age: 30 * 24 * 60 * 60, // Remove after 30 days
        },
        removeOnFail: {
          count: 50, // Keep last 50 failed jobs for debugging
          age: 90 * 24 * 60 * 60, // Remove after 90 days
        },
      },
    });
  }

  return digestQueue;
}

/**
 * Enqueue a digest job.
 *
 * @param orgId - Organization ID
 * @param connectionId - Optional specific connection to process
 * @param triggeredBy - How the job was triggered
 */
export async function enqueueDigestJob(
  orgId: string,
  connectionId: string | undefined,
  triggeredBy: 'schedule' | 'manual'
): Promise<{ queued: boolean; jobId?: string; reason?: string }> {
  const queue = getDigestQueue();

  if (!queue) {
    return { queued: false, reason: 'Queue not configured' };
  }

  const jobData: DigestJobData = {
    orgId,
    connectionId,
    triggeredBy,
  };

  // Use a unique job ID based on org + connection + timestamp
  const timestamp = Date.now();
  const jobId = connectionId
    ? `${orgId}:${connectionId}:${timestamp}`
    : `${orgId}:all:${timestamp}`;

  try {
    const job = await queue.add('process-digest', jobData, {
      jobId,
    });

    return { queued: true, jobId: job.id };
  } catch (error) {
    console.error('Failed to enqueue digest job:', error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Worker
// ─────────────────────────────────────────────────────────────

/**
 * Start the digest worker.
 * Call this from a worker process (e.g., Railway worker dyno).
 */
export function startDigestWorker(): Worker<DigestJobData, DigestJobResult> | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - digest worker disabled');
    return null;
  }

  if (digestWorker) {
    return digestWorker;
  }

  const connection = createRedisConnection();

  digestWorker = new Worker<DigestJobData, DigestJobResult>(
    QUEUE_NAME,
    processDigestJob,
    {
      connection,
      concurrency: WORKER_CONCURRENCY,
      // Reduce polling overhead for cost optimization
      // BullMQ automatically uses BRPOP with blocking which is efficient
      // These settings reduce overhead when jobs are stalled
      stalledInterval: 30000, // Check for stalled jobs every 30s (default 30s)
      maxStalledCount: 2,     // Mark as stalled after 2 checks (default 1)
    }
  );

  // Event handlers
  digestWorker.on('completed', (job, result) => {
    console.log(`Digest job ${job.id} completed: ${result.status}, sent=${result.digestSent}`);
  });

  digestWorker.on('failed', (job, error) => {
    console.error(`Digest job ${job?.id} failed:`, error.message);
  });

  digestWorker.on('error', (error) => {
    console.error('Digest worker error:', error);
  });

  console.log(`Digest worker started with concurrency=${WORKER_CONCURRENCY}`);

  return digestWorker;
}

/**
 * Stop the digest worker gracefully.
 */
export async function stopDigestWorker(): Promise<void> {
  if (digestWorker) {
    await digestWorker.close();
    digestWorker = null;
  }

  if (digestQueue) {
    await digestQueue.close();
    digestQueue = null;
  }
}

/**
 * Get queue statistics.
 */
export async function getDigestQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
} | null> {
  const queue = getDigestQueue();
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
