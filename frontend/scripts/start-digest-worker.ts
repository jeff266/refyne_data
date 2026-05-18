#!/usr/bin/env npx tsx
/**
 * Digest Worker Entry Point
 *
 * Starts the BullMQ worker for processing Always On digest jobs
 * and runs the nightly cron scheduler.
 * Run this on a dedicated worker dyno (e.g., Railway worker service).
 *
 * Usage:
 *   UPSTASH_REDIS_URL=rediss://... npx tsx scripts/start-digest-worker.ts
 *
 * Environment variables:
 *   UPSTASH_REDIS_URL - Redis connection string (required)
 *   NEXT_PUBLIC_SUPABASE_URL - Supabase URL (required)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY - Supabase anon key (required)
 */

import {
  startDigestWorker,
  stopDigestWorker,
  getDigestQueueStats,
  enqueueDigestJob,
} from '../lib/queue/digest-queue';
import { isRedisConfigured } from '../lib/queue/redis';
import { supabase, isSupabaseConfigured } from '../lib/db/supabase';

async function main() {
  console.log('═'.repeat(60));
  console.log('Always On Digest Worker');
  console.log('═'.repeat(60));

  // Check Redis configuration
  if (!isRedisConfigured()) {
    console.error('❌ Redis not configured');
    console.error('Set UPSTASH_REDIS_URL or REDIS_URL environment variable');
    process.exit(1);
  }

  // Check Supabase configuration
  if (!isSupabaseConfigured() || !supabase) {
    console.error('❌ Supabase not configured');
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  // Start the worker
  console.log('\nStarting digest worker...');
  const worker = startDigestWorker();

  if (!worker) {
    console.error('❌ Failed to start worker');
    process.exit(1);
  }

  console.log('✅ Digest worker started successfully\n');

  // Display initial queue stats
  const stats = await getDigestQueueStats();
  if (stats) {
    console.log('Queue status:');
    console.log(`  Waiting:   ${stats.waiting}`);
    console.log(`  Active:    ${stats.active}`);
    console.log(`  Completed: ${stats.completed}`);
    console.log(`  Failed:    ${stats.failed}`);
  }

  console.log('\n✅ Starting nightly digest scheduler...');
  console.log('Checking for scheduled digest scans every minute\n');

  // Cron scheduler - check every minute for orgs that need to run
  const cronInterval = setInterval(async () => {
    try {
      await checkAndEnqueueDigests();
    } catch (error) {
      console.error('Error in digest scheduler:', error);
    }
  }, 60_000); // Check every minute

  console.log('Worker is running. Press Ctrl+C to stop.\n');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    clearInterval(cronInterval);
    await stopDigestWorker();
    console.log('Worker stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Periodic stats logging
  setInterval(async () => {
    const currentStats = await getDigestQueueStats();
    if (currentStats && (currentStats.waiting > 0 || currentStats.active > 0)) {
      console.log(
        `[${new Date().toISOString()}] ` +
        `waiting=${currentStats.waiting} ` +
        `active=${currentStats.active} ` +
        `completed=${currentStats.completed} ` +
        `failed=${currentStats.failed}`
      );
    }
  }, 60_000); // Log every minute if there's activity
}

/**
 * Check for orgs that need digest scans and enqueue jobs.
 */
async function checkAndEnqueueDigests(): Promise<void> {
  if (!supabase) return;

  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();

  // Get all orgs with Always On enabled
  const { data: entitlements, error: entError } = await supabase
    .from('workspace_entitlements')
    .select('org_id')
    .eq('always_on_enabled', true);

  if (entError) {
    console.error('Error fetching entitlements:', entError);
    return;
  }

  if (!entitlements || entitlements.length === 0) {
    return;
  }

  for (const { org_id } of entitlements) {
    // Get org's scan time from config
    const { data: config, error: configError } = await supabase
      .from('always_on_config')
      .select('scan_time_utc')
      .eq('org_id', org_id)
      .single();

    if (configError || !config) {
      continue;
    }

    // Parse scan time (format: HH:MM:SS)
    const [hours, minutes] = config.scan_time_utc.split(':').map(Number);

    // Check if current UTC time matches scan time (within 1 minute window)
    if (currentHour === hours && currentMinute === minutes) {
      // Check if we already ran in the last hour to avoid duplicates
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const { data: recentRun } = await supabase
        .from('digest_runs')
        .select('id')
        .eq('org_id', org_id)
        .eq('triggered_by', 'schedule')
        .gte('run_at', oneHourAgo.toISOString())
        .limit(1)
        .single();

      if (recentRun) {
        // Already ran recently, skip
        continue;
      }

      console.log(
        `[${new Date().toISOString()}] ` +
        `Triggering digest for org ${org_id} at ${config.scan_time_utc} UTC`
      );

      // Enqueue digest job
      await enqueueDigestJob(org_id, undefined, 'schedule');
    }
  }
}

main().catch(err => {
  console.error('Worker error:', err);
  process.exit(1);
});
