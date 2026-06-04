/**
 * Harmony Scan Job Processor
 *
 * Processes harmony field scan jobs.
 * Extracted from start-harmony-scan-worker.ts for reuse in multi-worker setup.
 */

import { Job } from 'bullmq';
import { HarmonyScanJobData } from './harmony-scan-queue';
import { supabaseAdmin } from '../db/admin-client';
import { scanHubSpotField } from '../hubspot/harmony-field-scanner';
import { HubSpotClient } from '../hubspot/client';

export async function processHarmonyScan(job: Job<HarmonyScanJobData>): Promise<void> {
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
