/**
 * Stalled Job Detector
 *
 * Monitors priority-3 (trial tier) jobs and delays them if they've been
 * running for too long, allowing higher priority jobs (scale/growth) to execute.
 *
 * This prevents a large trial org scan from blocking paid customers indefinitely.
 */

import { Worker, Job } from 'bullmq';
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
 * @param worker - The BullMQ worker instance to monitor
 * @param workerName - Name of the worker for logging (e.g., "Import Worker")
 * @returns Interval ID (can be cleared with clearInterval)
 */
export function startStalledJobMonitoring(
  worker: Worker,
  workerName: string
): NodeJS.Timeout {
  console.log(`[${workerName}] Started stalled job monitoring (check every 2min)`);

  const intervalId = setInterval(async () => {
    try {
      // TODO: Fix this - Worker doesn't have getActive() method
      // Need to pass Queue instance to access getJobs(['active'])
      // const activeJobs = await worker.getActive();
      // for (const job of activeJobs) {
      //   await checkAndDelayIfStalled(job, workerName);
      // }
      console.log(`[${workerName}] Stalled job check (temporarily disabled)`);
    } catch (error) {
      console.error(`[${workerName}] Error checking for stalled jobs:`, error);
    }
  }, CHECK_INTERVAL_MS);

  return intervalId;
}

/**
 * Check if a job is stalled and delay it if necessary
 *
 * @param job - The job to check
 * @param workerName - Name of the worker for logging
 */
async function checkAndDelayIfStalled(
  job: Job,
  workerName: string
): Promise<void> {
  // Only check priority-3 (trial tier) jobs
  if (job.opts?.priority !== JOB_PRIORITY.TRIAL) {
    return;
  }

  // Check if job has been processing too long
  const processingTime = job.processedOn ? Date.now() - job.processedOn : 0;

  if (processingTime > MAX_PRIORITY_3_RUNTIME_MS) {
    try {
      // Delay the job to allow higher priority jobs through
      await job.moveToDelayed(Date.now() + DELAY_DURATION_MS, job.token);

      const runtimeMinutes = Math.round(processingTime / 60000);
      console.warn(
        `[${workerName}] Delayed stalled priority-3 job ${job.id} ` +
          `(runtime: ${runtimeMinutes}min) to allow higher priority jobs through`
      );
    } catch (error) {
      // Job may have already completed or been moved - log but don't throw
      console.warn(
        `[${workerName}] Could not delay job ${job.id}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
}

/**
 * Stop monitoring for stalled jobs
 *
 * @param intervalId - The interval ID returned by startStalledJobMonitoring
 * @param workerName - Name of the worker for logging
 */
export function stopStalledJobMonitoring(
  intervalId: NodeJS.Timeout,
  workerName: string
): void {
  clearInterval(intervalId);
  console.log(`[${workerName}] Stopped stalled job monitoring`);
}
