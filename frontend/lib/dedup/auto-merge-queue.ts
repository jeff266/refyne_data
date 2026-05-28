/**
 * Auto-merge Queue
 *
 * BullMQ queue and worker for processing auto-merge jobs.
 * Runs every 15 minutes to check for clusters due for auto-merge.
 */

import { Queue, Worker } from 'bullmq';
import { createRedisConnection, isRedisConfigured } from '../queue/redis';
import { processAutoMerge } from './auto-merge-worker';

const QUEUE_NAME = 'auto-merge';
const CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds

let autoMergeQueue: Queue | null = null;
let autoMergeWorker: Worker | null = null;

/**
 * Get or create the auto-merge queue.
 */
export function getAutoMergeQueue(): Queue | null {
  if (!isRedisConfigured()) {
    return null;
  }

  if (!autoMergeQueue) {
    const connection = createRedisConnection();
    autoMergeQueue = new Queue(QUEUE_NAME, { connection });
  }

  return autoMergeQueue;
}

/**
 * Start the auto-merge worker.
 * Sets up a repeatable job that runs every 15 minutes.
 */
export function startAutoMergeWorker(): Worker | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - auto-merge worker disabled');
    return null;
  }

  if (autoMergeWorker) {
    return autoMergeWorker;
  }

  const connection = createRedisConnection();

  // Create worker
  autoMergeWorker = new Worker(
    QUEUE_NAME,
    async () => {
      console.log('[Auto-merge Worker] Running scheduled check...');
      const result = await processAutoMerge();
      console.log(
        `[Auto-merge Worker] Processed ${result.processed} clusters, ${result.errors} errors`
      );
      return result;
    },
    {
      connection,
      concurrency: 1, // Only 1 concurrent job to avoid conflicts
    }
  );

  autoMergeWorker.on('completed', (job, result) => {
    console.log(`[Auto-merge Worker] Job ${job.id} completed:`, result);
  });

  autoMergeWorker.on('failed', (job, error) => {
    console.error(`[Auto-merge Worker] Job ${job?.id} failed:`, error.message);
  });

  autoMergeWorker.on('error', (error) => {
    console.error('[Auto-merge Worker] Worker error:', error);
  });

  // Schedule repeatable job (every 15 minutes)
  const queue = getAutoMergeQueue();
  if (queue) {
    queue
      .add(
        'auto-merge-check',
        {},
        {
          repeat: {
            every: CHECK_INTERVAL,
          },
          jobId: 'auto-merge-check-recurring',
        }
      )
      .then(() => {
        console.log(
          `[Auto-merge Worker] Scheduled repeatable job (every ${CHECK_INTERVAL / 1000 / 60} minutes)`
        );
      })
      .catch((err) => {
        console.error('[Auto-merge Worker] Failed to schedule repeatable job:', err);
      });
  }

  console.log('[Auto-merge Worker] Started successfully');

  return autoMergeWorker;
}

/**
 * Stop the auto-merge worker.
 */
export async function stopAutoMergeWorker(): Promise<void> {
  if (autoMergeWorker) {
    await autoMergeWorker.close();
    autoMergeWorker = null;
  }

  if (autoMergeQueue) {
    await autoMergeQueue.close();
    autoMergeQueue = null;
  }
}

/**
 * Get auto-merge queue statistics.
 */
export async function getAutoMergeQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
} | null> {
  const queue = getAutoMergeQueue();
  if (!queue) return null;

  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.getPausedCount(),
  ]);

  return { waiting, active, completed, failed, delayed, paused };
}
