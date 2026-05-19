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

export interface EnrichmentStep {
  provider: string;
  fields: string[];
  order: number;
}

export interface ArrangementConfig {
  id: string;
  name: string;
  source_type: string;
  source_config: Record<string, unknown>;
  enrichment_steps: EnrichmentStep[];
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
          count: 500,
          age: 30 * 24 * 60 * 60, // 30 days
        },
        removeOnFail: {
          count: 1000,
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
  if (supabase) {
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

    // Process each record through enrichment steps
    for (const company of companies) {
      try {
        const enrichedData: Record<string, unknown> = { ...company };
        let recordCredits = 0;

        // Execute enrichment steps in order
        for (const step of config.enrichment_steps.sort((a, b) => a.order - b.order)) {
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

        // Process record through enrichment steps
        const enrichedData: Record<string, unknown> = { ...record };
        let recordCredits = 0;

        for (const step of config.enrichment_steps.sort((a, b) => a.order - b.order)) {
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

        // Write enriched data to output destination
        await writeToDestination(config.output_config, enrichedData);

        successfulCount++;
        creditsUsed += recordCredits;

        // Track progress in database
        await supabase.from('arrangement_run_progress').insert({
          run_id: runId,
          org_id: orgId,
          record_id: record.id,
          status: 'completed',
          enrichment_results: enrichedData,
          credits_used: recordCredits,
          completed_at: new Date().toISOString(),
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
  // Stub: would implement cursor-based pagination
  return [];
}

async function writeToDestination(outputConfig: Record<string, unknown>, data: Record<string, unknown>): Promise<void> {
  // Stub: would write to HubSpot via batch writer
  return;
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
