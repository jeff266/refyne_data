#!/usr/bin/env npx tsx
/**
 * Start Enrichment Worker
 *
 * Starts the BullMQ worker for processing enrichment jobs.
 * Runs on Railway worker dyno to handle large batch enrichments.
 *
 * Usage:
 *   npm run worker:enrichment
 *   or: npx tsx scripts/start-enrichment-worker.ts
 */

import { startEnrichmentWorker } from '../lib/queue/enrichment-queue';

console.log('[Enrichment Worker] Starting...');

const worker = startEnrichmentWorker();

if (!worker) {
  console.error('[Enrichment Worker] Failed to start - check Redis configuration');
  process.exit(1);
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Enrichment Worker] Received SIGTERM, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Enrichment Worker] Received SIGINT, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});

console.log('[Enrichment Worker] Running. Press Ctrl+C to stop.');

// Keep process alive
process.stdin.resume();
