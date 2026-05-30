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
  console.log('Normalize Apply Worker');
  console.log('═'.repeat(60));

  if (!isRedisConfigured()) {
    console.error('❌ Redis not configured');
    process.exit(1);
  }

  const worker = startNormalizeWorker();
  console.log('✅ Normalize worker started');
  console.log('Worker is running. Press Ctrl+C to stop.');

  const shutdown = async () => {
    console.log('\nShutting down...');
    await worker.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});
