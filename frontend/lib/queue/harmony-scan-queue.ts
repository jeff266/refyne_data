/**
 * Harmony Scan Queue
 *
 * BullMQ queue for processing harmony field scans in the background.
 * Scans can take 5-10 minutes for large portals, so they run in a worker
 * instead of in the serverless function.
 */

import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

export interface HarmonyScanJobData {
  jobId: string;
  orgId: string;
  portalId: string;
  accessToken: string;
  objectType: 'companies' | 'contacts';
  fieldName: string;
  harmonyId: string;
  hasExportScope?: boolean;
}

let harmonyScanQueue: Queue<HarmonyScanJobData> | null = null;
let redisConnection: IORedis | null = null;

/**
 * Get or create the harmony scan queue
 */
export function getHarmonyScanQueue(): Queue<HarmonyScanJobData> | null {
  const redisUrl = process.env.UPSTASH_REDIS_URL;

  if (!redisUrl) {
    console.warn('[HarmonyScanQueue] UPSTASH_REDIS_URL not configured - queue disabled');
    return null;
  }

  if (harmonyScanQueue) {
    return harmonyScanQueue;
  }

  try {
    redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    harmonyScanQueue = new Queue<HarmonyScanJobData>('harmony-scan', {
      connection: redisConnection,
    });

    console.log('[HarmonyScanQueue] Queue initialized');
    return harmonyScanQueue;
  } catch (error) {
    console.error('[HarmonyScanQueue] Failed to initialize queue:', error);
    return null;
  }
}

/**
 * Enqueue a harmony scan job
 */
export async function enqueueHarmonyScan(
  data: HarmonyScanJobData
): Promise<string | null> {
  const queue = getHarmonyScanQueue();

  if (!queue) {
    console.warn('[HarmonyScanQueue] Queue not available - falling back to synchronous scan');
    return null;
  }

  try {
    const job = await queue.add('scan', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 10000, // 10s, 20s, 40s
      },
      removeOnComplete: {
        count: 100, // Keep last 100 completed jobs
      },
      removeOnFail: {
        count: 500, // Keep last 500 failed jobs for debugging
      },
    });

    console.log(`[HarmonyScanQueue] Enqueued job ${job.id} for harmony ${data.harmonyId}`);
    return job.id || null;
  } catch (error) {
    console.error('[HarmonyScanQueue] Failed to enqueue job:', error);
    return null;
  }
}

/**
 * Create a worker to process harmony scan jobs
 * This runs in a separate process (scripts/start-harmony-scan-worker.ts)
 */
export function createHarmonyScanWorker(
  processor: (job: Job<HarmonyScanJobData>) => Promise<void>
): Worker<HarmonyScanJobData> | null {
  const redisUrl = process.env.UPSTASH_REDIS_URL;

  if (!redisUrl) {
    console.error('[HarmonyScanWorker] UPSTASH_REDIS_URL not configured');
    return null;
  }

  try {
    const connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    const worker = new Worker<HarmonyScanJobData>('harmony-scan', processor, {
      connection,
      concurrency: 2, // Process 2 scans in parallel
      limiter: {
        max: 5, // Max 5 jobs per...
        duration: 60000, // ...60 seconds (to respect HubSpot rate limits)
      },
    });

    worker.on('completed', (job) => {
      console.log(`[HarmonyScanWorker] Job ${job.id} completed for harmony ${job.data.harmonyId}`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[HarmonyScanWorker] Job ${job?.id} failed:`, err);
    });

    worker.on('error', (err) => {
      console.error('[HarmonyScanWorker] Worker error:', err);
    });

    console.log('[HarmonyScanWorker] Worker started');
    return worker;
  } catch (error) {
    console.error('[HarmonyScanWorker] Failed to create worker:', error);
    return null;
  }
}

/**
 * Close the queue connection gracefully
 */
export async function closeHarmonyScanQueue() {
  if (harmonyScanQueue) {
    await harmonyScanQueue.close();
    harmonyScanQueue = null;
  }
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}
