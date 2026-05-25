/**
 * Arrangement Queue
 *
 * BullMQ queue for processing arrangement enrichment runs.
 * Handles preflight checks, rehearsal runs, and live runs with checkpointing.
 */

import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection, isRedisConfigured } from './redis';
import { supabase } from '../db/supabase';
import { DEMO_COMPANIES, getDemoEnrichmentResult, simulateEnrichmentDelay } from '../arrangements/demo-fixtures';
import { estimateRunCost } from '../arrangements/estimate-cost';
import type { ProviderAdapter } from '../providers/types';
import { ApolloAdapter } from '../providers/apollo';
import { ZoomInfoAdapter } from '../providers/zoominfo';
import {
  waterfallStrategy,
  maxStrategy,
  minStrategy,
  averageStrategy,
  clusterAverageStrategy,
  type ProviderValue,
  type AggregationResult,
} from '../arrangements/aggregation-strategies';
import { normalizeWithHarmony } from '../arrangements/harmony-normalizer';
import { canProviderEnrichRecord } from '../providers/capabilities';
import { hasDomain, hasName, getDomain } from '../enrichment/domain-routing';
import {
  naicsToHubSpot,
  lookupIndustryCrosswalk,
  getCrosswalkEntry,
} from '../enrichment/industry-crosswalk';
import {
  createReviewSession,
  storePendingEnrichments,
  getOrgWriteBehavior,
  checkIsFirstRun,
  notifyReviewReady,
  updateReviewSessionResults,
} from '../enrichment/pending-store';
import { generateHarmonyForField } from '../enrichment/harmony-generator';

// ─────────────────────────────────────────────────────────────
// Queue Configuration
// ─────────────────────────────────────────────────────────────

const QUEUE_NAME = 'arrangements';

/**
 * Worker concurrency - how many arrangement jobs to process in parallel.
 */
const WORKER_CONCURRENCY = 5; // Railway has 8GB RAM, streaming keeps memory low

/**
 * Provider batch size - how many records to enrich in parallel per batch.
 */
const PROVIDER_BATCH_SIZE = 3; // Legacy: no longer used, kept for reference
const WORKER_POOL_SIZE = 5; // Railway has 8GB RAM, streaming keeps memory low

/**
 * Progress batch size - how many progress records to insert at once.
 */
const PROGRESS_BATCH_SIZE = 10;

/**
 * Checkpoint frequency - save checkpoint every N records.
 */
const CHECKPOINT_FREQUENCY = 500;

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
// Rate Limiting - Token Bucket Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Token bucket rate limiter for provider API calls.
 * Per org + provider key to ensure different clients don't throttle each other.
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  constructor(requestsPerMinute: number) {
    this.maxTokens = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.lastRefill = Date.now();
    this.refillRate = requestsPerMinute / 60000;
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens < 1) {
      const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      this.refill();
    }
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRate
    );
    this.lastRefill = now;
  }
}

/**
 * Per org + provider rate limiter registry.
 * Keyed on orgId + ':' + provider to isolate rate limits.
 */
const rateLimiters = new Map<string, TokenBucket>();

/**
 * Provider-specific rate limits (requests per minute).
 * Apollo: 45 req/min (under the 50/min hard limit to leave headroom)
 * GraphIQ: 100 req/min (higher tier)
 * Default: 30 req/min (conservative for unknown providers)
 */
const APOLLO_RATE_LIMIT = 100; // Detected burst limit 110 on portal 49169539, using 100 for headroom
const GRAPHIQ_RATE_LIMIT = 100;
const DEFAULT_RATE_LIMIT = 30;

function getRateLimiter(orgId: string, provider: string): TokenBucket {
  const key = `${orgId}:${provider}`;
  if (!rateLimiters.has(key)) {
    const limit = provider === 'apollo' ? APOLLO_RATE_LIMIT
                : provider === 'graphiq' ? GRAPHIQ_RATE_LIMIT
                : DEFAULT_RATE_LIMIT;
    rateLimiters.set(key, new TokenBucket(limit));
  }
  return rateLimiters.get(key)!;
}

// ─────────────────────────────────────────────────────────────
// Job Types
// ─────────────────────────────────────────────────────────────

// Legacy format (backward compatibility)
export interface EnrichmentStep {
  provider: string;
  fields: string[];
  order: number;
}

// New field-first waterfall format
export interface FieldConfigStep {
  order: number;
  provider: string;
  policy: 'fill_empty' | 'overwrite';
}

export interface FieldConfig {
  field_key: string;
  field_type: 'categorical' | 'numeric' | 'url' | 'text' | 'boolean';
  aggregation_strategy: 'waterfall' | 'max' | 'min' | 'average' | 'cluster_average';
  apply_harmony: boolean;
  harmony_id: string | null;
  steps: FieldConfigStep[];
}

export interface ArrangementConfig {
  id: string;
  name: string;
  source_type: string;
  source_config: Record<string, unknown>;
  // Legacy format (still supported for backward compatibility)
  enrichment_steps?: EnrichmentStep[];
  // New format (preferred)
  field_configs?: FieldConfig[];
  output_destination: string;
  output_config: Record<string, unknown>;
}

/**
 * Preflight job - validates arrangement configuration.
 */
export interface PreflightJobData {
  arrangementId: string;
  orgId: string;
  config: ArrangementConfig;
}

export interface PreflightJobResult {
  success: boolean;
  issues: Array<{
    type: 'missing_fields' | 'invalid_config' | 'insufficient_credits' | 'rate_limit';
    severity: 'error' | 'warning';
    message: string;
    details?: Record<string, unknown>;
  }>;
}

/**
 * Rehearsal job - runs arrangement on sample data.
 */
export interface RehearsalJobData {
  arrangementId: string;
  runId: string;
  orgId: string;
  config: ArrangementConfig;
  mode: 'demo' | 'live'; // demo = synthetic data, live = real API calls (limited sample)
  sampleSize: number;
}

export interface RehearsalJobResult {
  success: boolean;
  recordsProcessed: number;
  sampleResults: Array<{
    recordId: string;
    enrichedData: Record<string, unknown>;
    creditsUsed: number;
  }>;
  totalCreditsUsed: number;
  errors?: string[];
}

/**
 * Live run job - processes all records with checkpointing.
 */
export interface LiveRunJobData {
  arrangementId: string;
  runId: string;
  orgId: string;
  config: ArrangementConfig;
  totalRecords: number;
  checkpointData?: {
    lastProcessedId: string;
    processedCount: number;
  };
}

export interface LiveRunJobResult {
  success: boolean;
  recordsProcessed: number;
  successfulRecords: number;
  failedRecords: number;
  creditsUsed: number;
  checkpointData?: {
    lastProcessedId: string;
    processedCount: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Queue Instance
// ─────────────────────────────────────────────────────────────

let arrangementQueue: Queue | null = null;
let arrangementWorker: Worker | null = null;

/**
 * Get or create the arrangement queue.
 */
export function getArrangementQueue(): Queue | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - arrangement queue disabled');
    return null;
  }

  if (!arrangementQueue) {
    const connection = createRedisConnection();
    arrangementQueue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: RETRY_SETTINGS.attempts,
        backoff: RETRY_SETTINGS.backoff,
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs only
          age: 30 * 24 * 60 * 60, // 30 days
        },
        removeOnFail: {
          count: 50, // Keep last 50 failed jobs for debugging
          age: 90 * 24 * 60 * 60, // 90 days
        },
      },
    });
  }

  return arrangementQueue;
}

// ─────────────────────────────────────────────────────────────
// Enqueue Functions
// ─────────────────────────────────────────────────────────────

/**
 * Enqueue a preflight check job.
 */
export async function enqueuePreflightJob(
  data: PreflightJobData
): Promise<{ queued: boolean; jobId?: string; reason?: string }> {
  const queue = getArrangementQueue();
  if (!queue) {
    return { queued: false, reason: 'Queue not configured' };
  }

  const job = await queue.add('preflight', data);
  return { queued: true, jobId: job.id };
}

/**
 * Enqueue a rehearsal job.
 */
export async function enqueueRehearsalJob(
  data: RehearsalJobData
): Promise<{ queued: boolean; jobId?: string; reason?: string }> {
  const queue = getArrangementQueue();
  if (!queue) {
    return { queued: false, reason: 'Queue not configured' };
  }

  const job = await queue.add('rehearsal', data);
  return { queued: true, jobId: job.id };
}

/**
 * Enqueue a live run job.
 */
export async function enqueueLiveRunJob(
  data: LiveRunJobData
): Promise<{ queued: boolean; jobId?: string; reason?: string }> {
  const queue = getArrangementQueue();
  if (!queue) {
    return { queued: false, reason: 'Queue not configured' };
  }

  const job = await queue.add('live-run', data);
  return { queued: true, jobId: job.id };
}

// ─────────────────────────────────────────────────────────────
// Job Processors
// ─────────────────────────────────────────────────────────────

/**
 * Process a preflight check job.
 */
async function processPreflightJob(
  job: Job<PreflightJobData>
): Promise<PreflightJobResult> {
  const { config, orgId } = job.data;
  const issues: PreflightJobResult['issues'] = [];

  // Check 1: Validate source configuration
  if (!config.source_config || Object.keys(config.source_config).length === 0) {
    issues.push({
      type: 'invalid_config',
      severity: 'error',
      message: 'Source configuration is missing or empty',
    });
  }

  // Check 2: Validate enrichment steps
  if (!config.enrichment_steps || config.enrichment_steps.length === 0) {
    issues.push({
      type: 'invalid_config',
      severity: 'error',
      message: 'No enrichment steps configured',
    });
  }

  // Check 3: Validate output destination
  if (!config.output_config || !config.output_config.connection_id) {
    issues.push({
      type: 'invalid_config',
      severity: 'error',
      message: 'Output destination not properly configured',
    });
  }

  // Check 4: Estimate credits and check balance
  if (supabase && config.enrichment_steps) {
    const { data: org } = await supabase
      .from('organizations')
      .select('credits_remaining')
      .eq('org_id', orgId)
      .single();

    const estimate = estimateRunCost(config.enrichment_steps, 100); // Sample size for estimate

    if (org && org.credits_remaining < estimate.total_credits) {
      issues.push({
        type: 'insufficient_credits',
        severity: 'error',
        message: `Insufficient credits. Estimated: ${estimate.total_credits}, Available: ${org.credits_remaining}`,
        details: { estimated: estimate.total_credits, available: org.credits_remaining },
      });
    }
  }

  // Store preflight results
  if (supabase) {
    for (const issue of issues) {
      await supabase.from('arrangement_preflight').insert({
        arrangement_id: config.id,
        org_id: orgId,
        check_type: issue.type,
        severity: issue.severity,
        message: issue.message,
        details: issue.details || {},
      });
    }
  }

  return {
    success: issues.filter(i => i.severity === 'error').length === 0,
    issues,
  };
}

/**
 * Process a rehearsal job.
 */
async function processRehearsalJob(
  job: Job<RehearsalJobData>
): Promise<RehearsalJobResult> {
  const { runId, config, mode, sampleSize, orgId } = job.data;

  if (!supabase) {
    throw new Error('Database not configured');
  }

  // Update run status to running
  await supabase
    .from('arrangement_runs')
    .update({ status: 'running' })
    .eq('id', runId);

  const sampleResults: RehearsalJobResult['sampleResults'] = [];
  let totalCreditsUsed = 0;
  const errors: string[] = [];

  try {
    // Get sample records
    const companies = mode === 'demo'
      ? DEMO_COMPANIES.slice(0, sampleSize)
      : await fetchSampleRecords(config.source_config, sampleSize);

    // Check if using new field_configs format or legacy enrichment_steps
    const usingFieldConfigs = config.field_configs && config.field_configs.length > 0;

    if (!usingFieldConfigs && config.enrichment_steps) {
      console.warn(`[Rehearsal] Arrangement ${config.id} using legacy enrichment_steps format. Migrate to field_configs.`);
    }

    // Process each record
    for (const company of companies) {
      try {
        const enrichedData: Record<string, unknown> = { ...company };
        let recordCredits = 0;
        const fieldDetail: Record<string, any> = {};
        let fieldsAttempted = 0;
        let fieldsWritten = 0;
        let fieldsSkipped = 0;

        if (usingFieldConfigs) {
          // NEW PATH: Use field_configs
          for (const fieldConfig of config.field_configs!) {
            fieldsAttempted++;

            const result = await processFieldConfig(
              fieldConfig,
              company,
              orgId,
              company[fieldConfig.field_key],
              mode
            );

            if (result.written) {
              enrichedData[fieldConfig.field_key] = result.value;
              fieldsWritten++;
              recordCredits += fieldConfig.steps.length; // Rough estimate

              fieldDetail[fieldConfig.field_key] = {
                provider: result.provider,
                strategy: result.strategy,
                raw: result.raw,
                normalized: result.normalized,
                written: true,
                metadata: result.metadata,
              };
            } else if (result.skipped) {
              fieldsSkipped++;
              fieldDetail[fieldConfig.field_key] = {
                skipped: true,
                reason: result.skipReason,
              };
            }
          }
        } else {
          // LEGACY PATH: Use enrichment_steps
          for (const step of config.enrichment_steps!.sort((a, b) => a.order - b.order)) {
            if (mode === 'demo') {
              // Demo mode: use synthetic data
              const stepResult = getDemoEnrichmentResult(company as any, step.provider, step.fields);
              Object.assign(enrichedData, stepResult);
              recordCredits += 1; // Nominal credit for demo
            } else {
              // Live mode: make real API calls
              const provider = await getProviderAdapter(step.provider, orgId);
              const result = await provider.enrichCompany({ domain: company.domain });

              if (result) {
                for (const field of step.fields) {
                  enrichedData[field] = result.normalized?.[field] ?? result.raw[field];
                }
                recordCredits += step.fields.length;
              }
            }
          }
        }

        sampleResults.push({
          recordId: company.id,
          enrichedData,
          creditsUsed: recordCredits,
        });

        totalCreditsUsed += recordCredits;

      } catch (error) {
        errors.push(`Failed to enrich record ${company.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Simulate delay for demo mode
    if (mode === 'demo') {
      await simulateEnrichmentDelay(companies.length);
    }

    // Update run with results
    await supabase
      .from('arrangement_runs')
      .update({
        status: 'completed',
        processed_records: sampleResults.length,
        successful_records: sampleResults.length - errors.length,
        failed_records: errors.length,
        actual_credits_used: totalCreditsUsed,
        results_snapshot: sampleResults,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    return {
      success: true,
      recordsProcessed: sampleResults.length,
      sampleResults,
      totalCreditsUsed,
      errors: errors.length > 0 ? errors : undefined,
    };

  } catch (error) {
    // Update run status to failed
    await supabase
      .from('arrangement_runs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Parallel Processing Helpers
// ─────────────────────────────────────────────────────────────

interface EnrichedRecord {
  record: any;
  companyId: string;
  propertiesToWrite: Record<string, unknown>;
  fieldsAttempted: number;
  fieldsWritten: number;
  fieldsSkipped: number;
  fieldDetail: Record<string, any>;
  creditsUsed: number;
}

interface FailedRecord {
  record: any;
  companyId: string;
  error: string;
}

/**
 * Enrich a single record by processing all configured fields.
 */
async function enrichSingleRecord(
  record: any,
  fieldConfigs: FieldConfig[],
  orgId: string
): Promise<EnrichedRecord> {
  const enrichedData: Record<string, unknown> = { ...record };
  let recordCredits = 0;
  const fieldDetail: Record<string, any> = {};
  let fieldsAttempted = 0;
  let fieldsWritten = 0;
  let fieldsSkipped = 0;
  const propertiesToWrite: Record<string, unknown> = {};

  // Process all field configs in parallel using Promise.allSettled
  const fieldResults = await Promise.allSettled(
    fieldConfigs.map(fieldConfig =>
      processFieldConfig(
        fieldConfig,
        record,
        orgId,
        record.properties?.[fieldConfig.field_key] || record[fieldConfig.field_key],
        'live'
      )
    )
  );

  // Process results
  fieldResults.forEach((promiseResult, index) => {
    const fieldConfig = fieldConfigs[index];
    fieldsAttempted++;

    if (promiseResult.status === 'fulfilled') {
      const result = promiseResult.value;

      try {
        if (result.written) {
          enrichedData[fieldConfig.field_key] = result.value;
          fieldsWritten++;
          recordCredits += fieldConfig.steps.length;

          fieldDetail[fieldConfig.field_key] = {
            provider: result.provider,
            strategy: result.strategy,
            raw: result.raw,
            normalized: result.normalized,
            written: true,
            metadata: result.metadata,
          };

          // Build HubSpot properties to write
          const hubspotPropertyName = mapCanonicalToHubSpot(fieldConfig.field_key);
          const transformedValue = transformValueForHubSpot(hubspotPropertyName, result.value);

          // Only write if value is not null after transformation
          if (transformedValue !== null) {
            propertiesToWrite[hubspotPropertyName] = transformedValue;
          } else if (result.value !== null) {
            // Value was filtered out by transformation
            fieldsSkipped++;
            fieldDetail[fieldConfig.field_key] = {
              skipped: true,
              reason: 'Value does not match HubSpot enum options',
            };
          }
        } else if (result.skipped) {
          fieldsSkipped++;
          fieldDetail[fieldConfig.field_key] = {
            skipped: true,
            reason: result.skipReason,
          };
        }
      } catch (fieldError) {
        console.error(`[Enrich] Field ${fieldConfig.field_key} failed:`, fieldError);
        fieldsSkipped++;
        fieldDetail[fieldConfig.field_key] = {
          skipped: true,
          reason: `Error: ${fieldError instanceof Error ? fieldError.message : 'Unknown error'}`,
        };
      }
    } else {
      // Promise rejected
      const fieldError = promiseResult.reason;
      console.error(`[Enrich] Field ${fieldConfig.field_key} failed:`, fieldError);
      fieldsSkipped++;
      fieldDetail[fieldConfig.field_key] = {
        skipped: true,
        reason: `Error: ${fieldError instanceof Error ? fieldError.message : 'Unknown error'}`,
      };
    }
  });

  const companyId = record.id || record.properties?.hs_object_id || String(record.hs_object_id);

  return {
    record,
    companyId,
    propertiesToWrite,
    fieldsAttempted,
    fieldsWritten,
    fieldsSkipped,
    fieldDetail,
    creditsUsed: recordCredits,
  };
}

/**
 * Process a batch of records in parallel using Promise.allSettled.
 * Returns successful and failed results separately.
 */
/**
 * Process records using a worker pool pattern that maintains constant concurrency.
 *
 * Instead of waiting for batches of N to complete, this keeps WORKER_POOL_SIZE
 * requests in-flight at all times, starting a new one immediately when one completes.
 * This fully saturates the rate limit without idle time between batches.
 *
 * @param records - Records to process
 * @param fieldConfigs - Field configurations for enrichment
 * @param orgId - Organization ID
 * @returns Successful and failed records
 */
async function processWithPool(
  records: any[],
  fieldConfigs: FieldConfig[],
  orgId: string
): Promise<{ successful: EnrichedRecord[]; failed: FailedRecord[] }> {
  const successful: EnrichedRecord[] = [];
  const failed: FailedRecord[] = [];
  const queue = [...records];
  const inFlight = new Set<Promise<void>>();

  async function processNext(): Promise<void> {
    const record = queue.shift();
    if (!record) return;

    const promise = enrichSingleRecord(record, fieldConfigs, orgId)
      .then(result => {
        successful.push(result);
      })
      .catch(err => {
        const companyId = record.id || record.properties?.hs_object_id || String(record.hs_object_id);
        failed.push({
          record,
          companyId,
          error: err?.message ?? 'Unknown error',
        });
        console.error(`[Worker] Record ${companyId} failed:`, err.message);
      })
      .finally(() => {
        inFlight.delete(promise);
        // Immediately start next record when this one completes
        if (queue.length > 0) {
          const next = processNext();
          inFlight.add(next);
        }
      });

    inFlight.add(promise);
    return promise;
  }

  // Start initial pool of workers
  const initial = Math.min(WORKER_POOL_SIZE, records.length);
  for (let i = 0; i < initial; i++) {
    const p = processNext();
    if (p) inFlight.add(p);
  }

  // Wait for all to complete
  while (inFlight.size > 0) {
    await Promise.race(inFlight);
  }

  return { successful, failed };
}

async function processBatch(
  records: any[],
  fieldConfigs: FieldConfig[],
  orgId: string
): Promise<{ successful: EnrichedRecord[]; failed: FailedRecord[] }> {
  const results = await Promise.allSettled(
    records.map(record => enrichSingleRecord(record, fieldConfigs, orgId))
  );

  const successful: EnrichedRecord[] = [];
  const failed: FailedRecord[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successful.push(result.value);
    } else {
      const record = records[index];
      const companyId = record.id || record.properties?.hs_object_id || String(record.hs_object_id);
      failed.push({
        record,
        companyId,
        error: result.reason?.message ?? 'Unknown error',
      });
    }
  });

  return { successful, failed };
}

/**
 * Process a live run job with checkpointing.
 */
async function processLiveRunJob(
  job: Job<LiveRunJobData>
): Promise<LiveRunJobResult> {
  const { runId, config, totalRecords, checkpointData, orgId } = job.data;

  if (!supabase) {
    throw new Error('Database not configured');
  }

  let processedCount = checkpointData?.processedCount || 0;
  let successfulCount = 0;
  let failedCount = 0;
  let creditsUsed = 0;

  // Check if using new field_configs format or legacy enrichment_steps
  const usingFieldConfigs = config.field_configs && config.field_configs.length > 0;

  if (!usingFieldConfigs && config.enrichment_steps) {
    console.warn(`[Live Run] Arrangement ${config.id} using legacy enrichment_steps format. Migrate to field_configs.`);
  }

  try {
    // Get HubSpot connection and access token
    const { getAccessToken } = await import('../hubspot/get-access-token');
    const { HubSpotClient } = await import('../hubspot/client');
    const accessToken = await getAccessToken(orgId);
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id, scopes')
      .eq('org_id', orgId)
      .single();

    if (!connection) {
      throw new Error('HubSpot connection not found');
    }

    const hubspotClient = new HubSpotClient(accessToken, connection.portal_id);

    // Create review session for pending enrichments
    const reviewSessionId = await createReviewSession(
      orgId,
      connection.portal_id,
      config.id,
      runId
    );
    console.log(`[Arrangement ${config.id}] Created review session ${reviewSessionId}`);

    // Determine if we should use streaming Export API
    const sourceType = config.source_config.source_type as string | undefined;
    const EXPORT_THRESHOLD = 500;
    let useStreamingExport = false;

    // Use streaming for all_companies source type (or when source_type is missing, which defaults to all_companies)
    const isAllCompanies = !sourceType || sourceType === 'all_companies';

    if (isAllCompanies) {
      const scopes = connection.scopes as string[] | null;
      const hasExportScope = scopes?.includes('crm.export') ?? false;

      if (hasExportScope) {
        // Get company count to decide
        const countResponse = await fetchWithRetry(
          'https://api.hubapi.com/crm/v3/objects/companies/search',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              filterGroups: [],
              properties: ['hs_object_id'],
              limit: 1,
            }),
          }
        );

        if (countResponse.ok) {
          const countData = await countResponse.json();
          const totalCompanies = countData.total ?? 0;
          useStreamingExport = totalCompanies > EXPORT_THRESHOLD;

          console.log(
            `[Arrangement ${config.id}] ${useStreamingExport ? 'Streaming Export API' : 'Pagination'} ` +
            `(${totalCompanies} companies, export scope: ${hasExportScope})`
          );
        }
      }
    }

    // Shared processing variables
    const progressBuffer: any[] = [];
    let lastProcessedId: string | undefined;
    const CHUNK_SIZE = 50; // Process records in chunks
    let chunkNumber = 0;
    let exportApiFailed = false; // Track if Export API failed to avoid retry

    // Path A: Streaming Export API (memory-efficient)
    if (useStreamingExport) {
      const properties = [
        'name',
        'domain',
        'website',  // HubSpot has both domain and website properties
        'hs_additional_domains',  // Alternate domains (some portals use this)
        'industry',
        'numberofemployees',
        'annualrevenue',
        'phone',
        'linkedin_company_page',
        'founded_year',
        'city',
        'country',
      ];

      console.log(`[Arrangement ${config.id}] Processing via streaming Export API (chunks of ${CHUNK_SIZE})`);

      try {
        // Stream and process chunks as they arrive
        for await (const chunk of streamViaExportApi(orgId, connection.portal_id, accessToken, properties, CHUNK_SIZE)) {
        // Check if run is paused
        const { data: run } = await supabase
          .from('arrangement_runs')
          .select('status')
          .eq('id', runId)
          .single();

        if (run?.status === 'paused') {
          console.log(`[Arrangement ${config.id}] Run paused, saving checkpoint`);
          if (lastProcessedId) {
            await saveCheckpoint(runId, lastProcessedId, processedCount, creditsUsed);
          }
          break;
        }

        chunkNumber++;
        console.log(`[Arrangement ${config.id}] Processing stream chunk ${chunkNumber} (${chunk.length} records)`);

        // MEMORY CHECKPOINT 1: Before enrichment
        const memBefore = process.memoryUsage();
        console.log(`[Memory] Before chunk: heap ${Math.round(memBefore.heapUsed/1024/1024)}MB`);

        // Process chunk with worker pool (maintains WORKER_POOL_SIZE concurrent requests)
        const { successful, failed } = await processWithPool(
          chunk,
          config.field_configs || [],
          orgId
        );

        // MEMORY CHECKPOINT 2: After enrichment, before store
        const memAfterEnrich = process.memoryUsage();
        console.log(`[Memory] After enrich: heap ${Math.round(memAfterEnrich.heapUsed/1024/1024)}MB, delta +${Math.round((memAfterEnrich.heapUsed - memBefore.heapUsed)/1024/1024)}MB`);

        // BINARY SEARCH: Comment out storePendingEnrichments to test memory leak
        if (successful.length > 0) {
          const recordsToStore = successful.filter(r => Object.keys(r.propertiesToWrite).length > 0);

          if (recordsToStore.length > 0) {
            // await storePendingEnrichments(
            //   reviewSessionId,
            //   orgId,
            //   connection.portal_id,
            //   recordsToStore
            // );
            console.log(`[BINARY SEARCH] Would store ${recordsToStore.length} records as pending enrichments (storePendingEnrichments commented out)`);
          }
        }

        // MEMORY CHECKPOINT 3: After store
        const memAfterStore = process.memoryUsage();
        console.log(`[Memory] After store: heap ${Math.round(memAfterStore.heapUsed/1024/1024)}MB, delta +${Math.round((memAfterStore.heapUsed - memAfterEnrich.heapUsed)/1024/1024)}MB`);
        console.log(`[Memory] Total chunk delta: +${Math.round((memAfterStore.heapUsed - memBefore.heapUsed)/1024/1024)}MB`);

        // Add successful records to progress buffer
        for (const enrichedRecord of successful) {
          successfulCount++;
          creditsUsed += enrichedRecord.creditsUsed;
          lastProcessedId = enrichedRecord.companyId;

          progressBuffer.push({
            run_id: runId,
            org_id: orgId,
            record_id: enrichedRecord.companyId,
            status: 'completed',
            enrichment_results: null, // Don't store full record - saves memory
            credits_used: enrichedRecord.creditsUsed,
            completed_at: new Date().toISOString(),
            result: {
              fields_attempted: enrichedRecord.fieldsAttempted,
              fields_written: enrichedRecord.fieldsWritten,
              fields_skipped: enrichedRecord.fieldsSkipped,
              field_detail: enrichedRecord.fieldDetail,
            },
          });
        }

        // Add failed records to progress buffer
        for (const failedRecord of failed) {
          failedCount++;
          lastProcessedId = failedRecord.companyId;

          progressBuffer.push({
            run_id: runId,
            org_id: orgId,
            record_id: failedRecord.companyId,
            status: 'failed',
            error_message: failedRecord.error,
            completed_at: new Date().toISOString(),
          });
        }

        processedCount += chunk.length;

        // CRITICAL: Flush progressBuffer after EVERY CHUNK to prevent memory buildup
        if (progressBuffer.length > 0) {
          await supabase.from('arrangement_run_progress').insert(progressBuffer);
          console.log(`[Arrangement ${config.id}] Inserted ${progressBuffer.length} progress records`);
          progressBuffer.length = 0; // Clear array to free memory
        }

        // Update run progress every 10 records
        if (processedCount % 10 === 0) {
          await supabase
            .from('arrangement_runs')
            .update({
              processed_records: processedCount,
              successful_records: successfulCount,
              failed_records: failedCount,
              actual_credits_used: creditsUsed,
            })
            .eq('id', runId);
        }

        // Save checkpoint every CHECKPOINT_FREQUENCY records
        if (processedCount % CHECKPOINT_FREQUENCY === 0 && lastProcessedId) {
          await saveCheckpoint(runId, lastProcessedId, processedCount, creditsUsed);
          console.log(`[Arrangement ${config.id}] Checkpoint saved at ${processedCount} records`);
        }

        console.log(`[Arrangement ${config.id}] Chunk ${chunkNumber}: ${successful.length} successful, ${failed.length} failed`);

        // Clear chunk references to help GC
        successful.length = 0;
        failed.length = 0;
        }
      } catch (exportError) {
        const errorMessage = exportError instanceof Error ? exportError.message : 'Unknown error';

        // Check if this is a daily limit error (not retryable)
        if (errorMessage.includes('Export limit') || errorMessage.includes('daily')) {
          console.warn(`[Arrangement ${config.id}] Export API daily limit reached, falling back to pagination`);
          console.warn(`[Arrangement ${config.id}] Export error: ${errorMessage}`);

          // Mark Export API as failed - will use streaming pagination instead
          exportApiFailed = true;

          // Stream pagination in chunks (memory-efficient)
          for await (const chunk of streamViaPagination(accessToken, properties, CHUNK_SIZE, checkpointData?.lastProcessedId)) {
            // Check if run is paused
            const { data: run } = await supabase
              .from('arrangement_runs')
              .select('status')
              .eq('id', runId)
              .single();

            if (run?.status === 'paused') {
              console.log(`[Arrangement ${config.id}] Run paused, saving checkpoint`);
              if (lastProcessedId) {
                await saveCheckpoint(runId, lastProcessedId, processedCount, creditsUsed);
              }
              break;
            }

            chunkNumber++;
            console.log(`[Arrangement ${config.id}] Processing pagination chunk ${chunkNumber} (${chunk.length} records)`);

            // MEMORY CHECKPOINT 1: Before enrichment
            const memBefore = process.memoryUsage();
            console.log(`[Memory] Before chunk: heap ${Math.round(memBefore.heapUsed/1024/1024)}MB`);

            // Process chunk with worker pool
            const { successful, failed } = await processWithPool(
              chunk,
              config.field_configs || [],
              orgId
            );

            // MEMORY CHECKPOINT 2: After enrichment, before store
            const memAfterEnrich = process.memoryUsage();
            console.log(`[Memory] After enrich: heap ${Math.round(memAfterEnrich.heapUsed/1024/1024)}MB, delta +${Math.round((memAfterEnrich.heapUsed - memBefore.heapUsed)/1024/1024)}MB`);

            // BINARY SEARCH: Comment out storePendingEnrichments to test memory leak
            if (successful.length > 0) {
              const recordsToStore = successful.filter(r => Object.keys(r.propertiesToWrite).length > 0);

              if (recordsToStore.length > 0) {
                // await storePendingEnrichments(
                //   reviewSessionId,
                //   orgId,
                //   connection.portal_id,
                //   recordsToStore
                // );
                console.log(`[BINARY SEARCH] Would store ${recordsToStore.length} records as pending enrichments (storePendingEnrichments commented out)`);
              }
            }

            // MEMORY CHECKPOINT 3: After store
            const memAfterStore = process.memoryUsage();
            console.log(`[Memory] After store: heap ${Math.round(memAfterStore.heapUsed/1024/1024)}MB, delta +${Math.round((memAfterStore.heapUsed - memAfterEnrich.heapUsed)/1024/1024)}MB`);
            console.log(`[Memory] Total chunk delta: +${Math.round((memAfterStore.heapUsed - memBefore.heapUsed)/1024/1024)}MB`);

            // Add successful records to progress buffer
            for (const enrichedRecord of successful) {
              successfulCount++;
              creditsUsed += enrichedRecord.creditsUsed;
              lastProcessedId = enrichedRecord.companyId;

              progressBuffer.push({
                run_id: runId,
                org_id: orgId,
                record_id: enrichedRecord.companyId,
                status: 'completed',
                enrichment_results: null, // Don't store full record - saves memory
                credits_used: enrichedRecord.creditsUsed,
                completed_at: new Date().toISOString(),
                result: {
                  fields_attempted: enrichedRecord.fieldsAttempted,
                  fields_written: enrichedRecord.fieldsWritten,
                  fields_skipped: enrichedRecord.fieldsSkipped,
                  field_detail: enrichedRecord.fieldDetail,
                },
              });
            }

            // Add failed records to progress buffer
            for (const failedRecord of failed) {
              failedCount++;
              lastProcessedId = failedRecord.companyId;

              progressBuffer.push({
                run_id: runId,
                org_id: orgId,
                record_id: failedRecord.companyId,
                status: 'failed',
                error_message: failedRecord.error,
                completed_at: new Date().toISOString(),
              });
            }

            processedCount += chunk.length;

            // CRITICAL: Flush progressBuffer after EVERY CHUNK to prevent memory buildup
            // Since we process 50 records per chunk, waiting for PROGRESS_BATCH_SIZE (10)
            // would accumulate 40-50 full records in memory
            if (progressBuffer.length > 0) {
              await supabase.from('arrangement_run_progress').insert(progressBuffer);
              console.log(`[Arrangement ${config.id}] Inserted ${progressBuffer.length} progress records`);
              progressBuffer.length = 0; // Clear array to free memory
            }

            // Update run progress
            if (processedCount % 10 === 0) {
              await supabase
                .from('arrangement_runs')
                .update({
                  processed_records: processedCount,
                  successful_records: successfulCount,
                  failed_records: failedCount,
                  actual_credits_used: creditsUsed,
                })
                .eq('id', runId);
            }

            // Save checkpoint
            if (processedCount % CHECKPOINT_FREQUENCY === 0 && lastProcessedId) {
              await saveCheckpoint(runId, lastProcessedId, processedCount, creditsUsed);
              console.log(`[Arrangement ${config.id}] Checkpoint saved at ${processedCount} records`);
            }

            console.log(`[Arrangement ${config.id}] Chunk ${chunkNumber}: ${successful.length} successful, ${failed.length} failed`);

            // Clear chunk references to help GC
            successful.length = 0;
            failed.length = 0;
          }
        } else {
          // Other Export API errors should fail the run
          throw exportError;
        }
      }
    }

    // Path B: Non-streaming (pagination or lists) - only for non-fallback paths
    if (!useStreamingExport && !exportApiFailed) {
      const records = await fetchRecordsForProcessing(
        config.source_config,
        checkpointData?.lastProcessedId,
        orgId
      );

      console.log(`[Arrangement ${config.id}] Processing ${records.length} records with worker pool (concurrency: ${WORKER_POOL_SIZE})`);

      const totalRecords = records.length;

      while (records.length > 0) {
        // Check if run is paused
        const { data: run } = await supabase
          .from('arrangement_runs')
          .select('status')
          .eq('id', runId)
          .single();

        if (run?.status === 'paused') {
          console.log(`[Arrangement ${config.id}] Run paused, saving checkpoint`);
          if (lastProcessedId) {
            await saveCheckpoint(runId, lastProcessedId, processedCount, creditsUsed);
          }
          break;
        }

        // Use splice to remove chunk from array for garbage collection
        const chunk = records.splice(0, CHUNK_SIZE);
        chunkNumber++;
        const totalChunks = Math.ceil(totalRecords / CHUNK_SIZE);

        console.log(`[Arrangement ${config.id}] Processing chunk ${chunkNumber}/${totalChunks} (${chunk.length} records)`);

        // Process chunk with worker pool (maintains WORKER_POOL_SIZE concurrent requests)
        const { successful, failed } = await processWithPool(
          chunk,
          config.field_configs || [],
          orgId
        );

        // BINARY SEARCH: Comment out storePendingEnrichments to test memory leak
        if (successful.length > 0) {
          const recordsToStore = successful.filter(r => Object.keys(r.propertiesToWrite).length > 0);

          if (recordsToStore.length > 0) {
            // await storePendingEnrichments(
            //   reviewSessionId,
            //   orgId,
            //   connection.portal_id,
            //   recordsToStore
            // );
            console.log(`[BINARY SEARCH] Would store ${recordsToStore.length} records as pending enrichments (storePendingEnrichments commented out)`);
          }
        }

        // Add successful records to progress buffer
        for (const enrichedRecord of successful) {
          successfulCount++;
          creditsUsed += enrichedRecord.creditsUsed;
          lastProcessedId = enrichedRecord.companyId;

          progressBuffer.push({
            run_id: runId,
            org_id: orgId,
            record_id: enrichedRecord.companyId,
            status: 'completed',
            enrichment_results: null, // Don't store full record - saves memory
            credits_used: enrichedRecord.creditsUsed,
            completed_at: new Date().toISOString(),
            result: {
              fields_attempted: enrichedRecord.fieldsAttempted,
              fields_written: enrichedRecord.fieldsWritten,
              fields_skipped: enrichedRecord.fieldsSkipped,
              field_detail: enrichedRecord.fieldDetail,
            },
          });
        }

        // Add failed records to progress buffer
        for (const failedRecord of failed) {
          failedCount++;
          lastProcessedId = failedRecord.companyId;

          progressBuffer.push({
            run_id: runId,
            org_id: orgId,
            record_id: failedRecord.companyId,
            status: 'failed',
            error_message: failedRecord.error,
            completed_at: new Date().toISOString(),
          });
        }

        processedCount += chunk.length;

        // CRITICAL: Flush progressBuffer after EVERY CHUNK to prevent memory buildup
        if (progressBuffer.length > 0) {
          await supabase.from('arrangement_run_progress').insert(progressBuffer);
          console.log(`[Arrangement ${config.id}] Inserted ${progressBuffer.length} progress records`);
          progressBuffer.length = 0; // Clear array to free memory
        }

        // Update run progress every 10 records
        if (processedCount % 10 === 0) {
          await supabase
            .from('arrangement_runs')
            .update({
              processed_records: processedCount,
              successful_records: successfulCount,
              failed_records: failedCount,
              actual_credits_used: creditsUsed,
            })
            .eq('id', runId);
        }

        // Save checkpoint every CHECKPOINT_FREQUENCY records
        if (processedCount % CHECKPOINT_FREQUENCY === 0 && lastProcessedId) {
          await saveCheckpoint(runId, lastProcessedId, processedCount, creditsUsed);
          console.log(`[Arrangement ${config.id}] Checkpoint saved at ${processedCount} records`);
        }

        console.log(`[Arrangement ${config.id}] Chunk ${chunkNumber}: ${successful.length} successful, ${failed.length} failed`);

        // Clear chunk references to help GC
        successful.length = 0;
        failed.length = 0;
      }
    }

    // Flush remaining progress records
    if (progressBuffer.length > 0) {
      await supabase.from('arrangement_run_progress').insert(progressBuffer);
      console.log(`[Arrangement ${config.id}] Flushed ${progressBuffer.length} remaining progress records`);
      progressBuffer.length = 0;
    }

    // Check write behavior and decide: auto-write or review
    const writeMode = await getOrgWriteBehavior(orgId);
    const fieldKeys = (config.field_configs || []).map(fc => fc.field_key);
    const isFirstRunForFields = await checkIsFirstRun(orgId, connection.portal_id, fieldKeys);

    console.log(
      `[Arrangement ${config.id}] Write mode: ${writeMode}, first run: ${isFirstRunForFields}`
    );

    if (writeMode === 'always_auto_write' || (writeMode === 'review_first_run' && !isFirstRunForFields)) {
      // Auto-write: generate harmony if needed, then write immediately
      console.log(`[Arrangement ${config.id}] Auto-writing to HubSpot`);

      // Generate harmonies for all fields (if not already generated)
      for (const fieldConfig of config.field_configs || []) {
        await generateHarmonyIfNeeded(reviewSessionId, orgId, connection.portal_id, fieldConfig.field_key);
      }

      // Write to HubSpot using the approval endpoint (internally)
      await writeReviewSessionToHubSpot(reviewSessionId, orgId, accessToken, connection.portal_id);

      // Mark as completed
      await supabase
        .from('arrangement_runs')
        .update({
          status: 'completed',
          processed_records: processedCount,
          successful_records: successfulCount,
          failed_records: failedCount,
          actual_credits_used: creditsUsed,
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId);
    } else {
      // Review required: notify for review
      console.log(`[Arrangement ${config.id}] Requiring review before write`);
      await notifyReviewReady(runId, reviewSessionId);
    }

    // Deduct credits from org balance
    await supabase.rpc('deduct_credits', { org_id: orgId, amount: creditsUsed });

    return {
      success: true,
      recordsProcessed: processedCount,
      successfulRecords: successfulCount,
      failedRecords: failedCount,
      creditsUsed,
    };

  } catch (error) {
    await supabase
      .from('arrangement_runs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

async function getProviderAdapter(provider: string, orgId: string): Promise<ProviderAdapter> {
  switch (provider) {
    case 'apollo': {
      // Apollo: fetch API key from provider_connections
      const { getProviderKey } = await import('../providers/provider-key');
      const apiKey = await getProviderKey(orgId, provider);
      if (!apiKey) {
        throw new Error(`Apollo API key not configured for org ${orgId}`);
      }
      return new ApolloAdapter(apiKey);
    }
    case 'graphiq':
    case 'refyne': {
      // GraphIQ: embedded provider, uses GRAPHIQ_API_KEY env var
      const { GraphiqAdapter } = await import('../providers/graphiq');
      return new GraphiqAdapter();
    }
    case 'zoominfo': {
      // ZoomInfo: uses env var like GraphIQ
      return new ZoomInfoAdapter();
    }
    // Future providers: cognism, etc. will be added here
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('401') || error.message.includes('Unauthorized');
  }
  return false;
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('429') || error.message.includes('rate limit');
  }
  return false;
}

async function fetchSampleRecords(sourceConfig: Record<string, unknown>, limit: number): Promise<any[]> {
  // Stub: would fetch from HubSpot, CSV, etc.
  return DEMO_COMPANIES.slice(0, limit);
}

/**
 * Helper: Fetch with retry logic and Retry-After header support
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  const { calculateRetryDelay } = await import('../hubspot/rate-limiter');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      if (attempt === maxRetries) {
        throw new Error('HubSpot rate limit: max retries exceeded');
      }
      const retryAfter = response.headers.get('Retry-After');
      const waitMs = retryAfter
        ? parseInt(retryAfter) * 1000
        : calculateRetryDelay(attempt);
      console.log(`[HubSpot] 429 rate limit. Waiting ${waitMs}ms. Attempt ${attempt + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      continue;
    }

    return response;
  }
  throw new Error('fetchWithRetry: exhausted retries');
}

/**
 * Fetch companies via Export API (for large portals with crm.export scope)
 */
async function fetchViaExportApi(
  orgId: string,
  portalId: string,
  accessToken: string,
  properties: string[]
): Promise<any[]> {
  const { HubSpotClient } = await import('../hubspot/client');
  const hubspotClient = new HubSpotClient(accessToken, portalId);

  console.log(`[Export API] Fetching companies via Export API for portal ${portalId}`);

  const companies = await hubspotClient.exportCompanies(properties);

  if (!companies) {
    console.warn(`[Export API] Export returned null, falling back to empty array`);
    return [];
  }

  console.log(`[Export API] Export complete. Retrieved ${companies.length} companies`);
  return companies;
}

/**
 * Stream companies via Export API in chunks (memory-efficient).
 * Yields chunks of 50 companies at a time instead of loading all into RAM.
 */
async function* streamViaExportApi(
  orgId: string,
  portalId: string,
  accessToken: string,
  properties: string[],
  chunkSize = 50
): AsyncGenerator<any[]> {
  const { HubSpotClient } = await import('../hubspot/client');
  const hubspotClient = new HubSpotClient(accessToken, portalId);

  console.log(`[Export API Stream] Streaming companies via Export API for portal ${portalId}`);

  let totalYielded = 0;
  for await (const chunk of hubspotClient.exportCompaniesStream(properties, chunkSize)) {
    totalYielded += chunk.length;
    console.log(`[Export API Stream] Yielded chunk: ${chunk.length} companies (total: ${totalYielded})`);
    yield chunk;
  }

  console.log(`[Export API Stream] Complete. Streamed ${totalYielded} companies`);
}

/**
 * Stream companies via pagination (memory-efficient for large datasets)
 * Yields chunks as they're fetched instead of loading all into memory
 */
async function* streamViaPagination(
  accessToken: string,
  properties: string[],
  chunkSize = 50,
  lastProcessedId?: string
): AsyncGenerator<any[]> {
  let after: string | undefined = lastProcessedId;
  let pageCount = 0;
  let buffer: any[] = [];
  let totalFetched = 0;

  console.log(`[Pagination Stream] Streaming companies via pagination`);

  while (true) {
    const searchBody = {
      filterGroups: [],
      properties,
      limit: 100,
      after,
    };

    const response = await fetchWithRetry(
      'https://api.hubapi.com/crm/v3/objects/companies/search',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchBody),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch companies: ${response.statusText}`);
    }

    const data = await response.json();
    const results = data.results ?? [];

    if (results.length === 0) break;

    buffer.push(...results);
    totalFetched += results.length;
    pageCount++;

    console.log(`[Pagination Stream] Page ${pageCount}: fetched ${results.length} companies (total: ${totalFetched})`);

    // Yield chunks when buffer reaches target size
    while (buffer.length >= chunkSize) {
      yield buffer.splice(0, chunkSize);
    }

    // Check if there are more pages
    if (!data.paging?.next?.after) break;
    after = data.paging.next.after;

    // Wait 500ms between pages to avoid rate limit
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Yield remaining companies
  while (buffer.length > 0) {
    yield buffer.splice(0, chunkSize);
  }

  console.log(`[Pagination Stream] Complete. Streamed ${totalFetched} companies across ${pageCount} pages`);
}

/**
 * Fetch companies via pagination (for small portals or when export scope missing)
 * DEPRECATED: Use streamViaPagination for large datasets to avoid memory issues
 */
async function fetchViaPagination(
  accessToken: string,
  properties: string[],
  lastProcessedId?: string
): Promise<any[]> {
  const allRecords: any[] = [];
  let after: string | undefined = lastProcessedId;
  let pageCount = 0;

  console.log(`[Pagination] Fetching companies via pagination`);

  while (true) {
    const searchBody = {
      filterGroups: [],
      properties,
      limit: 100,
      after,
    };

    const response = await fetchWithRetry(
      'https://api.hubapi.com/crm/v3/objects/companies/search',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchBody),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch companies: ${response.statusText}`);
    }

    const data = await response.json();
    const results = data.results ?? [];

    if (results.length === 0) break;

    allRecords.push(...results);
    pageCount++;

    console.log(`[Pagination] Page ${pageCount}: fetched ${results.length} companies (total: ${allRecords.length})`);

    // Check if there are more pages
    if (!data.paging?.next?.after) break;
    after = data.paging.next.after;

    // Wait 500ms between pages to avoid rate limit
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`[Pagination] Complete. Retrieved ${allRecords.length} companies across ${pageCount} pages`);
  return allRecords;
}

async function fetchRecordsForProcessing(
  sourceConfig: Record<string, unknown>,
  lastProcessedId?: string,
  orgId?: string
): Promise<any[]> {
  // Get HubSpot portal from org's connection
  if (!supabase || !orgId) {
    throw new Error('Database or orgId not available');
  }

  const { data: connection, error } = await supabase
    .from('hubspot_connections')
    .select('portal_id, scopes')
    .eq('org_id', orgId)
    .single();

  if (!connection) {
    throw new Error(`HubSpot connection not found for org_id: ${orgId}`);
  }

  const portalId = connection.portal_id;
  const sourceType = sourceConfig.source_type as string;

  // Get HubSpot access token
  const { getAccessToken } = await import('../hubspot/get-access-token');
  const accessToken = await getAccessToken(orgId);

  const properties = [
    'name',
    'domain',
    'website',  // HubSpot has both domain and website properties
    'hs_additional_domains',  // Alternate domains (some portals use this)
    'industry',
    'numberofemployees',
    'annualrevenue',
    'phone',
    'linkedin_company_page',
    'founded_year',
    'city',
    'country',
  ];

  // Handle list-based source
  if (sourceType === 'hubspot_list' && sourceConfig.list_id) {
    const listId = sourceConfig.list_id as string;
    const vidOffset = lastProcessedId ? `&vidOffset=${lastProcessedId}` : '';

    const response = await fetchWithRetry(
      `https://api.hubapi.com/contacts/v1/lists/${listId}/contacts/all?count=100${vidOffset}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch from list ${listId}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.contacts ?? [];
  }

  // For 'all_companies': decide between Export API and Pagination
  const EXPORT_THRESHOLD = 500;

  // Check if crm.export scope is available
  const scopes = connection.scopes as string[] | null;
  const hasExportScope = scopes?.includes('crm.export') ?? false;

  // First, get total company count to decide strategy
  const countResponse = await fetchWithRetry(
    'https://api.hubapi.com/crm/v3/objects/companies/search',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filterGroups: [],
        properties: ['hs_object_id'],
        limit: 1,
      }),
    }
  );

  if (!countResponse.ok) {
    throw new Error(`Failed to fetch company count: ${countResponse.statusText}`);
  }

  const countData = await countResponse.json();
  const totalCompanies = countData.total ?? 0;

  // Determine fetch strategy
  const useExportApi = totalCompanies > EXPORT_THRESHOLD && hasExportScope;

  console.log(
    `[Fetch Strategy] ${useExportApi ? 'Export API' : 'Pagination'} ` +
    `(${totalCompanies} companies, export scope: ${hasExportScope})`
  );

  if (useExportApi) {
    return await fetchViaExportApi(orgId, portalId, accessToken, properties);
  } else {
    return await fetchViaPagination(accessToken, properties, lastProcessedId);
  }
}

async function writeToDestination(
  outputConfig: Record<string, unknown>,
  companyId: string,
  properties: Record<string, unknown>,
  orgId: string
): Promise<void> {
  // Get HubSpot portal from org's connection
  if (!supabase) {
    throw new Error('Database not available');
  }

  const { data: connection } = await supabase
    .from('hubspot_connections')
    .select('portal_id')
    .eq('org_id', orgId)
    .single();

  if (!connection) {
    throw new Error('HubSpot connection not found for write');
  }

  const portalId = connection.portal_id;

  // Get HubSpot access token
  const { getAccessToken } = await import('../hubspot/get-access-token');
  const accessToken = await getAccessToken(orgId);

  // Get HubSpot client
  const { HubSpotClient } = await import('../hubspot/client');
  const client = new HubSpotClient(accessToken, portalId);

  // Convert properties to string values (HubSpot API requirement)
  const cleanedProperties: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === null || value === undefined) {
      cleanedProperties[key] = null;
    } else if (typeof value === 'string' || typeof value === 'number') {
      cleanedProperties[key] = value;
    } else {
      cleanedProperties[key] = String(value);
    }
  }

  // Update the company in HubSpot
  await client.updateCompany(companyId, cleanedProperties);
}

/**
 * Map canonical field names to HubSpot property names.
 */
function mapCanonicalToHubSpot(canonicalField: string): string {
  const mapping: Record<string, string> = {
    'industry': 'industry',
    'employee_count': 'numberofemployees',
    'linkedin_url': 'linkedin_company_page',
    'phone': 'phone',
    'domain': 'domain',
    'revenue': 'annualrevenue',
    'founded_year': 'founded_year',
    'city': 'city',
    'country': 'country',
  };

  return mapping[canonicalField] || canonicalField;
}

/**
 * Map employee count number to HubSpot enum range.
 * Only applies if property is configured as enumeration.
 */
function mapEmployeeCountToEnum(
  count: number | null | undefined,
  validValues?: string[]
): string | number | null {
  if (count === null || count === undefined) return null;

  // If no valid values provided, return raw number
  if (!validValues || validValues.length === 0) return count;

  // Common HubSpot employee count ranges
  const ranges = [
    { max: 1, value: '1' },
    { max: 10, value: '1-10' },
    { max: 50, value: '11-50' },
    { max: 200, value: '51-200' },
    { max: 500, value: '201-500' },
    { max: 1000, value: '501-1000' },
    { max: 5000, value: '1001-5000' },
    { max: 10000, value: '5001-10000' },
    { max: Infinity, value: '10001+' },
  ];

  // Find first range that fits and is in valid values
  for (const range of ranges) {
    if (count <= range.max && validValues.includes(range.value)) {
      return range.value;
    }
  }

  // If no match, return largest valid value
  return validValues[validValues.length - 1] || count;
}

/**
 * Transform value for HubSpot property write.
 * Handles enum validation, number ranges, and format conversions.
 */
/**
 * Transform provider values for HubSpot enum fields.
 *
 * NOTE: Industry mapping is handled by the crosswalk harmony system, not here.
 * This function only handles non-harmony transformations like employee count ranges.
 */
function transformValueForHubSpot(
  hubspotPropertyName: string,
  value: any,
  validValues?: string[]
): any {
  if (value === null || value === undefined) return null;

  // Employee count: map numbers to enum ranges if valid values exist
  if (hubspotPropertyName === 'numberofemployees' && typeof value === 'number') {
    return mapEmployeeCountToEnum(value, validValues);
  }

  // Industry mapping is handled by crosswalk harmony system
  // All other fields pass through as-is
  return value;
}

async function saveCheckpoint(
  runId: string,
  lastProcessedId: string,
  processedCount: number,
  creditsUsed: number
): Promise<void> {
  if (!supabase) return;

  await supabase
    .from('arrangement_runs')
    .update({
      checkpoint_data: {
        lastProcessedId,
        processedCount,
      },
      actual_credits_used: creditsUsed,
    })
    .eq('id', runId);
}

/**
 * Process a single field using field_configs format.
 *
 * Handles aggregation strategies, harmony normalization, and detailed tracking.
 */
async function processFieldConfig(
  fieldConfig: FieldConfig,
  record: any,
  orgId: string,
  currentFieldValue: any,
  mode: 'demo' | 'live'
): Promise<{
  value: any;
  written: boolean;
  skipped: boolean;
  skipReason?: string;
  provider?: string;
  strategy?: string;
  raw?: any;
  normalized?: any;
  metadata?: Record<string, any>;
}> {
  const { field_key, field_type, aggregation_strategy, apply_harmony, harmony_id, steps } = fieldConfig;

  try {
    // Step 1: Collect provider values based on aggregation strategy
    const providerValues: ProviderValue[] = [];

    if (aggregation_strategy === 'waterfall') {
      // For waterfall, query providers in order until we get a value
      for (const step of steps.sort((a, b) => a.order - b.order)) {
        const providerValue = await queryProvider(step.provider, record, field_key, mode, orgId);

        if (providerValue !== null && providerValue !== undefined && providerValue !== '') {
          providerValues.push({
            provider: step.provider,
            value: providerValue,
            order: step.order,
          });

          // For waterfall, we can stop after first non-null value
          const result = waterfallStrategy(providerValues, {
            currentValue: currentFieldValue,
            policy: step.policy,
          });

          if (result) {
            // Check if we should skip due to fill_empty policy
            if (result.source === 'existing') {
              return {
                value: currentFieldValue,
                written: false,
                skipped: true,
                skipReason: result.metadata?.reason,
                metadata: result.metadata,
              };
            }

            // Apply harmony normalization if configured
            if (apply_harmony && harmony_id) {
              const harmonyResult = await normalizeWithHarmony({
                orgId,
                harmonyId: harmony_id,
                rawValue: result.value,
                metadata: {
                  provider: step.provider,
                },
              });

              const finalValue = harmonyResult.matched ? harmonyResult.normalized : result.value;

              return {
                value: finalValue,
                written: true,
                skipped: false,
                provider: result.source,
                raw: result.value,
                normalized: harmonyResult.matched ? harmonyResult.normalized : undefined,
                metadata: {
                  ...result.metadata,
                  harmony: harmonyResult.matched ? {
                    matched: true,
                    harmonyId: harmony_id,
                    outputFormat: harmonyResult.outputFormat,
                  } : { matched: false },
                },
              };
            }

            // No harmony, return raw value
            return {
              value: result.value,
              written: true,
              skipped: false,
              provider: result.source,
              raw: result.value,
              metadata: result.metadata,
            };
          }

          break; // Stop after first value for waterfall
        }
      }
    } else {
      // For other strategies (max, min, average, cluster_average), query all providers
      for (const step of steps) {
        try {
          const providerValue = await queryProvider(step.provider, record, field_key, mode, orgId);

          if (providerValue !== null && providerValue !== undefined && providerValue !== '') {
            providerValues.push({
              provider: step.provider,
              value: providerValue,
              order: step.order,
            });
          }
        } catch (providerError) {
          console.warn(`[Field Processing] Provider ${step.provider} failed for ${field_key}:`, providerError);
          // Continue with other providers
        }
      }

      // Apply aggregation strategy
      let aggregationResult: AggregationResult | null = null;

      switch (aggregation_strategy) {
        case 'max':
          aggregationResult = maxStrategy(providerValues);
          break;
        case 'min':
          aggregationResult = minStrategy(providerValues);
          break;
        case 'average':
          aggregationResult = averageStrategy(providerValues, field_type);
          break;
        case 'cluster_average':
          aggregationResult = clusterAverageStrategy(providerValues, field_type);
          break;
      }

      if (aggregationResult) {
        // For aggregated strategies, always overwrite (policy is ignored)
        // Apply harmony normalization if configured
        if (apply_harmony && harmony_id) {
          const harmonyResult = await normalizeWithHarmony({
            orgId,
            harmonyId: harmony_id,
            rawValue: aggregationResult.value,
            metadata: {
              provider: providerValues[0]?.provider || 'unknown',
            },
          });

          const finalValue = harmonyResult.matched ? harmonyResult.normalized : aggregationResult.value;

          return {
            value: finalValue,
            written: true,
            skipped: false,
            strategy: aggregation_strategy,
            raw: aggregationResult.value,
            normalized: harmonyResult.matched ? harmonyResult.normalized : undefined,
            metadata: {
              ...aggregationResult.metadata,
              harmony: harmonyResult.matched ? {
                matched: true,
                harmonyId: harmony_id,
                outputFormat: harmonyResult.outputFormat,
              } : { matched: false },
            },
          };
        }

        // No harmony, return aggregated value
        return {
          value: aggregationResult.value,
          written: true,
          skipped: false,
          strategy: aggregation_strategy,
          raw: aggregationResult.value,
          metadata: aggregationResult.metadata,
        };
      }
    }

    // No value obtained from any provider
    return {
      value: null,
      written: false,
      skipped: true,
      skipReason: 'No non-null value from any provider',
    };

  } catch (error) {
    console.error(`[Field Processing] Failed to process ${field_key}:`, error);
    return {
      value: null,
      written: false,
      skipped: true,
      skipReason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Two-stage normalization for industry field.
 *
 * Stage 1: Provider value → NAICS code
 * Stage 2: NAICS code → HubSpot enum (via crosswalk)
 *
 * If no HubSpot enum match, returns properties for refyne_* fallback fields.
 */
async function normalizeTwoStage(
  fieldKey: string,
  rawValue: any,
  provider: string,
  orgId: string
): Promise<Record<string, any>> {
  if (fieldKey !== 'industry') {
    // Non-industry fields: return as-is
    return { [fieldKey]: rawValue };
  }

  // Stage 1: Extract NAICS code from provider value
  let naicsCode: string | null = null;
  let naicsLabel: string | null = null;

  if (provider === 'graphiq') {
    // GraphIQ returns NAICS directly in normalized fields
    naicsCode = rawValue?.naics_code || null;
    naicsLabel = rawValue?.naics_name || rawValue?.industry || null;
  } else if (provider === 'apollo') {
    // Apollo returns industry label - look up via crosswalk to get HubSpot value directly
    const apolloLabel = typeof rawValue === 'string' ? rawValue : rawValue?.industry;
    if (apolloLabel) {
      const hubspotValue = await lookupIndustryCrosswalk(apolloLabel, null, 'apollo');
      if (hubspotValue) {
        // Found direct mapping - return it
        console.log(
          `[Normalize] Industry: ${provider} → ${apolloLabel} → ${hubspotValue}`
        );
        return { industry: hubspotValue };
      }
      // No direct mapping - store as fallback
      naicsLabel = apolloLabel;
    }
  }

  // Stage 2: Map NAICS to HubSpot enum via crosswalk
  if (naicsCode) {
    const hubspotValue = await naicsToHubSpot(naicsCode);

    if (hubspotValue) {
      // Success: write to standard industry field
      console.log(
        `[Normalize] Industry: ${provider} → NAICS ${naicsCode} → ${hubspotValue}`
      );
      return { industry: hubspotValue };
    }
  }

  // No HubSpot enum match: write to Refyne fallback fields
  console.log(
    `[Normalize] No HubSpot enum match for NAICS ${naicsCode}. ` +
      `Writing to refyne_industry fallback fields.`
  );

  return {
    refyne_industry: naicsLabel || rawValue,
    refyne_industry_naics: naicsCode,
  };
}

/**
 * Query a provider for a specific field value.
 */
async function queryProvider(
  provider: string,
  record: any,
  fieldKey: string,
  mode: 'demo' | 'live',
  orgId: string
): Promise<any> {
  if (mode === 'demo') {
    // Demo mode: use synthetic data
    const demoResult = getDemoEnrichmentResult(record, provider, [fieldKey]);
    return demoResult[fieldKey];
  }

  // Check if provider can enrich this record (domain-skip routing)
  const canEnrich = canProviderEnrichRecord(provider, record);
  if (!canEnrich) {
    console.log(
      `[Worker] Skipping ${provider} for ${record.id}: ` +
      `domain='${record.properties?.domain ?? 'null'}' website='${record.properties?.website ?? 'null'}'`
    );
    return null;
  }

  // Live mode: acquire rate limit token before making API call
  const limiter = getRateLimiter(orgId, provider);
  await limiter.acquire();

  // Make real API call
  const providerAdapter = await getProviderAdapter(provider, orgId);

  // Use domain-routing helpers to extract domain (checks both 'domain' and 'website' properties)
  const { getDomain, getName } = await import('../enrichment/domain-routing');
  const domain = getDomain(record) ?? undefined;
  const name = getName(record) ?? undefined;

  const result = await providerAdapter.enrichCompany({ domain, name });

  if (result) {
    return result.normalized?.[fieldKey] ?? result.raw[fieldKey];
  }

  return null;
}

/**
 * Generate harmony for a field if not already generated.
 * Uses NAICS crosswalk + Claude fallback.
 */
async function generateHarmonyIfNeeded(
  reviewSessionId: string,
  orgId: string,
  portalId: string,
  fieldKey: string
): Promise<void> {
  if (!supabase) {
    return;
  }

  // Get all pending enrichment values for this field
  const { data: pendingValues } = await supabase
    .from('pending_enrichment_values')
    .select('raw_value, hubspot_value')
    .eq('review_session_id', reviewSessionId)
    .eq('field_key', fieldKey);

  if (!pendingValues || pendingValues.length === 0) {
    return;
  }

  // Get unique enriched values
  const enrichedValues = Array.from(new Set(pendingValues.map(v => v.raw_value).filter(Boolean)));

  // Get valid HubSpot values from field_mappings
  const { data: fieldMapping } = await supabase
    .from('field_mappings')
    .select('valid_values')
    .eq('org_id', orgId)
    .eq('canonical_field', fieldKey)
    .maybeSingle();

  const hubspotValidValues = fieldMapping?.valid_values || [];

  // Generate harmony
  await generateHarmonyForField(
    orgId,
    portalId,
    fieldKey,
    enrichedValues,
    hubspotValidValues
  );

  console.log(`[Harmony] Generated harmony for ${fieldKey} with ${enrichedValues.length} values`);
}

/**
 * Write all pending enrichments from a review session to HubSpot.
 * Streams in batches of 100 records.
 */
async function writeReviewSessionToHubSpot(
  reviewSessionId: string,
  orgId: string,
  accessToken: string,
  portalId: string
): Promise<{ written: number; skipped: number; failed: number }> {
  if (!supabase) {
    return { written: 0, skipped: 0, failed: 0 };
  }

  const { HubSpotClient } = await import('../hubspot/client');
  const hubspotClient = new HubSpotClient(accessToken, portalId);

  // Get all pending enrichment values for this session
  const { data: pendingValues, error } = await supabase
    .from('pending_enrichment_values')
    .select('*')
    .eq('review_session_id', reviewSessionId);

  if (error || !pendingValues) {
    console.error('[WriteSession] Failed to fetch pending values:', error);
    return { written: 0, skipped: 0, failed: 0 };
  }

  // Group by company ID
  const recordsMap = new Map<string, any>();
  for (const value of pendingValues) {
    if (!recordsMap.has(value.hubspot_company_id)) {
      recordsMap.set(value.hubspot_company_id, {
        id: value.hubspot_company_id,
        properties: {},
      });
    }
    const record = recordsMap.get(value.hubspot_company_id)!;

    // Skip null values and no-match confidence
    if (value.hubspot_value && value.confidence !== 'no_match') {
      record.properties[value.hubspot_property] = value.hubspot_value;
    }
  }

  const recordsToWrite = Array.from(recordsMap.values()).filter(
    r => Object.keys(r.properties).length > 0
  );

  let written = 0;
  let failed = 0;

  // Write in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < recordsToWrite.length; i += BATCH_SIZE) {
    const batch = recordsToWrite.slice(i, i + BATCH_SIZE);

    const { results, errors } = await hubspotClient.batchUpdateCompanies(batch);

    written += results.length;
    failed += errors.length;

    if (errors.length > 0) {
      console.error(
        `[WriteSession] Batch write errors (${errors.length} total):`,
        JSON.stringify(errors.slice(0, 3), null, 2)
      );
    }
  }

  // Update review session status
  await supabase
    .from('enrichment_review_sessions')
    .update({
      status: 'written',
      written_at: new Date().toISOString(),
    })
    .eq('id', reviewSessionId);

  console.log(`[WriteSession] Wrote ${written} records to HubSpot (${failed} failed)`);

  return { written, skipped: 0, failed };
}

// ─────────────────────────────────────────────────────────────
// Worker
// ─────────────────────────────────────────────────────────────

/**
 * Start the arrangement worker.
 */
export function startArrangementWorker(): Worker | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - arrangement worker disabled');
    return null;
  }

  if (arrangementWorker) {
    return arrangementWorker;
  }

  const connection = createRedisConnection();

  arrangementWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
      switch (job.name) {
        case 'preflight':
          return processPreflightJob(job as Job<PreflightJobData>);
        case 'rehearsal':
          return processRehearsalJob(job as Job<RehearsalJobData>);
        case 'live-run':
          return processLiveRunJob(job as Job<LiveRunJobData>);
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    },
    {
      connection,
      concurrency: WORKER_CONCURRENCY,
      // Reduce polling overhead for cost optimization
      // BullMQ automatically uses BRPOP with blocking which is efficient
      // These settings reduce overhead when jobs are stalled
      stalledInterval: 30000, // Check for stalled jobs every 30s (default 30s)
      maxStalledCount: 2,     // Mark as stalled after 2 checks (default 1)
    }
  );

  arrangementWorker.on('completed', (job, result) => {
    console.log(`Arrangement job ${job.id} (${job.name}) completed`);
  });

  arrangementWorker.on('failed', (job, error) => {
    console.error(`Arrangement job ${job?.id} (${job?.name}) failed:`, error.message);
  });

  console.log(`Arrangement worker started with concurrency=${WORKER_CONCURRENCY}`);

  return arrangementWorker;
}

/**
 * Stop the arrangement worker.
 */
export async function stopArrangementWorker(): Promise<void> {
  if (arrangementWorker) {
    await arrangementWorker.close();
    arrangementWorker = null;
  }

  if (arrangementQueue) {
    await arrangementQueue.close();
    arrangementQueue = null;
  }
}
