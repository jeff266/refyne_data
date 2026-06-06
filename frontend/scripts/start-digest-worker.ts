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
 *   SENTRY_DSN - Sentry DSN for error tracking (optional)
 *   PORT - HTTP health check port (default: 3000)
 */

import http from 'http';

// Start HTTP health check server for Railway
const PORT = parseInt(process.env.PORT || '8080');
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});
healthServer.listen(PORT, () => {
  console.log(`[Health] HTTP server listening on port ${PORT}`);
});

import * as Sentry from '@sentry/node';

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  tracesSampleRate: 0.1,
});

import {
  startDigestWorker,
  stopDigestWorker,
  getDigestQueueStats,
  enqueueDigestJob,
} from '../lib/queue/digest-queue';
import { isRedisConfigured } from '../lib/queue/redis';
import { supabase, isSupabaseConfigured } from '../lib/db/supabase';
import { checkMissedJobs } from '../lib/monitoring/check-missed-jobs';
import {
  startCompanyDedupScanWorker,
  stopCompanyDedupScanWorker,
  enqueueCompanyDedupScan,
} from '../lib/dedup/company-dedup-scanner';
import { startArrangementWorker, stopArrangementWorker } from '../lib/queue/arrangement-queue';
import { startPreviewWorker, stopPreviewWorker } from '../lib/queue/enrichment-queue';
import { startTaxonomySuggestionWorker, stopTaxonomySuggestionWorker } from '../lib/queue/taxonomy-suggestion-queue';
import { startCleanupWorker, getCleanupQueue } from '../lib/queue/cleanup-worker';
import { createHarmonyScanWorker } from '../lib/queue/harmony-scan-queue';
import { processHarmonyScan } from '../lib/queue/harmony-scan-processor';

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

  // Start the digest worker
  console.log('\nStarting digest worker...');
  const worker = startDigestWorker();

  if (!worker) {
    console.error('❌ Failed to start digest worker');
    process.exit(1);
  }

  console.log('✅ Digest worker started successfully\n');

  // Start the company dedup scan worker
  console.log('Starting company dedup scan worker...');
  const dedupWorker = startCompanyDedupScanWorker();

  if (!dedupWorker) {
    console.log('⚠️  Company dedup scan worker disabled (Redis not configured)');
  } else {
    console.log('✅ Company dedup scan worker started successfully\n');
  }

  // Start the arrangement worker (field_configs + aggregation strategies)
  console.log('Starting arrangement worker...');
  const arrangementWorker = startArrangementWorker();

  if (!arrangementWorker) {
    console.log('⚠️  Arrangement worker disabled (Redis not configured)');
  } else {
    console.log('✅ Arrangement worker started successfully\n');
  }

  // Start the preview worker (enrich page preview)
  console.log('Starting preview worker...');
  const previewWorker = startPreviewWorker();

  if (!previewWorker) {
    console.log('⚠️  Preview worker disabled (Redis not configured)');
  } else {
    console.log('✅ Preview worker started successfully\n');
  }

  // Start the taxonomy suggestion worker (AI-powered taxonomy classification)
  console.log('Starting taxonomy suggestion worker...');
  const taxonomyWorker = startTaxonomySuggestionWorker();

  if (!taxonomyWorker) {
    console.log('⚠️  Taxonomy suggestion worker disabled (Redis not configured)');
  } else {
    console.log('✅ Taxonomy suggestion worker started successfully\n');
  }

  // Start the cleanup worker (90-day retention for run data)
  console.log('Starting cleanup worker...');
  const cleanupWorker = startCleanupWorker();
  console.log('✅ Cleanup worker started successfully');

  // Schedule daily cleanup at 3am UTC
  const cleanupQueue = getCleanupQueue();
  await cleanupQueue.add(
    'daily-cleanup',
    {},
    {
      repeat: {
        pattern: '0 3 * * *'  // 3am UTC daily
      },
      jobId: 'daily-cleanup-repeat'
    }
  );
  console.log('✅ Daily cleanup scheduled (3am UTC)\n');

  // Start the harmony scan worker (field scans for taxonomy wizard)
  console.log('Starting harmony scan worker...');
  const harmonyScanWorker = createHarmonyScanWorker(processHarmonyScan);

  if (!harmonyScanWorker) {
    console.log('⚠️  Harmony scan worker disabled (Redis not configured)');
  } else {
    console.log('✅ Harmony scan worker started successfully\n');
  }

  // FIX: Fail all stalled jobs from previous crashes on startup
  // This prevents old jobs running for hours in the background and causing OOM
  console.log('Checking for stalled arrangement jobs from previous worker crashes...');
  try {
    const { getArrangementQueue } = await import('../lib/queue/arrangement-queue');
    const queue = getArrangementQueue();

    if (queue) {
      const stalledJobs = await queue.getJobs(['active']);

      if (stalledJobs && stalledJobs.length > 0) {
        console.log(`[Startup] Found ${stalledJobs.length} stalled jobs - failing them now`);

        for (const job of stalledJobs) {
          try {
            await job.moveToFailed(new Error('Worker restarted - job was stalled'), true);
            console.log(`[Startup] Failed stalled job ${job.id}`);
          } catch (err) {
            console.warn(`[Startup] Could not fail job ${job.id}:`, err);
          }
        }

        console.log(`[Startup] Cleared ${stalledJobs.length} stalled jobs\n`);
      } else {
        console.log('[Startup] No stalled jobs found\n');
      }
    }
  } catch (error) {
    console.error('[Startup] Error cleaning stalled jobs:', error);
    // Don't fail startup if cleanup fails
  }

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

  // Missed job monitoring - check on startup and every 6 hours
  console.log('✅ Starting missed job monitor...');
  console.log('Checking for missed digest jobs every 6 hours\n');

  await checkMissedJobs(); // Check immediately on startup

  const missedJobsInterval = setInterval(async () => {
    try {
      await checkMissedJobs();
    } catch (error) {
      console.error('Error checking missed jobs:', error);
    }
  }, 6 * 60 * 60 * 1000); // Check every 6 hours

  // Trial expiry email notifier - runs daily at 9am UTC
  console.log('✅ Starting trial expiry email notifier...');
  console.log('Checking for trial warning/expiry emails daily at 9am UTC\n');

  const trialExpiryInterval = setInterval(async () => {
    try {
      const now = new Date();
      const currentHour = now.getUTCHours();
      const currentMinute = now.getUTCMinutes();

      // Run at 9:00 UTC (within 1 minute window)
      if (currentHour === 9 && currentMinute === 0) {
        const { checkAndSendTrialExpiryEmails } = await import('../lib/billing/trial-expiry-notifier');
        const result = await checkAndSendTrialExpiryEmails();

        console.log(
          `[${new Date().toISOString()}] Trial expiry emails: ` +
          `warning=${result.warningEmailsSent} ` +
          `expiry=${result.expiryEmailsSent} ` +
          `errors=${result.errors}`
        );
      }
    } catch (error) {
      console.error('Error in trial expiry email notifier:', error);
    }
  }, 60_000); // Check every minute

  // Rollback expiry + API counter resets - check once per day
  console.log('✅ Starting nightly maintenance tasks...');
  console.log('Expiring old rollback windows and resetting API counters daily\n');

  const nightlyMaintenanceInterval = setInterval(async () => {
    try {
      if (!supabase) return;

      // Expire old rollback windows
      const { error: rollbackError } = await supabase.rpc('expire_rollback_windows');
      if (rollbackError) {
        console.error('Error expiring rollback windows:', rollbackError);
      } else {
        console.log(`[${new Date().toISOString()}] Rollback windows expired successfully`);
      }

      // Reset daily API call counters at midnight UTC
      const startOfTodayUTC = new Date();
      startOfTodayUTC.setUTCHours(0, 0, 0, 0);

      const { error: dailyResetError } = await supabase
        .from('hubspot_connections')
        .update({
          api_calls_today: 0,
          api_calls_reset_at: new Date().toISOString()
        })
        .lt('api_calls_reset_at', startOfTodayUTC.toISOString());

      if (dailyResetError) {
        console.error('Error resetting daily API counters:', dailyResetError);
      } else {
        console.log(`[${new Date().toISOString()}] Daily API counters reset successfully`);
      }

      // Reset monthly counters on the 1st
      if (new Date().getUTCDate() === 1) {
        const { error: monthlyResetError } = await supabase
          .from('hubspot_connections')
          .update({ api_calls_month: 0 })
          .neq('id', null);

        if (monthlyResetError) {
          console.error('Error resetting monthly API counters:', monthlyResetError);
        } else {
          console.log(`[${new Date().toISOString()}] Monthly API counters reset successfully`);
        }
      }

      // Run incremental dedup scans for all active connections
      try {
        const { data: connections, error: connError } = await supabase
          .from('hubspot_connections')
          .select('id, org_id, portal_id')
          .eq('connection_status', 'active');

        if (connError) {
          console.error('Error fetching active connections for dedup scan:', connError);
        } else if (connections && connections.length > 0) {
          console.log(`[${new Date().toISOString()}] Running dedup scans for ${connections.length} active connections`);

          for (const connection of connections) {
            try {
              const result = await enqueueCompanyDedupScan(
                connection.org_id,
                connection.id,
                'system:nightly-maintenance',
                false // auto-detect scan type (incremental on weekdays, full on Sundays)
              );

              if (result.queued) {
                console.log(`[${new Date().toISOString()}] Dedup scan enqueued for portal ${connection.portal_id}: jobId=${result.jobId}`);
              } else {
                console.warn(`[Nightly Dedup] Failed to enqueue scan for portal ${connection.portal_id}: ${result.reason}`);
              }
            } catch (scanError) {
              console.error(`[Nightly Dedup] Error scanning portal ${connection.portal_id}:`, scanError);
              // Continue with other connections
            }
          }
        }
      } catch (error) {
        console.error('Error running nightly dedup scans:', error);
      }

    } catch (error) {
      console.error('Error in nightly maintenance tasks:', error);
    }
  }, 24 * 60 * 60 * 1000); // Check every 24 hours

  console.log('Worker is running. Press Ctrl+C to stop.\n');

  // Graceful shutdown - wait for active jobs before exit
  const shutdown = async (signal: string) => {
    console.log(`\n[Shutdown] ${signal} received at ${new Date().toISOString()}`);
    console.log('[Shutdown] Stopping cron intervals...');
    clearInterval(cronInterval);
    clearInterval(missedJobsInterval);
    clearInterval(trialExpiryInterval);
    clearInterval(nightlyMaintenanceInterval);

    // Check for active arrangement jobs
    const { getArrangementQueue } = await import('../lib/queue/arrangement-queue');
    const queue = getArrangementQueue();

    if (queue) {
      let activeJobs = await queue.getJobs(['active']);
      let waitTime = 0;
      const MAX_WAIT = 30000; // 30 seconds max wait

      if (activeJobs.length > 0) {
        console.log(`[Shutdown] Found ${activeJobs.length} active jobs, waiting for completion...`);

        // Wait for active jobs to complete (with timeout)
        while (activeJobs.length > 0 && waitTime < MAX_WAIT) {
          console.log(`[Shutdown] Waiting for ${activeJobs.length} active jobs... (${waitTime/1000}s elapsed)`);
          await new Promise(r => setTimeout(r, 1000));
          waitTime += 1000;
          activeJobs = await queue.getJobs(['active']);
        }

        // If jobs still running after timeout, mark them as failed
        if (activeJobs.length > 0) {
          console.log(`[Shutdown] Force stopping after ${MAX_WAIT/1000}s timeout`);
          console.log(`[Shutdown] Abandoning ${activeJobs.length} active jobs`);

          for (const job of activeJobs) {
            try {
              console.log(`[Shutdown] Marking job ${job.id} as failed due to shutdown`);
              await supabase
                ?.from('arrangement_runs')
                .update({
                  status: 'failed',
                  error_message: 'Worker shutdown during processing',
                  completed_at: new Date().toISOString(),
                })
                .eq('id', job.data.runId);
            } catch (err) {
              console.error(`[Shutdown] Failed to mark job ${job.id} as failed:`, err);
            }
          }
        } else {
          console.log('[Shutdown] All active jobs completed successfully');
        }
      } else {
        console.log('[Shutdown] No active jobs found');
      }
    }

    console.log('[Shutdown] Closing workers...');
    await stopDigestWorker();
    await stopCompanyDedupScanWorker();
    await stopArrangementWorker();
    await stopPreviewWorker();
    await stopTaxonomySuggestionWorker();
    await cleanupWorker.close();
    if (harmonyScanWorker) {
      await harmonyScanWorker.close();
    }

    console.log('[Shutdown] All workers stopped');
    console.log('[Shutdown] Closing health check server...');
    healthServer.close();

    console.log('[Shutdown] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

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
