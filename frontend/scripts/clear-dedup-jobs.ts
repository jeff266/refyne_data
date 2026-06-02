#!/usr/bin/env npx tsx
/**
 * Clear failed and waiting jobs from dedup BullMQ queue
 *
 * Usage:
 *   npx tsx scripts/clear-dedup-jobs.ts org_3EO4lJVNFJTFXSaUi8iieMKwFTx
 */

import { Queue } from 'bullmq';
import { createRedisConnection } from '../lib/queue/redis';

async function clearDedupJobs(orgId: string) {
  const redis = createRedisConnection();

  const queue = new Queue('company-dedup-scan', {
    connection: redis,
  });

  console.log(`[Clear Jobs] Clearing failed and waiting jobs for org ${orgId}...`);

  // Get all jobs in various states
  const [failedJobs, waitingJobs, delayedJobs, activeJobs] = await Promise.all([
    queue.getFailed(),
    queue.getWaiting(),
    queue.getDelayed(),
    queue.getActive(),
  ]);

  console.log(`[Clear Jobs] Found:`);
  console.log(`  - Failed: ${failedJobs.length}`);
  console.log(`  - Waiting: ${waitingJobs.length}`);
  console.log(`  - Delayed: ${delayedJobs.length}`);
  console.log(`  - Active: ${activeJobs.length}`);

  // Filter jobs for this org
  const orgFailedJobs = failedJobs.filter(job => job.data.orgId === orgId);
  const orgWaitingJobs = waitingJobs.filter(job => job.data.orgId === orgId);
  const orgDelayedJobs = delayedJobs.filter(job => job.data.orgId === orgId);

  console.log(`\n[Clear Jobs] Org ${orgId} jobs:`);
  console.log(`  - Failed: ${orgFailedJobs.length}`);
  console.log(`  - Waiting: ${orgWaitingJobs.length}`);
  console.log(`  - Delayed: ${orgDelayedJobs.length}`);

  // Remove failed jobs for this org
  let removedCount = 0;
  for (const job of orgFailedJobs) {
    await job.remove();
    console.log(`  ✓ Removed failed job: ${job.id}`);
    removedCount++;
  }

  // Remove waiting jobs for this org
  for (const job of orgWaitingJobs) {
    await job.remove();
    console.log(`  ✓ Removed waiting job: ${job.id}`);
    removedCount++;
  }

  // Remove delayed jobs for this org
  for (const job of orgDelayedJobs) {
    await job.remove();
    console.log(`  ✓ Removed delayed job: ${job.id}`);
    removedCount++;
  }

  console.log(`\n[Clear Jobs] Total removed: ${removedCount} jobs`);

  // Clean up old completed/failed jobs from the queue
  await queue.clean(0, 1000, 'completed');
  await queue.clean(0, 1000, 'failed');
  console.log(`[Clear Jobs] Cleaned old completed/failed jobs`);

  await queue.close();
  await redis.quit();

  console.log(`[Clear Jobs] Done ✓`);
}

// Get org ID from command line args
const orgId = process.argv[2];

if (!orgId) {
  console.error('Usage: npx tsx scripts/clear-dedup-jobs.ts <orgId>');
  console.error('Example: npx tsx scripts/clear-dedup-jobs.ts org_3EO4lJVNFJTFXSaUi8iieMKwFTx');
  process.exit(1);
}

clearDedupJobs(orgId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Clear Jobs] Error:', error);
    process.exit(1);
  });
