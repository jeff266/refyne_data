/**
 * Rollback Queue
 *
 * BullMQ queue for normalization rollback processing.
 * Handles async rollback of normalization runs.
 */

import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection, isRedisConfigured } from './redis';
import { executeRollback } from '../normalize/rollback';
import { supabase } from '../db/supabase';
import { getAccessToken } from '../hubspot/get-access-token';

// ─────────────────────────────────────────────────────────────
// Queue Configuration
// ─────────────────────────────────────────────────────────────

const QUEUE_NAME = 'normalize-rollback';

/**
 * Worker concurrency - how many rollback jobs to process in parallel.
 */
const WORKER_CONCURRENCY = 2;

/**
 * Retry settings - rollback jobs should retry on transient failures.
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
 * Data for a rollback job.
 */
export interface RollbackJobData {
  runId: string;
  orgId: string;
  userId: string;
}

/**
 * Result from processing a rollback job.
 */
export interface RollbackJobResult {
  runId: string;
  status: 'completed' | 'failed' | 'partial';
  rolledBack: number;
  failed: number;
  errors?: Array<{
    company_id: string;
    field: string;
    error: string;
  }>;
}

// ─────────────────────────────────────────────────────────────
// Queue Instance
// ─────────────────────────────────────────────────────────────

let rollbackQueue: Queue<RollbackJobData, RollbackJobResult> | null = null;
let rollbackWorker: Worker<RollbackJobData, RollbackJobResult> | null = null;

/**
 * Get or create the rollback queue.
 */
export function getRollbackQueue(): Queue<RollbackJobData, RollbackJobResult> | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - rollback queue disabled');
    return null;
  }

  if (!rollbackQueue) {
    const connection = createRedisConnection();
    rollbackQueue = new Queue<RollbackJobData, RollbackJobResult>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: RETRY_SETTINGS.attempts,
        backoff: RETRY_SETTINGS.backoff,
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs
          age: 30 * 24 * 60 * 60, // Remove after 30 days
        },
        removeOnFail: {
          count: 500, // Keep last 500 failed jobs
          age: 90 * 24 * 60 * 60, // Remove after 90 days
        },
      },
    });
  }

  return rollbackQueue;
}

/**
 * Enqueue a rollback job.
 *
 * @param runId - Normalization run ID
 * @param orgId - Organization ID
 * @param userId - User who initiated the rollback
 */
export async function enqueueRollbackJob(
  runId: string,
  orgId: string,
  userId: string
): Promise<{ queued: boolean; jobId?: string; reason?: string }> {
  const queue = getRollbackQueue();

  if (!queue) {
    return { queued: false, reason: 'Queue not configured' };
  }

  const jobData: RollbackJobData = {
    runId,
    orgId,
    userId,
  };

  // Use run ID as job ID to prevent duplicate rollback jobs
  const jobId = `rollback:${runId}`;

  try {
    const job = await queue.add('process-rollback', jobData, {
      jobId,
    });

    return { queued: true, jobId: job.id };
  } catch (error) {
    console.error('Failed to enqueue rollback job:', error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Worker
// ─────────────────────────────────────────────────────────────

/**
 * Rollback job handler - calls executeRollback() and updates run status.
 */
async function processRollbackJob(
  job: Job<RollbackJobData, RollbackJobResult>
): Promise<RollbackJobResult> {
  const { runId, orgId, userId } = job.data;

  console.log(`Processing rollback job for runId=${runId}, orgId=${orgId}, userId=${userId}`);

  if (!supabase) {
    throw new Error('Database not configured');
  }

  try {
    // Get run details
    const { data: run, error: runError } = await supabase
      .from('normalization_runs')
      .select('id, org_id, connection_id')
      .eq('id', runId)
      .eq('org_id', orgId)
      .single();

    if (runError || !run) {
      throw new Error(`Run not found: ${runError?.message}`);
    }

    // Get HubSpot connection details
    const { data: connection, error: connError } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('id', run.connection_id)
      .single();

    if (connError || !connection) {
      throw new Error(`Connection not found: ${connError?.message}`);
    }

    // Get access token
    const accessToken = await getAccessToken(orgId);

    // Update run status to rolling_back
    await supabase
      .from('normalization_runs')
      .update({
        status: 'rolling_back',
        rolled_back_by: userId,
      })
      .eq('id', runId);

    // Execute rollback
    const result = await executeRollback(
      runId,
      orgId,
      accessToken,
      connection.portal_id
    );

    // Determine final status
    let status: 'completed' | 'failed' | 'partial' = 'completed';
    if (result.failed > 0 && result.rolled_back === 0) {
      status = 'failed';
    } else if (result.failed > 0) {
      status = 'partial';
    }

    // Update run status
    await supabase
      .from('normalization_runs')
      .update({
        status: result.success ? 'rolled_back' : 'failed',
        rolled_back_at: new Date().toISOString(),
        rollback_error: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
      })
      .eq('id', runId);

    return {
      runId,
      status,
      rolledBack: result.rolled_back,
      failed: result.failed,
      errors: result.errors,
    };

  } catch (error) {
    console.error('Rollback job failed:', error);

    // Update run status to failed
    if (supabase) {
      await supabase
        .from('normalization_runs')
        .update({
          status: 'failed',
          rollback_error: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', runId);
    }

    throw error;
  }
}

/**
 * Start the rollback worker.
 * Call this from a worker process (e.g., Railway worker dyno).
 */
export function startRollbackWorker(): Worker<RollbackJobData, RollbackJobResult> | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - rollback worker disabled');
    return null;
  }

  if (rollbackWorker) {
    return rollbackWorker;
  }

  const connection = createRedisConnection();

  rollbackWorker = new Worker<RollbackJobData, RollbackJobResult>(
    QUEUE_NAME,
    processRollbackJob,
    {
      connection,
      concurrency: WORKER_CONCURRENCY,
    }
  );

  // Event handlers
  rollbackWorker.on('completed', (job, result) => {
    console.log(`Rollback job ${job.id} completed: status=${result.status}, rolledBack=${result.rolledBack}, failed=${result.failed}`);
  });

  rollbackWorker.on('failed', (job, error) => {
    console.error(`Rollback job ${job?.id} failed:`, error.message);
  });

  rollbackWorker.on('error', (error) => {
    console.error('Rollback worker error:', error);
  });

  console.log(`Rollback worker started with concurrency=${WORKER_CONCURRENCY}`);

  return rollbackWorker;
}

/**
 * Stop the rollback worker gracefully.
 */
export async function stopRollbackWorker(): Promise<void> {
  if (rollbackWorker) {
    await rollbackWorker.close();
    rollbackWorker = null;
  }

  if (rollbackQueue) {
    await rollbackQueue.close();
    rollbackQueue = null;
  }
}

/**
 * Get queue statistics.
 */
export async function getRollbackQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
} | null> {
  const queue = getRollbackQueue();
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
