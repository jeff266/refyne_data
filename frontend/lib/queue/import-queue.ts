/**
 * Import Queue
 *
 * BullMQ queue for processing event list import jobs.
 * Handles HubSpot contact creation, updates, and list membership.
 */

import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection, isRedisConfigured } from './redis';
import { supabaseAdmin } from '../db/admin-client';
import { getAccessToken } from '../hubspot/get-access-token';
import { HubSpotClient } from '../hubspot/client';

// ─────────────────────────────────────────────────────────────
// Queue Configuration
// ─────────────────────────────────────────────────────────────

const QUEUE_NAME = 'event-list-import';

/**
 * Worker concurrency - how many import jobs to process in parallel.
 * Lower concurrency due to HubSpot rate limits.
 */
const WORKER_CONCURRENCY = 2;

/**
 * Batch size for HubSpot API calls.
 */
const HUBSPOT_BATCH_SIZE = 100;

/**
 * Retry settings with exponential backoff.
 */
const RETRY_SETTINGS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000, // 2s, 4s, 8s
  },
};

// ─────────────────────────────────────────────────────────────
// Job Types
// ─────────────────────────────────────────────────────────────

export interface ImportJobData {
  importId: string;
  orgId: string;
  writeConfig: {
    update_customers: boolean;
    create_new_contacts: boolean;
    update_known_contacts: boolean;
    skip_needs_review: boolean;
  };
  hubspotList?: {
    enabled: boolean;
    list_name: string;
    buckets: string[];
  };
  ownerAssignment: Record<string, string> | null; // companyKey -> ownerId
}

export interface ImportJobResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  listId: string | null;
}

// ─────────────────────────────────────────────────────────────
// Queue Instance
// ─────────────────────────────────────────────────────────────

let importQueueInstance: Queue | null = null;
let importWorkerInstance: Worker | null = null;

/**
 * Get or create the import queue.
 */
export function getImportQueue(): Queue | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - import queue disabled');
    return null;
  }

  if (!importQueueInstance) {
    const connection = createRedisConnection();
    importQueueInstance = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: RETRY_SETTINGS.attempts,
        backoff: RETRY_SETTINGS.backoff,
        removeOnComplete: {
          count: 100,
          age: 30 * 24 * 60 * 60, // 30 days
        },
        removeOnFail: {
          count: 50,
          age: 90 * 24 * 60 * 60, // 90 days
        },
      },
    });
  }

  return importQueueInstance;
}

/**
 * Export for use in API routes.
 */
export const importQueue = getImportQueue()!;

/**
 * Start the import worker (call from Railway worker dyno).
 */
export function startImportWorker(): Worker | null {
  if (!isRedisConfigured()) {
    console.error('Cannot start import worker - Redis not configured');
    return null;
  }

  if (importWorkerInstance) {
    console.log('Import worker already running');
    return importWorkerInstance;
  }

  const connection = createRedisConnection();

  importWorkerInstance = new Worker(
    QUEUE_NAME,
    async (job: Job<ImportJobData>) => {
      console.log(`[Import Worker] Processing job ${job.id} for import ${job.data.importId}`);
      return await processImportJob(job);
    },
    {
      connection,
      concurrency: WORKER_CONCURRENCY,
    }
  );

  importWorkerInstance.on('completed', (job) => {
    console.log(`[Import Worker] Job ${job.id} completed`);
  });

  importWorkerInstance.on('failed', (job, err) => {
    console.error(`[Import Worker] Job ${job?.id} failed:`, err);
  });

  console.log(`[Import Worker] Started with concurrency ${WORKER_CONCURRENCY}`);

  return importWorkerInstance;
}

/**
 * Stop the import worker.
 */
export async function stopImportWorker(): Promise<void> {
  if (importWorkerInstance) {
    await importWorkerInstance.close();
    importWorkerInstance = null;
    console.log('[Import Worker] Stopped');
  }
}

// ─────────────────────────────────────────────────────────────
// Job Processor
// ─────────────────────────────────────────────────────────────

async function processImportJob(job: Job<ImportJobData>): Promise<ImportJobResult> {
  const { importId, orgId, writeConfig, hubspotList, ownerAssignment } = job.data;

  if (!supabaseAdmin) {
    throw new Error('Database not configured');
  }

  // Update import status
  await supabaseAdmin
    .from('event_imports')
    .update({ status: 'running' })
    .eq('id', importId);

  try {
    // Get HubSpot access token
    const accessToken = await getAccessToken(orgId);
    if (!accessToken) {
      throw new Error('HubSpot not connected');
    }

    // Get portal info
    const { data: connection } = await supabaseAdmin
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', orgId)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      throw new Error('HubSpot connection not found');
    }

    const hubspot = new HubSpotClient(accessToken, connection.portal_id);

    // Load import rows
    const { data: rows, error: rowsError } = await supabaseAdmin
      .from('event_import_rows')
      .select('*')
      .eq('import_id', importId)
      .order('row_index');

    if (rowsError || !rows) {
      throw new Error('Failed to load import rows');
    }

    console.log(`[Import Job] Processing ${rows.length} rows`);

    // Create HubSpot list if enabled
    let listId: string | null = null;
    if (hubspotList?.enabled) {
      console.log(`[Import Job] Creating HubSpot list: ${hubspotList.list_name}`);

      const listResponse = await hubspot.request<{ id: string }>(
        '/crm/v3/lists',
        {
          method: 'POST',
          body: JSON.stringify({
            name: hubspotList.list_name,
            objectTypeId: '0-1', // Contacts
            processingType: 'MANUAL',
          }),
        }
      );

      listId = listResponse.id;
      console.log(`[Import Job] Created HubSpot list ${listId}`);

      // Update import session with list ID
      await supabaseAdmin
        .from('event_imports')
        .update({ hubspot_list_id: listId })
        .eq('id', importId);
    }

    // Process rows by bucket
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const contactsToCreate: any[] = [];
    const contactsToUpdate: any[] = [];
    const contactsForList: string[] = [];
    const newContactBuckets: string[] = []; // Track buckets for new contacts

    for (const row of rows) {
      const rawData = row.raw_data as Record<string, string>;
      const bucket = row.bucket;

      // Skip based on write config
      if (bucket === 'needs_review' && writeConfig.skip_needs_review) {
        skippedCount++;
        continue;
      }

      if (bucket === 'customer' && !writeConfig.update_customers) {
        skippedCount++;
        continue;
      }

      if (bucket === 'known_contact' && !writeConfig.update_known_contacts) {
        skippedCount++;
        continue;
      }

      if (bucket === 'new_contact' && !writeConfig.create_new_contacts) {
        skippedCount++;
        continue;
      }

      // Build contact properties
      const properties: Record<string, string> = {};

      if (rawData.email) properties.email = rawData.email;
      if (row.cleaned_first_name) properties.firstname = row.cleaned_first_name;
      if (row.cleaned_last_name) properties.lastname = row.cleaned_last_name;
      if (rawData.job_title) properties.jobtitle = rawData.job_title;
      if (rawData.company) properties.company = rawData.company;
      if (rawData.linkedin_url) properties.linkedin_url = rawData.linkedin_url;
      if (rawData.location) properties.city = rawData.location;

      // Add owner if assigned
      if (row.owner_id) {
        properties.hubspot_owner_id = row.owner_id;
      }

      // Create or update
      if (row.hubspot_contact_id) {
        // UPDATE existing contact
        contactsToUpdate.push({
          id: row.hubspot_contact_id,
          properties,
        });

        // Track for list addition
        if (listId && hubspotList && hubspotList.buckets.includes(bucket)) {
          contactsForList.push(row.hubspot_contact_id);
        }
      } else {
        // CREATE new contact
        contactsToCreate.push({ properties });
        newContactBuckets.push(bucket); // Track bucket for this new contact
      }
    }

    // Batch create contacts
    if (contactsToCreate.length > 0) {
      console.log(`[Import Job] Creating ${contactsToCreate.length} contacts`);

      for (let i = 0; i < contactsToCreate.length; i += HUBSPOT_BATCH_SIZE) {
        const batch = contactsToCreate.slice(i, i + HUBSPOT_BATCH_SIZE);
        const batchBuckets = newContactBuckets.slice(i, i + HUBSPOT_BATCH_SIZE);

        const createResponse = await hubspot.request<{ results: Array<{ id: string }> }>(
          '/crm/v3/objects/contacts/batch/create',
          {
            method: 'POST',
            body: JSON.stringify({ inputs: batch }),
          }
        );

        createdCount += createResponse.results.length;

        // Track for list addition (only if bucket is in allowed buckets)
        if (listId && hubspotList) {
          createResponse.results.forEach((result, idx) => {
            const bucket = batchBuckets[idx];
            if (hubspotList.buckets.includes(bucket)) {
              contactsForList.push(result.id);
            }
          });
        }

        console.log(`[Import Job] Created batch ${i / HUBSPOT_BATCH_SIZE + 1}: ${createResponse.results.length} contacts`);
      }
    }

    // Batch update contacts
    if (contactsToUpdate.length > 0) {
      console.log(`[Import Job] Updating ${contactsToUpdate.length} contacts`);

      for (let i = 0; i < contactsToUpdate.length; i += HUBSPOT_BATCH_SIZE) {
        const batch = contactsToUpdate.slice(i, i + HUBSPOT_BATCH_SIZE);

        await hubspot.request(
          '/crm/v3/objects/contacts/batch/update',
          {
            method: 'POST',
            body: JSON.stringify({ inputs: batch }),
          }
        );

        updatedCount += batch.length;

        console.log(`[Import Job] Updated batch ${i / HUBSPOT_BATCH_SIZE + 1}: ${batch.length} contacts`);
      }
    }

    // Add contacts to list
    if (listId && contactsForList.length > 0) {
      console.log(`[Import] Adding ${contactsForList.length} contacts to list ${listId}`);

      try {
        for (let i = 0; i < contactsForList.length; i += HUBSPOT_BATCH_SIZE) {
          const batch = contactsForList.slice(i, i + HUBSPOT_BATCH_SIZE);

          await hubspot.request(
            `/crm/v3/lists/${listId}/memberships/add`,
            {
              method: 'POST',
              body: JSON.stringify({
                recordIdsToAdd: batch,
              }),
            }
          );

          console.log(`[Import] List membership batch ${i / HUBSPOT_BATCH_SIZE + 1}: ${batch.length} contacts added`);
        }

        console.log(`[Import] List membership complete: ${contactsForList.length} contacts added to list ${listId}`);
      } catch (error) {
        console.error(`[Import] Failed to add contacts to list ${listId}:`, error);
        // Don't throw - we still want the import to be marked as successful
        // since the contacts were created/updated. Just log the list error.
      }
    }

    // Mark import as completed
    await supabaseAdmin
      .from('event_imports')
      .update({
        status: 'completed',
        created_count: createdCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', importId);

    console.log(`[Import Job] Completed: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped`);

    return {
      success: true,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      listId,
    };
  } catch (error) {
    // Mark import as failed
    await supabaseAdmin
      .from('event_imports')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString(),
      })
      .eq('id', importId);

    throw error;
  }
}
