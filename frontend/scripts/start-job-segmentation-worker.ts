/**
 * Start Job Segmentation Worker
 *
 * Starts the BullMQ worker that processes job segmentation runs.
 * This should run as a separate process (e.g., on Railway worker dyno).
 *
 * Usage:
 *   npm run worker:jobs
 */

import { jobSegmentationWorker } from '../lib/queue/job-segmentation-worker';

console.log('=== Job Segmentation Worker Starting ===\n');
console.log('Concurrency: 1 (one run at a time)');
console.log('Queue: job-segmentation');
console.log('Press Ctrl+C to stop\n');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nSIGTERM received, closing worker...');
  await jobSegmentationWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, closing worker...');
  await jobSegmentationWorker.close();
  process.exit(0);
});

// Keep process alive
jobSegmentationWorker.on('ready', () => {
  console.log('✓ Worker ready and listening for jobs\n');
});
