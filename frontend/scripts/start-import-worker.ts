#!/usr/bin/env npx tsx
/**
 * Import Worker Entry Point
 *
 * Starts the BullMQ worker for processing event list import jobs.
 * Run this on a dedicated worker dyno (e.g., Railway worker service).
 *
 * Usage:
 *   UPSTASH_REDIS_URL=rediss://... npx tsx scripts/start-import-worker.ts
 *
 * Environment variables:
 *   UPSTASH_REDIS_URL - Redis connection string (required)
 */

import { startImportWorker, stopImportWorker } from '../lib/queue/import-queue';
import { isRedisConfigured } from '../lib/queue/redis';

async function main() {
  console.log('═'.repeat(60));
  console.log('Event List Import Worker');
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
  console.log(`  Batch size:  100 contacts per batch`);

  // Start the worker
  console.log('\nStarting worker...');
  const worker = startImportWorker();

  if (!worker) {
    console.error('❌ Failed to start worker');
    process.exit(1);
  }

  console.log('✅ Worker started successfully\n');
  console.log('Worker is running. Press Ctrl+C to stop.\n');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    await stopImportWorker();
    console.log('Worker stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});
