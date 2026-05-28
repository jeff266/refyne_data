#!/usr/bin/env npx tsx
/**
 * Start Enrichment Workers
 *
 * Starts all BullMQ workers for enrichment:
 * - enrichment: Full arrangement-based enrichment runs
 * - enrich-preview: Interactive preview for Enrich page
 * - enrich-apply: Apply preview results to HubSpot
 *
 * Runs on Railway worker dyno to handle all enrichment workloads.
 *
 * Usage:
 *   npm run worker:enrichment
 *   or: npx tsx scripts/start-enrichment-worker.ts
 */

import {
  startEnrichmentWorker,
  startPreviewWorker,
  startApplyWorker,
  stopEnrichmentWorker,
  stopPreviewWorker,
  stopApplyWorker,
} from '../lib/queue/enrichment-queue';

console.log('[Enrichment Workers] Starting all workers...');

const enrichmentWorker = startEnrichmentWorker();
const previewWorker = startPreviewWorker();
const applyWorker = startApplyWorker();

if (!enrichmentWorker || !previewWorker || !applyWorker) {
  console.error('[Enrichment Workers] Failed to start - check Redis configuration');
  process.exit(1);
}

// Graceful shutdown
const shutdown = async () => {
  console.log('[Enrichment Workers] Shutting down gracefully...');
  await Promise.all([
    stopEnrichmentWorker(),
    stopPreviewWorker(),
    stopApplyWorker(),
  ]);
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[Enrichment Workers] All workers running. Press Ctrl+C to stop.');
console.log('  - enrichment: Full arrangement runs');
console.log('  - enrich-preview: Interactive preview');
console.log('  - enrich-apply: Apply cached results');

// Keep process alive
process.stdin.resume();
