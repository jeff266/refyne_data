#!/usr/bin/env npx tsx
/**
 * Record Count Worker Entry Point
 *
 * Starts the BullMQ worker for fetching HubSpot record counts.
 * Run this on a dedicated worker dyno (e.g., Railway worker service).
 *
 * Usage:
 *   UPSTASH_REDIS_URL=rediss://... npx tsx scripts/start-record-count-worker.ts
 *
 * Environment variables:
 *   UPSTASH_REDIS_URL - Redis connection string (required)
 */

import {
  startRecordCountWorker,
  stopRecordCountWorker,
  getQueueStats,
} from '../lib/queue/record-count-queue';
import { isRedisConfigured } from '../lib/queue/redis';

async function main() {
  console.log('═'.repeat(60));
  console.log('HubSpot Record Count Worker');
  console.log('═'.repeat(60));

  // Check Redis configuration
  if (!isRedisConfigured()) {
    console.error('❌ Redis not configured');
    console.error('Set UPSTASH_REDIS_URL or REDIS_URL environment variable');
    process.exit(1);
  }

  // Display configuration
  console.log(`\nConfiguration:`);
  console.log(`  Concurrency: 2 parallel jobs`);
  console.log(`  Job type:    Background (low priority)`);

  // Start the worker
  console.log('\nStarting worker...');
  const worker = startRecordCountWorker();

  if (!worker) {
    console.error('❌ Failed to start worker');
    process.exit(1);
  }

  console.log('✅ Worker started successfully\n');

  // Display initial queue stats
  const stats = await getQueueStats();
  if (stats) {
    console.log('Queue status:');
    console.log(`  Waiting:   ${stats.waiting}`);
    console.log(`  Active:    ${stats.active}`);
    console.log(`  Completed: ${stats.completed}`);
    console.log(`  Failed:    ${stats.failed}`);
  }

  console.log('\nWorker is running. Press Ctrl+C to stop.\n');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    await stopRecordCountWorker();
    console.log('Worker stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Periodic stats logging
  setInterval(async () => {
    const currentStats = await getQueueStats();
    if (currentStats && (currentStats.waiting > 0 || currentStats.active > 0)) {
      console.log(`[${new Date().toISOString()}] waiting=${currentStats.waiting} active=${currentStats.active} completed=${currentStats.completed} failed=${currentStats.failed}`);
    }
  }, 60_000); // Log every 60 seconds if there's activity
}

main().catch(err => {
  console.error('Worker error:', err);
  process.exit(1);
});
