/**
 * Harmony Scan Worker
 *
 * Long-running process that processes harmony field scan jobs from BullMQ.
 * Deploy this to Railway or similar service that supports long-running processes.
 *
 * Usage:
 *   npm run worker:harmony-scan
 *   UPSTASH_REDIS_URL=rediss://... npx tsx scripts/start-harmony-scan-worker.ts
 */

import { createHarmonyScanWorker, stopHarmonyScanMonitoring } from '../lib/queue/harmony-scan-queue';
import { processHarmonyScan } from '../lib/queue/harmony-scan-processor';

async function main() {
  console.log('');
  console.log('='.repeat(70));
  console.log('🔧 HARMONY SCAN WORKER');
  console.log('='.repeat(70));
  console.log('');

  if (!process.env.UPSTASH_REDIS_URL) {
    console.error('❌ UPSTASH_REDIS_URL environment variable not set');
    process.exit(1);
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ Supabase environment variables not set');
    process.exit(1);
  }

  const worker = createHarmonyScanWorker(processHarmonyScan);

  if (!worker) {
    console.error('❌ Failed to create worker');
    process.exit(1);
  }

  console.log('✅ Worker started and waiting for jobs...');
  console.log('   Queue: harmony-scan');
  console.log('   Concurrency: 2 jobs');
  console.log('   Rate limit: 5 jobs per 60 seconds');
  console.log('');

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    stopHarmonyScanMonitoring();
    await worker.close();
    console.log('Worker closed');
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

main();
