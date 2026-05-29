/**
 * Normalization Queue
 *
 * BullMQ queue for processing normalization runs.
 * Applies selected harmonies to records and writes back to HubSpot.
 */

import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection, isRedisConfigured } from './redis';

// ─────────────────────────────────────────────────────────────
// Queue Configuration
// ─────────────────────────────────────────────────────────────

const QUEUE_NAME = 'normalize';

export interface NormalizeJobData {
  runId: string;
  orgId: string;
  connectionId: string;
  objectType: 'company' | 'contact';
  harmonyIds: string[];
  scope: {
    type: 'all' | 'list' | 'filter' | 'selected';
    listId?: string;
    filter?: any;
    changes?: any[];
  };
}

export interface NormalizeJobResult {
  success: boolean;
  recordsProcessed: number;
  recordsUpdated: number;
  errors?: string[];
}

// ─────────────────────────────────────────────────────────────
// Queue Instance
// ─────────────────────────────────────────────────────────────

let normalizeQueue: Queue<NormalizeJobData, NormalizeJobResult> | null = null;
let normalizeWorker: Worker<NormalizeJobData, NormalizeJobResult> | null = null;

/**
 * Get or create the normalize queue.
 */
export function getNormalizeQueue(): Queue<NormalizeJobData, NormalizeJobResult> | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - normalize queue disabled');
    return null;
  }

  if (!normalizeQueue) {
    const connection = createRedisConnection();
    normalizeQueue = new Queue<NormalizeJobData, NormalizeJobResult>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 100,
          age: 24 * 60 * 60, // 24 hours
        },
        removeOnFail: {
          count: 500,
          age: 7 * 24 * 60 * 60, // 7 days
        },
      },
    });
  }

  return normalizeQueue;
}

/**
 * Enqueue a normalization job.
 */
export async function enqueueNormalization(
  data: NormalizeJobData
): Promise<{ queued: boolean; jobId?: string; reason?: string }> {
  const queue = getNormalizeQueue();

  if (!queue) {
    return { queued: false, reason: 'Queue not configured' };
  }

  const jobId = `normalize:${data.runId}`;

  try {
    const job = await queue.add('normalize-run', data, { jobId });

    return { queued: true, jobId: job.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { queued: false, reason: message };
  }
}

/**
 * Start the normalize worker.
 * Called by worker script (scripts/start-normalize-worker.ts).
 */
export async function startNormalizeWorker() {
  if (!isRedisConfigured()) {
    throw new Error('Redis not configured');
  }

  if (normalizeWorker) {
    console.log('[Normalize Worker] Already running');
    return normalizeWorker;
  }

  const connection = createRedisConnection();

  normalizeWorker = new Worker<NormalizeJobData, NormalizeJobResult>(
    QUEUE_NAME,
    async (job: Job<NormalizeJobData, NormalizeJobResult>) => {
      console.log(`[Normalize Worker] Processing job ${job.id}:`, job.data);

      // TODO: Implement normalization processing
      // This will:
      // 1. Fetch the normalization_runs record
      // 2. Get the harmonies to apply
      // 3. Fetch records from HubSpot based on scope
      // 4. Apply harmonies to each record
      // 5. Write changes back to HubSpot
      // 6. Update normalization_runs with results

      // For now, return placeholder result
      return {
        success: false,
        recordsProcessed: 0,
        recordsUpdated: 0,
        errors: ['Normalization worker not yet implemented - job queued successfully'],
      };
    },
    {
      connection,
      concurrency: 1, // Keep low to respect HubSpot rate limits
    }
  );

  normalizeWorker.on('completed', (job) => {
    console.log(`[Normalize Worker] Completed job ${job.id}`);
  });

  normalizeWorker.on('failed', (job, err) => {
    console.error(`[Normalize Worker] Failed job ${job?.id}:`, err.message);
  });

  console.log('[Normalize Worker] Started');
  return normalizeWorker;
}

/**
 * Stop the normalize worker.
 */
export async function stopNormalizeWorker() {
  if (normalizeWorker) {
    await normalizeWorker.close();
    normalizeWorker = null;
    console.log('[Normalize Worker] Stopped');
  }
}
