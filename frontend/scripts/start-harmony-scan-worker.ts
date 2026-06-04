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

import { Job } from 'bullmq';
import { createHarmonyScanWorker, HarmonyScanJobData } from '../lib/queue/harmony-scan-queue';
import { supabaseAdmin } from '../lib/db/admin-client';
import { scanHubSpotField } from '../lib/hubspot/harmony-field-scanner';
import { HubSpotClient } from '../lib/hubspot/client';

async function processHarmonyScan(job: Job<HarmonyScanJobData>): Promise<void> {
  const { jobId, orgId, portalId, accessToken, objectType, fieldName, harmonyId, hasExportScope } = job.data;

  console.log(`[HarmonyScanWorker] Processing scan for harmony ${harmonyId}, job ${jobId}`);

  try {
    // Update job status to scanning
    await supabaseAdmin
      .from('harmony_scan_jobs')
      .update({
        status: 'scanning',
        started_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // Create HubSpot client
    const client = new HubSpotClient(accessToken, portalId);

    // Perform scan with progress updates
    const distinctValues = await scanHubSpotField({
      client,
      objectType: objectType === 'companies' ? 'company' : 'contact',
      fieldName,
      hasExportScope,
      onProgress: async (progress, totalRecords) => {
        console.log(`[HarmonyScanWorker] Progress: ${progress}% (${totalRecords} records)`);

        await supabaseAdmin
          .from('harmony_scan_jobs')
          .update({
            progress,
            total_records: totalRecords,
          })
          .eq('id', jobId);

        // Update BullMQ job progress
        await job.updateProgress(progress);
      },
    });

    console.log(`[HarmonyScanWorker] Scan complete: ${distinctValues.length} distinct values found`);

    // Update job with results
    await supabaseAdmin
      .from('harmony_scan_jobs')
      .update({
        status: 'completed',
        progress: 100,
        distinct_values: distinctValues,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  } catch (error: any) {
    console.error('[HarmonyScanWorker] Scan failed:', error);

    // Update job with error
    await supabaseAdmin
      .from('harmony_scan_jobs')
      .update({
        status: 'failed',
        error_message: error?.message || 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    throw error; // Re-throw to mark BullMQ job as failed
  }
}

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
    await worker.close();
    console.log('Worker closed');
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

main();
