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

// ─────────────────────────────────────────────────────────────
// Queue Configuration
// ─────────────────────────────────────────────────────────────

const QUEUE_NAME = 'arrangements';

/**
 * Worker concurrency - how many arrangement jobs to process in parallel.
 */
const WORKER_CONCURRENCY = 3;

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
              const provider = getProviderAdapter(step.provider);
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
    // Fetch records (with pagination/cursor from checkpoint)
    const records = await fetchRecordsForProcessing(
      config.source_config,
      checkpointData?.lastProcessedId
    );

    for (const record of records) {
      try {
        // Check if run is paused
        const { data: run } = await supabase
          .from('arrangement_runs')
          .select('status')
          .eq('id', runId)
          .single();

        if (run?.status === 'paused') {
          // Save checkpoint and exit
          await saveCheckpoint(runId, record.id, processedCount, creditsUsed);
          break;
        }

        // Process record
        const enrichedData: Record<string, unknown> = { ...record };
        let recordCredits = 0;
        const fieldDetail: Record<string, any> = {};
        let fieldsAttempted = 0;
        let fieldsWritten = 0;
        let fieldsSkipped = 0;

        if (usingFieldConfigs) {
          // NEW PATH: Use field_configs
          for (const fieldConfig of config.field_configs!) {
            fieldsAttempted++;

            try {
              const result = await processFieldConfig(
                fieldConfig,
                record,
                orgId,
                record[fieldConfig.field_key],
                'live'
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
            } catch (fieldError) {
              console.error(`[Live Run] Field ${fieldConfig.field_key} failed:`, fieldError);
              fieldsSkipped++;
              fieldDetail[fieldConfig.field_key] = {
                skipped: true,
                reason: `Error: ${fieldError instanceof Error ? fieldError.message : 'Unknown error'}`,
              };
            }
          }
        } else {
          // LEGACY PATH: Use enrichment_steps
          for (const step of config.enrichment_steps!.sort((a, b) => a.order - b.order)) {
            try {
              const provider = getProviderAdapter(step.provider);
              const result = await provider.enrichCompany({ domain: record.domain });

              if (result) {
                for (const field of step.fields) {
                  enrichedData[field] = result.normalized?.[field] ?? result.raw[field];
                }
                recordCredits += step.fields.length;
              }

            } catch (providerError) {
              // Handle provider failures
              if (isAuthError(providerError)) {
                // Pause run on 401
                await supabase
                  .from('arrangement_runs')
                  .update({
                    status: 'paused',
                    error_message: 'Provider authentication failed',
                  })
                  .eq('id', runId);

                throw new Error('Provider auth failed - run paused');
              }

              if (isRateLimitError(providerError)) {
                // Backoff on 429
                await new Promise(resolve => setTimeout(resolve, 5000));
                // Retry this step (could be more sophisticated)
              }
            }
          }
        }

        // Write enriched data to output destination
        // Build update payload with only the fields that were written
        const propertiesToWrite: Record<string, unknown> = {};
        for (const fieldKey of Object.keys(fieldDetail)) {
          if (fieldDetail[fieldKey].written) {
            const hubspotPropertyName = mapCanonicalToHubSpot(fieldKey);
            propertiesToWrite[hubspotPropertyName] = enrichedData[fieldKey];
          }
        }

        if (Object.keys(propertiesToWrite).length > 0) {
          await writeToDestination(
            config.output_config,
            record.id,
            propertiesToWrite
          );
        }

        successfulCount++;
        creditsUsed += recordCredits;

        // Track progress in database with detailed field tracking
        await supabase.from('arrangement_run_progress').insert({
          run_id: runId,
          org_id: orgId,
          record_id: record.id,
          status: 'completed',
          enrichment_results: enrichedData,
          credits_used: recordCredits,
          completed_at: new Date().toISOString(),
          result: usingFieldConfigs ? {
            fields_attempted: fieldsAttempted,
            fields_written: fieldsWritten,
            fields_skipped: fieldsSkipped,
            field_detail: fieldDetail,
          } : undefined,
        });

      } catch (error) {
        failedCount++;

        await supabase.from('arrangement_run_progress').insert({
          run_id: runId,
          org_id: orgId,
          record_id: record.id,
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      processedCount++;

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
    }

    // Final update
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

function getProviderAdapter(provider: string): ProviderAdapter {
  switch (provider) {
    case 'apollo':
      return new ApolloAdapter();
    case 'zoominfo':
      return new ZoomInfoAdapter();
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

async function fetchRecordsForProcessing(
  sourceConfig: Record<string, unknown>,
  lastProcessedId?: string
): Promise<any[]> {
  const connectionId = sourceConfig.connection_id as string;
  const sourceType = sourceConfig.source_type as string;

  // Get HubSpot access token
  const { getAccessToken } = await import('../hubspot/get-access-token');
  const accessToken = await getAccessToken(connectionId);

  const properties = [
    'name',
    'domain',
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

    const res = await fetch(
      `https://api.hubapi.com/contacts/v1/lists/${listId}/contacts/all?count=100${vidOffset}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch from list ${listId}: ${res.statusText}`);
    }

    const data = await res.json();
    return data.contacts ?? [];
  }

  // Default: fetch all companies with cursor pagination
  const searchBody = {
    filterGroups: [],
    properties,
    limit: 100,
    after: lastProcessedId ?? undefined,
  };

  const res = await fetch('https://api.hubapi.com/crm/v3/objects/companies/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(searchBody),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch companies: ${res.statusText}`);
  }

  const data = await res.json();
  return data.results ?? [];
}

async function writeToDestination(
  outputConfig: Record<string, unknown>,
  companyId: string,
  properties: Record<string, unknown>
): Promise<void> {
  const connectionId = outputConfig.connection_id as string;

  // Get HubSpot access token
  const { getAccessToken } = await import('../hubspot/get-access-token');
  const accessToken = await getAccessToken(connectionId);

  // Get HubSpot client
  const { HubSpotClient } = await import('../hubspot/client');
  const client = new HubSpotClient(accessToken, connectionId);

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
        const providerValue = await queryProvider(step.provider, record, field_key, mode);

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
          const providerValue = await queryProvider(step.provider, record, field_key, mode);

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
 * Query a provider for a specific field value.
 */
async function queryProvider(
  provider: string,
  record: any,
  fieldKey: string,
  mode: 'demo' | 'live'
): Promise<any> {
  if (mode === 'demo') {
    // Demo mode: use synthetic data
    const demoResult = getDemoEnrichmentResult(record, provider, [fieldKey]);
    return demoResult[fieldKey];
  }

  // Live mode: make real API call
  const providerAdapter = getProviderAdapter(provider);
  const result = await providerAdapter.enrichCompany({ domain: record.domain });

  if (result) {
    return result.normalized?.[fieldKey] ?? result.raw[fieldKey];
  }

  return null;
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
