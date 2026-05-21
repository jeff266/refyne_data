#!/usr/bin/env npx tsx
/**
 * Arrangement Worker Entry Point
 *
 * Starts the BullMQ worker for processing arrangement enrichment runs.
 * Run this on a dedicated worker dyno (e.g., Railway worker service).
 *
 * Usage:
 *   UPSTASH_REDIS_URL=rediss://... npx tsx scripts/start-arrangement-worker.ts
 *
 * Environment variables:
 *   UPSTASH_REDIS_URL - Redis connection string (required)
 *   NEXT_PUBLIC_SUPABASE_URL - Supabase URL (required)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY - Supabase anon key (required)
 */

import { startArrangementWorker, stopArrangementWorker } from '../lib/queue/arrangement-queue';
import { isRedisConfigured } from '../lib/queue/redis';
import { isSupabaseConfigured } from '../lib/db/supabase';

async function main() {
  console.log('═'.repeat(60));
  console.log('Arrangement Worker');
  console.log('═'.repeat(60));

  // Check Redis configuration
  if (!isRedisConfigured()) {
    console.error('❌ UPSTASH_REDIS_URL not configured');
    process.exit(1);
  }

  // Check Supabase configuration
  if (!isSupabaseConfigured()) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('✅ Redis configured');
  console.log('✅ Supabase configured\n');

  // Start arrangement worker
  console.log('Starting arrangement worker...');
  const worker = startArrangementWorker();

  if (!worker) {
    console.error('❌ Failed to start arrangement worker');
    process.exit(1);
  }

  console.log('✅ Arrangement worker started with concurrency=3\n');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down arrangement worker...');
    await stopArrangementWorker();
    console.log('✅ Worker stopped');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log('📡 Arrangement worker is now processing jobs');
  console.log('Press Ctrl+C to stop\n');
}

main().catch((err) => {
  console.error('❌ Arrangement worker failed to start:', err);
  process.exit(1);
});
