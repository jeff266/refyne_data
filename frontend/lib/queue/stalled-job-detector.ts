/**
 * Stalled Job Detector
 *
 * Monitors priority-3 (trial tier) jobs and delays them if they've been
 * running for too long, allowing higher priority jobs (scale/growth) to execute.
 *
 * This prevents a large trial org scan from blocking paid customers indefinitely.
 */

import { Queue, Job } from 'bullmq';
import { JOB_PRIORITY } from '@/lib/billing/job-priority';

/**
 * Maximum time a priority-3 job can run before being delayed (10 minutes)
 */
const MAX_PRIORITY_3_RUNTIME_MS = 10 * 60 * 1000;

/**
 * How long to delay a stalled job (1 minute)
 */
const DELAY_DURATION_MS = 60 * 1000;

/**
 * How often to check for stalled jobs (2 minutes)
 */
const CHECK_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Start monitoring for stalled priority-3 jobs
 *
 * @param queue - The BullMQ queue instance to monitor
 * @param queueName - Name of the queue for logging (e.g., "Import Queue")
 * @returns Interval ID (can be cleared with clearInterval)
 */
export function startStalledJobMonitoring(
  queue: Queue,
  queueName: string
): NodeJS.Timeout {
  console.log(`[${queueName}] Started stalled job monitoring (check every 2min)`);

  const intervalId = setInterval(async () => {
    try {
      await checkStalledJobs(queue, queueName);
    } catch (error) {
      console.error(`[${queueName}] Error checking for stalled jobs:`, error);
    }
  }, CHECK_INTERVAL_MS);

  return intervalId;
}

/**
 * Check for stalled jobs and delay them if necessary
 *
 * @param queue - The BullMQ queue to check
 * @param queueName - Name of the queue for logging
 */
async function checkStalledJobs(queue: Queue, queueName: string): Promise<void> {
  const activeJobs = await queue.getActive();
  const now = Date.now();

  for (const job of activeJobs) {
    // Only check priority-3 (trial tier) jobs
    if (!job.opts?.priority || job.opts.priority !== JOB_PRIORITY.TRIAL) {
      continue;
    }

    const processedOn = job.processedOn ?? now;
    const runningMs = now - processedOn;

    if (runningMs > MAX_PRIORITY_3_RUNTIME_MS) {
      try {
        // Delay the job to allow higher priority jobs through
        await job.moveToDelayed(now + DELAY_DURATION_MS, job.token);

        console.warn(
          `[${queueName}] Delayed priority-3 job ${job.id} ` +
            `after ${Math.round(runningMs / 1000)}s to allow higher priority jobs through`
        );
      } catch (error) {
        // Job may have already completed or been moved - log but don't throw
        console.warn(
          `[${queueName}] Could not delay job ${job.id}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }
}

/**
 * Stop monitoring for stalled jobs
 *
 * @param intervalId - The interval ID returned by startStalledJobMonitoring
 * @param queueName - Name of the queue for logging
 */
export function stopStalledJobMonitoring(
  intervalId: NodeJS.Timeout,
  queueName: string
): void {
  clearInterval(intervalId);
  console.log(`[${queueName}] Stopped stalled job monitoring`);
}
