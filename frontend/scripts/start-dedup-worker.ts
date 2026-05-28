#!/usr/bin/env npx tsx
/**
 * Company Dedup Worker Entry Point
 *
 * Starts the BullMQ worker for processing company dedup scan jobs.
 * Run this on a dedicated worker dyno (e.g., Railway worker service).
 *
 * Usage:
 *   UPSTASH_REDIS_URL=rediss://... npx tsx scripts/start-dedup-worker.ts
 *
 * Environment variables:
 *   UPSTASH_REDIS_URL - Redis connection string (required)
 */

import {
  startCompanyDedupScanWorker,
  stopCompanyDedupScanWorker,
  getCompanyDedupScanQueueStats,
} from '../lib/dedup/company-dedup-scanner';
import {
  startAutoMergeWorker,
  stopAutoMergeWorker,
  getAutoMergeQueueStats,
} from '../lib/dedup/auto-merge-queue';
import { isRedisConfigured } from '../lib/queue/redis';

async function main() {
  console.log('═'.repeat(60));
  console.log('Company Dedup Scanner Worker');
  console.log('═'.repeat(60));

  // Check Redis configuration
  if (!isRedisConfigured()) {
    console.error('❌ Redis not configured');
    console.error('Set UPSTASH_REDIS_URL or REDIS_URL environment variable');
    process.exit(1);
  }

  // Start the dedup scan worker
  console.log('\nStarting company dedup worker...');
  const dedupWorker = startCompanyDedupScanWorker();

  if (!dedupWorker) {
    console.error('❌ Failed to start dedup worker');
    process.exit(1);
  }

  console.log('✅ Dedup worker started successfully');

  // Start the auto-merge worker
  console.log('\nStarting auto-merge worker...');
  const autoMergeWorker = startAutoMergeWorker();

  if (!autoMergeWorker) {
    console.warn('⚠️  Auto-merge worker not started (Redis may not be configured)');
  } else {
    console.log('✅ Auto-merge worker started successfully');
  }

  console.log('');

  // Display initial queue stats
  const dedupStats = await getCompanyDedupScanQueueStats();
  if (dedupStats) {
    console.log('Dedup queue status:');
    console.log(`  Waiting:   ${dedupStats.waiting}`);
    console.log(`  Active:    ${dedupStats.active}`);
    console.log(`  Completed: ${dedupStats.completed}`);
    console.log(`  Failed:    ${dedupStats.failed}`);
  }

  const autoMergeStats = await getAutoMergeQueueStats();
  if (autoMergeStats) {
    console.log('\nAuto-merge queue status:');
    console.log(`  Waiting:   ${autoMergeStats.waiting}`);
    console.log(`  Active:    ${autoMergeStats.active}`);
    console.log(`  Delayed:   ${autoMergeStats.delayed}`);
    console.log(`  Completed: ${autoMergeStats.completed}`);
    console.log(`  Failed:    ${autoMergeStats.failed}`);
  }

  console.log('\nWorkers are running. Press Ctrl+C to stop.\n');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    await Promise.all([
      stopCompanyDedupScanWorker(),
      stopAutoMergeWorker(),
    ]);
    console.log('Workers stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Periodic stats logging
  setInterval(async () => {
    const currentStats = await getCompanyDedupScanQueueStats();
    if (currentStats && (currentStats.waiting > 0 || currentStats.active > 0)) {
      console.log(
        `[${new Date().toISOString()}] waiting=${currentStats.waiting} active=${currentStats.active} ` +
        `completed=${currentStats.completed} failed=${currentStats.failed}`
      );
    }
  }, 30_000); // Log every 30 seconds if there's activity
}

main().catch(err => {
  console.error('Worker error:', err);
  process.exit(1);
});
