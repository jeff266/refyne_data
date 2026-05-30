#!/usr/bin/env npx tsx

/**
 * Normalize Apply Worker Startup Script
 *
 * Starts the BullMQ worker that processes normalize apply jobs.
 * Re-runs normalization preview engine and writes to HubSpot.
 */

import { startNormalizeWorker } from '../lib/queue/normalize-worker';
import { isRedisConfigured } from '../lib/queue/redis';

async function main() {
  console.log('═'.repeat(60));
  console.log('Normalize Apply Worker - Railway Deployment v2');
  console.log('═'.repeat(60));

  if (!isRedisConfigured()) {
    console.error('❌ Redis not configured');
    process.exit(1);
  }

  console.log('Starting normalize worker...');
  const worker = startNormalizeWorker();

  if (!worker) {
    console.error('❌ Failed to start worker');
    process.exit(1);
  }

  console.log('✅ Normalize worker started');
  console.log('Worker is running. Press Ctrl+C to stop.');

  // Add global error handlers
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit - worker should stay up
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit immediately - give time to finish current jobs
    setTimeout(() => process.exit(1), 5000);
  });

  const shutdown = async () => {
    console.log('\nShutting down gracefully...');
    try {
      await worker.close();
      console.log('Worker closed successfully');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});
