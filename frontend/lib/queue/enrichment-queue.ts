/**
 * Enrichment Queue
 *
 * BullMQ queue for processing ad-hoc enrichment jobs (preview → apply flow).
 * Simpler than arrangement queue - processes one-off enrichment requests.
 */

import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection, isRedisConfigured } from './redis';
import { startStalledJobMonitoring, stopStalledJobMonitoring } from './stalled-job-detector';
import { withHubSpotRateLimit } from '../hubspot/shared-portal-rate-limiter';
import { supabase } from '../db/supabase';
import { getAccessToken } from '../hubspot/get-access-token';
import { HubSpotClient } from '../hubspot/client';
import { refyneSearch, type RefyneSearchResult } from '../providers/refyne-search';
import { ApolloAdapter } from '../providers/apollo';
import { GraphiqAdapter } from '../providers/graphiq';
import { getApolloKey } from '../providers/apollo-key';
import { getGraphiqKey } from '../providers/graphiq-key';
import {
  processPreviewJob,
  processApplyJob,
  type PreviewJobData,
  type PreviewJobProgress,
  type ApplyJobData,
} from './enrich-page-worker';
import type { ConditionGroups } from '../harmonies/condition-evaluator';
import { conditionGroupsToHubSpotFilters, applyClientSideConditions } from '../hubspot/condition-groups-to-filters';

// ─────────────────────────────────────────────────────────────
// Queue Configuration
// ─────────────────────────────────────────────────────────────

const QUEUE_NAME = 'enrichment';

/**
 * Worker concurrency - how many enrichment jobs to process in parallel.
 */
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? '5', 10);

/**
 * Batch size for HubSpot updates.
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

export interface EnrichmentJobData {
  runId: string;
  orgId: string;
  userId: string;
  fields: string[];
  providers: string[];
  write_policy: 'fill_empty' | 'overwrite';
  enrichmentMode?: 'fast' | 'thorough';
  source: {
    type: 'all' | 'list' | 'segment' | 'csv';
    list_id?: string;
    filters?: {
      missing_fields?: string[];
      lifecyclestage?: string;
      hubspot_owner_id?: string;
      industry?: string[];
    };
    conditionGroups?: ConditionGroups; // New: full ConditionBuilder conditions
    domains?: string[];
  };
  record_limit: number;
}

export interface EnrichmentJobResult {
  success: boolean;
  recordsProcessed: number;
  fieldsEnriched: number;
  fieldsSkipped: number;
  costUsd: number;
}

// ─────────────────────────────────────────────────────────────
// Queue Instance
// ─────────────────────────────────────────────────────────────

let enrichmentQueue: Queue | null = null;
let enrichmentWorker: Worker | null = null;
let enrichmentMonitoringInterval: NodeJS.Timeout | null = null;

/**
 * Get or create the enrichment queue.
 */
export function getEnrichmentQueue(): Queue | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - enrichment queue disabled');
    return null;
  }

  if (!enrichmentQueue) {
    const connection = createRedisConnection();
    enrichmentQueue = new Queue(QUEUE_NAME, {
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

  return enrichmentQueue;
}

/**
 * Enqueue an enrichment job with priority based on subscription tier.
 */
export async function enqueueEnrichmentJob(
  data: EnrichmentJobData
): Promise<{ queued: boolean; jobId?: string; reason?: string }> {
  const queue = getEnrichmentQueue();
  if (!queue) {
    return { queued: false, reason: 'Queue not configured' };
  }

  // Get job priority based on org's subscription tier
  const { getJobPriority } = await import('@/lib/billing/job-priority');
  const priority = await getJobPriority(data.orgId);

  const job = await queue.add('enrich', data, { priority });
  return { queued: true, jobId: job.id };
}

/**
 * Start the enrichment worker (call from Railway worker dyno).
 */
export function startEnrichmentWorker(): Worker | null {
  if (!isRedisConfigured()) {
    console.error('Cannot start enrichment worker - Redis not configured');
    return null;
  }

  if (enrichmentWorker) {
    console.log('Enrichment worker already running');
    return enrichmentWorker;
  }

  const connection = createRedisConnection();

  enrichmentWorker = new Worker(
    QUEUE_NAME,
    async (job: Job<EnrichmentJobData>) => {
      console.log(`[Enrichment Worker] Processing job ${job.id} for run ${job.data.runId}`);
      return await processEnrichmentJob(job);
    },
    {
      connection,
      concurrency: WORKER_CONCURRENCY,
    }
  );

  enrichmentWorker.on('completed', (job) => {
    console.log(`[Enrichment Worker] Job ${job.id} completed`);
  });

  enrichmentWorker.on('failed', (job, err) => {
    console.error(`[Enrichment Worker] Job ${job?.id} failed:`, err);
  });

  console.log(`[Enrichment Worker] Started with concurrency ${WORKER_CONCURRENCY}`);

  // Start stalled job monitoring
  enrichmentMonitoringInterval = startStalledJobMonitoring(enrichmentWorker, 'Enrichment Worker');

  return enrichmentWorker;
}

/**
 * Stop the enrichment worker.
 */
export async function stopEnrichmentWorker(): Promise<void> {
  if (enrichmentMonitoringInterval) {
    stopStalledJobMonitoring(enrichmentMonitoringInterval, 'Enrichment Worker');
    enrichmentMonitoringInterval = null;
  }

  if (enrichmentWorker) {
    await enrichmentWorker.close();
    enrichmentWorker = null;
    console.log('[Enrichment Worker] Stopped');
  }
}

// ─────────────────────────────────────────────────────────────
// Job Processor
// ─────────────────────────────────────────────────────────────

async function processEnrichmentJob(
  job: Job<EnrichmentJobData>
): Promise<EnrichmentJobResult> {
  const { runId, orgId, fields, providers, write_policy, source, record_limit, enrichmentMode } = job.data;

  if (!supabase) {
    throw new Error('Database not configured');
  }

  // Update run status to running
  await supabase
    .from('enrichment_runs')
    .update({ status: 'running' })
    .eq('id', runId);

  try {
    // Get HubSpot access token
    const accessToken = await getAccessToken(orgId);

    // Get portal info
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', orgId)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      throw new Error('HubSpot not connected');
    }

    const hubspot = new HubSpotClient(accessToken, connection.portal_id);

    // Fetch companies based on source config
    const companies = await fetchCompanies(hubspot, connection.portal_id, source, fields, record_limit);

    console.log(`[Enrichment Job] Fetched ${companies.length} companies to enrich`);

    // Initialize providers
    let apollo: ApolloAdapter | null = null;
    let graphiq: GraphiqAdapter | null = null;
    const useRefyneSearch = providers.includes('refyne_search') || providers.includes('refyne');

    if (providers.includes('apollo')) {
      const apolloKey = await getApolloKey(orgId);
      if (apolloKey) {
        apollo = new ApolloAdapter(apolloKey);
      }
    }

    if (providers.includes('graphiq')) {
      const graphiqKey = await getGraphiqKey(orgId);
      if (graphiqKey) {
        graphiq = new GraphiqAdapter(graphiqKey);
      }
    }

    // Process companies in batches
    let processedCount = 0;
    let fieldsEnriched = 0;
    let fieldsSkipped = 0;
    let totalCostUsd = 0;
    let totalSerperCalls = 0;
    let totalDeepseekTokensIn = 0;
    let totalDeepseekTokensOut = 0;

    const updates: Array<{ id: string; properties: Record<string, any> }> = [];

    for (const company of companies) {
      const companyDomain = company.properties.domain || '';
      const companyName = company.properties.name || companyDomain || company.id;

      // Enrich via providers
      let providerData: any = null;

      // Try Apollo first if selected
      if (apollo && companyDomain) {
        try {
          providerData = await apollo.enrichCompany({ domain: companyDomain });
        } catch (err) {
          console.warn(`[Enrichment] Apollo failed for ${companyDomain}:`, err);
        }
      }

      // Try GraphIQ if Apollo didn't return data
      if (!providerData && graphiq) {
        try {
          providerData = await graphiq.enrichCompany({
            domain: companyDomain || undefined,
            name: company.properties.name || undefined,
          });
        } catch (err) {
          console.warn(`[Enrichment] GraphIQ failed:`, err);
        }
      }

      // Try Refyne Search if no other provider returned data
      let refyneResults: Record<string, RefyneSearchResult> = {};
      if (!providerData && useRefyneSearch) {
        try {
          const results = await refyneSearch(
            orgId,
            companyDomain || null,
            company.properties.name || null,
            fields,
            'background',
            enrichmentMode ?? 'fast'
          );

          // Convert array to keyed object
          for (const r of results) {
            refyneResults[r.fieldKey] = r;
          }

          // Track Refyne Search usage from first result (all fields share same search)
          if (results.length > 0 && results[0].fromCache === false) {
            // Estimate costs based on typical usage
            totalSerperCalls += 3; // Typical 3 queries per company
            totalDeepseekTokensIn += 1500; // Rough estimate
            totalDeepseekTokensOut += 400; // Rough estimate
            totalCostUsd += 0.003; // $0.003 per company (Serper cost)
          }
        } catch (err) {
          console.warn(`[Enrichment] Refyne Search failed:`, err);
        }
      }

      // Build update payload
      const updateProperties: Record<string, any> = {};

      for (const fieldKey of fields) {
        const currentValue = company.properties[fieldKey] || null;
        let foundValue: string | null = null;

        // Extract value from provider data
        if (providerData) {
          foundValue = getFieldValueFromProvider(providerData.normalized, fieldKey);
        } else if (refyneResults[fieldKey]) {
          foundValue = refyneResults[fieldKey].value ? String(refyneResults[fieldKey].value) : null;
        }

        // Apply write policy
        if (!foundValue) {
          fieldsSkipped++;
          continue;
        }

        if (!currentValue || currentValue.trim() === '') {
          // Fill empty
          updateProperties[fieldKey] = foundValue;
          fieldsEnriched++;
        } else if (write_policy === 'overwrite' && currentValue !== foundValue) {
          // Overwrite
          updateProperties[fieldKey] = foundValue;
          fieldsEnriched++;
        } else {
          // Already set and not overwriting
          fieldsSkipped++;
        }
      }

      // Queue update if we have fields to write
      if (Object.keys(updateProperties).length > 0) {
        updates.push({
          id: company.id,
          properties: updateProperties,
        });
      }

      processedCount++;

      // Update progress every 10 records
      if (processedCount % 10 === 0) {
        await supabase
          .from('enrichment_runs')
          .update({
            processed_records: processedCount,
            fields_enriched: fieldsEnriched,
            fields_skipped: fieldsSkipped,
            serper_calls: totalSerperCalls,
            deepseek_tokens_in: totalDeepseekTokensIn,
            deepseek_tokens_out: totalDeepseekTokensOut,
            cost_usd: totalCostUsd,
          })
          .eq('id', runId);

        console.log(`[Enrichment Job] Progress: ${processedCount}/${companies.length} records, ${fieldsEnriched} fields enriched`);
      }

      // Batch write to HubSpot every 100 updates
      if (updates.length >= HUBSPOT_BATCH_SIZE) {
        await hubspot.batchUpdateCompanies(updates);
        console.log(`[Enrichment Job] Wrote batch of ${updates.length} updates to HubSpot`);
        updates.length = 0; // Clear batch
      }
    }

    // Write remaining updates
    if (updates.length > 0) {
      await hubspot.batchUpdateCompanies(updates);
      console.log(`[Enrichment Job] Wrote final batch of ${updates.length} updates to HubSpot`);
    }

    // Mark run as completed
    await supabase
      .from('enrichment_runs')
      .update({
        status: 'completed',
        processed_records: processedCount,
        successful_records: processedCount,
        fields_enriched: fieldsEnriched,
        fields_skipped: fieldsSkipped,
        serper_calls: totalSerperCalls,
        deepseek_tokens_in: totalDeepseekTokensIn,
        deepseek_tokens_out: totalDeepseekTokensOut,
        cost_usd: totalCostUsd,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    console.log(`[Enrichment Job] Completed: ${processedCount} records, ${fieldsEnriched} fields enriched`);

    return {
      success: true,
      recordsProcessed: processedCount,
      fieldsEnriched,
      fieldsSkipped,
      costUsd: totalCostUsd,
    };
  } catch (error) {
    // Mark run as failed
    await supabase
      .from('enrichment_runs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    throw error;
  }
}

/**
 * Fetch companies based on source config.
 */
async function fetchCompanies(
  hubspot: HubSpotClient,
  portalId: string,
  source: EnrichmentJobData['source'],
  fields: string[],
  limit: number
): Promise<any[]> {
  const properties = ['name', 'domain', ...fields];
  const companies: any[] = [];

  if (source.type === 'list' && source.list_id) {
    // Fetch from HubSpot list
    for await (const batch of hubspot.getListMembers(source.list_id, properties)) {
      companies.push(...batch);
      if (companies.length >= limit) break;
    }
  } else if (source.type === 'segment') {
    // Use HubSpot Search API with filters
    let filterGroups: any[];

    if (source.conditionGroups) {
      // New path: full ConditionBuilder conditions
      filterGroups = conditionGroupsToHubSpotFilters(source.conditionGroups);
    } else if (source.filters) {
      // Legacy path: old hardcoded filters (lifecycle, owner, industry)
      filterGroups = buildSearchFilters(source.filters);
    } else {
      filterGroups = [];
    }

    const searchRequest = {
      filterGroups,
      properties,
      limit: limit,
      sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
    };

    const response = await withHubSpotRateLimit(
      portalId,
      () => hubspot.request<{
        results: Array<{
          id: string;
          properties: Record<string, string | null>;
        }>;
      }>(
        '/crm/v3/objects/companies/search',
        {
          method: 'POST',
          body: JSON.stringify(searchRequest),
        },
        true
      )
    );

    let results = response.results.map((r) => ({
      id: r.id,
      properties: r.properties,
    }));

    // Apply client-side conditions for operators HubSpot can't handle
    if (source.conditionGroups) {
      results = applyClientSideConditions(results, source.conditionGroups);
    }

    companies.push(...results);
  } else if (source.type === 'csv' && source.domains) {
    // Fetch companies by domain lookup
    for (const domain of source.domains.slice(0, limit)) {
      const matches = await hubspot.searchCompaniesByDomain(domain, properties);
      if (matches.length > 0) {
        companies.push(matches[0]);
      }
      if (companies.length >= limit) break;
    }
  } else {
    // All companies with missing fields
    const filterGroups = buildSearchFilters({
      missing_fields: fields,
    });

    const searchRequest = {
      filterGroups,
      properties,
      limit: limit,
      sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
    };

    const response = await withHubSpotRateLimit(
      portalId,
      () => hubspot.request<{
        results: Array<{
          id: string;
          properties: Record<string, string | null>;
        }>;
      }>(
        '/crm/v3/objects/companies/search',
        {
          method: 'POST',
          body: JSON.stringify(searchRequest),
        },
        true
      )
    );

    companies.push(
      ...response.results.map((r) => ({
        id: r.id,
        properties: r.properties,
      }))
    );
  }

  return companies.slice(0, limit);
}

/**
 * Build HubSpot Search API filter groups.
 */
function buildSearchFilters(filters: any): any[] {
  const filterGroups: any[] = [];

  // Missing fields (OR logic)
  if (filters.missing_fields && filters.missing_fields.length > 0) {
    const fieldsToQuery = filters.missing_fields.slice(0, 5);
    for (const field of fieldsToQuery) {
      filterGroups.push({
        filters: [
          {
            propertyName: field,
            operator: 'NOT_HAS_PROPERTY',
          },
        ],
      });
    }
  }

  // Other filters (AND logic)
  const additionalFilters: any[] = [];

  if (filters.lifecyclestage) {
    additionalFilters.push({
      propertyName: 'lifecyclestage',
      operator: 'EQ',
      value: filters.lifecyclestage,
    });
  }

  if (filters.hubspot_owner_id) {
    additionalFilters.push({
      propertyName: 'hubspot_owner_id',
      operator: 'EQ',
      value: filters.hubspot_owner_id,
    });
  }

  if (filters.industry && filters.industry.length > 0) {
    additionalFilters.push({
      propertyName: 'industry',
      operator: 'IN',
      values: filters.industry,
    });
  }

  // Add additional filters to each filter group
  if (additionalFilters.length > 0) {
    if (filterGroups.length > 0) {
      filterGroups.forEach((group) => {
        group.filters.push(...additionalFilters);
      });
    } else {
      filterGroups.push({
        filters: additionalFilters,
      });
    }
  }

  return filterGroups;
}

/**
 * Extract field value from provider response.
 */
function getFieldValueFromProvider(
  normalizedFields: any,
  fieldKey: string
): string | null {
  switch (fieldKey) {
    case 'industry':
      return normalizedFields.industry || null;
    case 'numberofemployees':
      return normalizedFields.employee_count
        ? String(normalizedFields.employee_count)
        : null;
    case 'linkedin_company_page':
      return normalizedFields.linkedin_url || null;
    case 'phone':
      return normalizedFields.phone || null;
    case 'domain':
      return normalizedFields.domain || null;
    case 'annualrevenue':
      return normalizedFields.revenue || normalizedFields.revenue_range || null;
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Enrich Preview Queue (for interactive preview flow)
// ─────────────────────────────────────────────────────────────

let previewQueue: Queue | null = null;
let previewWorker: Worker | null = null;

/**
 * Get or create the preview queue.
 */
export function getPreviewQueue(): Queue | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - preview queue disabled');
    return null;
  }

  if (!previewQueue) {
    const connection = createRedisConnection();
    previewQueue = new Queue('enrich-preview', {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
        removeOnComplete: { count: 100, age: 30 * 24 * 60 * 60 },
        removeOnFail: { count: 50, age: 90 * 24 * 60 * 60 },
      },
    });
  }

  return previewQueue;
}

/**
 * Enqueue a preview job.
 */
export async function enqueuePreviewJob(
  data: PreviewJobData
): Promise<{ queued: boolean; jobId?: string; reason?: string }> {
  const queue = getPreviewQueue();
  if (!queue) {
    return { queued: false, reason: 'Queue not configured' };
  }

  const job = await queue.add('preview', data, { priority: 1 }); // High priority
  return { queued: true, jobId: job.id };
}

/**
 * Start the preview worker.
 */
export function startPreviewWorker(): Worker | null {
  if (!isRedisConfigured()) {
    console.error('Cannot start preview worker - Redis not configured');
    return null;
  }

  if (previewWorker) {
    console.log('Preview worker already running');
    return previewWorker;
  }

  const connection = createRedisConnection();

  previewWorker = new Worker(
    'enrich-preview',
    async (job: Job<PreviewJobData>) => {
      console.log(`[Preview Worker] Processing job ${job.id} for run ${job.data.runId}`);
      return await processPreviewJob(job);
    },
    {
      connection,
      concurrency: 5, // Higher concurrency for interactive preview
    }
  );

  previewWorker.on('completed', (job) => {
    console.log(`[Preview Worker] Job ${job.id} completed`);
  });

  previewWorker.on('failed', (job, err) => {
    console.error(`[Preview Worker] Job ${job?.id} failed:`, err);
  });

  console.log('[Preview Worker] Started with concurrency 5');

  return previewWorker;
}

/**
 * Stop the preview worker.
 */
export async function stopPreviewWorker(): Promise<void> {
  if (previewWorker) {
    await previewWorker.close();
    previewWorker = null;
    console.log('[Preview Worker] Stopped');
  }
}

// ─────────────────────────────────────────────────────────────
// Enrich Apply Queue (write cached results to HubSpot)
// ─────────────────────────────────────────────────────────────

let applyQueue: Queue | null = null;
let applyWorker: Worker | null = null;

/**
 * Get or create the apply queue.
 */
export function getApplyQueue(): Queue | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - apply queue disabled');
    return null;
  }

  if (!applyQueue) {
    const connection = createRedisConnection();
    applyQueue = new Queue('enrich-apply', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }, // 2s, 4s, 8s
        removeOnComplete: { count: 200, age: 30 * 24 * 60 * 60 },
        removeOnFail: { count: 100, age: 90 * 24 * 60 * 60 },
      },
    });
  }

  return applyQueue;
}

/**
 * Enqueue an apply job with priority based on subscription tier.
 */
export async function enqueueApplyJob(
  data: ApplyJobData
): Promise<{ queued: boolean; jobId?: string; reason?: string }> {
  const queue = getApplyQueue();
  if (!queue) {
    return { queued: false, reason: 'Queue not configured' };
  }

  // Get job priority based on org's subscription tier
  const { getJobPriority } = await import('@/lib/billing/job-priority');
  const priority = await getJobPriority(data.orgId);

  const job = await queue.add('apply', data, { priority });
  return { queued: true, jobId: job.id };
}

/**
 * Start the apply worker.
 */
export function startApplyWorker(): Worker | null {
  if (!isRedisConfigured()) {
    console.error('Cannot start apply worker - Redis not configured');
    return null;
  }

  if (applyWorker) {
    console.log('Apply worker already running');
    return applyWorker;
  }

  const connection = createRedisConnection();

  applyWorker = new Worker(
    'enrich-apply',
    async (job: Job<ApplyJobData>) => {
      console.log(`[Apply Worker] Processing job ${job.id} for run ${job.data.runId}`);
      return await processApplyJob(job);
    },
    {
      connection,
      concurrency: 3,
    }
  );

  applyWorker.on('completed', (job) => {
    console.log(`[Apply Worker] Job ${job.id} completed`);
  });

  applyWorker.on('failed', (job, err) => {
    console.error(`[Apply Worker] Job ${job?.id} failed:`, err);
  });

  console.log('[Apply Worker] Started with concurrency 3');

  return applyWorker;
}

/**
 * Stop the apply worker.
 */
export async function stopApplyWorker(): Promise<void> {
  if (applyWorker) {
    await applyWorker.close();
    applyWorker = null;
    console.log('[Apply Worker] Stopped');
  }
}
