/**
 * Job Segmentation Worker
 *
 * BullMQ worker that processes contact batches and updates HubSpot with
 * AI-classified job level and function data.
 *
 * Features:
 * - Fetches contacts with jobtitle property set
 * - Classifies job titles in batches using Claude Haiku
 * - Updates HubSpot contacts with refyne_job_level and refyne_job_function
 * - Respects dryRun flag (never writes to HubSpot if true)
 * - Tracks progress in job_segmentation_runs table
 */

import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { HubSpotClient } from '../hubspot/client';
import { classifyJobTitleBatch } from '../harmonies/job-title-classifier';
import { ensureJobSegmentationProperties } from '../hubspot/job-segmentation-properties';
import { supabaseAdmin } from '../db/admin-client';

const REDIS_URL = process.env.UPSTASH_REDIS_URL;

if (!REDIS_URL) {
  throw new Error('UPSTASH_REDIS_URL environment variable is required');
}

// Parse Redis URL for ioredis options
const redisUrl = new URL(REDIS_URL);
const redisOptions = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || '6379'),
  username: redisUrl.username || 'default',
  password: redisUrl.password,
  tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
};

export const jobSegmentationQueue = new Queue('job-segmentation', {
  connection: redisOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

interface JobSegmentationJobData {
  runId: string;
  orgId: string;
  portalId: string;
  accessToken: string;
  dryRun: boolean;
  batchSize: number;
}

interface ContactBatch {
  id: string;
  properties: {
    jobtitle?: string;
  };
}

/**
 * Main worker function - processes a single job segmentation run
 */
export async function processJobSegmentation(data: JobSegmentationJobData) {
  const { runId, orgId, portalId, accessToken, dryRun, batchSize } = data;

  console.log(`[JobSegmentation] Starting run ${runId} (dryRun: ${dryRun})`);

  const hubspot = new HubSpotClient(accessToken, portalId);

  // Step 1: Fetch run record to get field mapping configuration
  const { data: run } = await supabaseAdmin
    .from('job_segmentation_runs')
    .select('level_field, function_field')
    .eq('id', runId)
    .single();

  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  const levelField = run.level_field || 'refyne_job_level';
  const functionField = run.function_field || 'refyne_job_function';

  console.log(`[JobSegmentation] Output fields: ${levelField}, ${functionField}`);

  // Step 2: Ensure HubSpot properties exist (only if not dryRun and using default fields)
  if (!dryRun && levelField === 'refyne_job_level' && functionField === 'refyne_job_function') {
    await ensureJobSegmentationProperties(hubspot);
    console.log(`[JobSegmentation] Properties ensured in HubSpot`);
  }

  // Step 3: Update run status to 'running'
  await supabaseAdmin
    .from('job_segmentation_runs')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .eq('id', runId);

  let processedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    // Step 3: Fetch all contacts with jobtitle set (limit to 100 for dry run testing)
    const allContacts: ContactBatch[] = [];
    let after: string | undefined;
    let hasMore = true;
    const FETCH_LIMIT = dryRun ? 100 : 100000; // Limit fetches in dry run mode

    while (hasMore && allContacts.length < FETCH_LIMIT) {
      const response = await hubspot.request<{
        results: ContactBatch[];
        paging?: { next?: { after: string } };
      }>('/crm/v3/objects/contacts/search', {
        method: 'POST',
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'jobtitle',
                  operator: 'HAS_PROPERTY',
                },
              ],
            },
          ],
          properties: ['jobtitle'],
          limit: 100,
          after,
        }),
      });

      allContacts.push(...response.results);
      after = response.paging?.next?.after;
      hasMore = !!after;

      console.log(`[JobSegmentation] Fetched ${allContacts.length} contacts so far...`);
    }

    console.log(`[JobSegmentation] Total contacts to process: ${allContacts.length}`);

    // Step 4: Process in batches
    const BATCH_SIZE = batchSize || 100;
    const CONCURRENCY = 10;

    for (let i = 0; i < allContacts.length; i += BATCH_SIZE) {
      const batch = allContacts.slice(i, i + BATCH_SIZE);
      const jobTitles = batch.map((c) => c.properties.jobtitle || '');

      // Classify batch
      const classifications = await classifyJobTitleBatch(jobTitles);

      // Prepare updates
      const updates: Array<{
        id: string;
        properties: Record<string, string>;
      }> = [];

      for (let j = 0; j < batch.length; j++) {
        const contact = batch[j];
        const title = jobTitles[j];
        const classification = classifications.get(title);

        if (!classification) {
          skippedCount++;
          continue;
        }

        updates.push({
          id: contact.id,
          properties: {
            [levelField]: classification.level,
            [functionField]: classification.function,
          },
        });
      }

      // Write to HubSpot (only if not dryRun)
      if (!dryRun && updates.length > 0) {
        // Split updates into chunks of 10 for concurrency
        for (let k = 0; k < updates.length; k += CONCURRENCY) {
          const chunk = updates.slice(k, k + CONCURRENCY);

          await Promise.all(
            chunk.map(async (update) => {
              try {
                await hubspot.request(`/crm/v3/objects/contacts/${update.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ properties: update.properties }),
                });
                updatedCount++;
              } catch (error) {
                console.error(`[JobSegmentation] Failed to update contact ${update.id}:`, error);
                errorCount++;
              }
            })
          );
        }
      } else if (dryRun) {
        // In dry run, just count as "would update"
        updatedCount += updates.length;
      }

      processedCount += batch.length;

      // Update progress every batch
      await supabaseAdmin
        .from('job_segmentation_runs')
        .update({
          processed_count: processedCount,
          updated_count: updatedCount,
          skipped_count: skippedCount,
          error_count: errorCount,
        })
        .eq('id', runId);

      console.log(
        `[JobSegmentation] Progress: ${processedCount}/${allContacts.length} (updated: ${updatedCount}, skipped: ${skippedCount}, errors: ${errorCount})`
      );
    }

    // Step 5: Mark run as completed
    await supabaseAdmin
      .from('job_segmentation_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        processed_count: processedCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        error_count: errorCount,
      })
      .eq('id', runId);

    console.log(
      `[JobSegmentation] Run ${runId} completed: ${processedCount} processed, ${updatedCount} updated, ${skippedCount} skipped, ${errorCount} errors`
    );
  } catch (error) {
    console.error(`[JobSegmentation] Run ${runId} failed:`, error);

    // Mark run as failed
    await supabaseAdmin
      .from('job_segmentation_runs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
        processed_count: processedCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        error_count: errorCount,
      })
      .eq('id', runId);

    throw error;
  }
}

/**
 * BullMQ Worker - processes jobs from the queue
 */
export const jobSegmentationWorker = new Worker<JobSegmentationJobData>(
  'job-segmentation',
  async (job) => {
    await processJobSegmentation(job.data);
  },
  {
    connection: redisOptions,
    concurrency: 1, // Process one run at a time
  }
);

jobSegmentationWorker.on('completed', (job) => {
  console.log(`[JobSegmentation] Job ${job.id} completed`);
});

jobSegmentationWorker.on('failed', (job, err) => {
  console.error(`[JobSegmentation] Job ${job?.id} failed:`, err);
});
