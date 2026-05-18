/**
 * Compliance Scanner
 *
 * BullMQ job that runs the normalization pipeline in scan mode
 * on all records in a portal without writing back to HubSpot.
 * Used for initial backfill and nightly refresh.
 */

import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection, isRedisConfigured } from '../queue/redis';
import { supabase, isSupabaseConfigured } from '../db/supabase';
import { createHubSpotClient, type HubSpotClient } from '../hubspot/client';
import { getHarmoniesByEntity, getHarmonyById, loadLibraryHarmonies } from '../harmonies/library';
import { Normalizer } from '../harmonies/pipeline/normalizer';
import type { ValidatedHarmony } from '../harmonies/spec/schema';
import type { RawCandidate } from '../harmonies/pipeline/types';
import type {
  ScanResult,
  NormalizedRecordInput,
  ComplianceStatus,
} from './types';
import { getScore, storeScoreHistory } from './compliance-score';
import { generateInsights } from './insight-generator';
import { evaluateAlerts } from './alert-evaluator';

// ─────────────────────────────────────────────────────────────
// Queue Configuration
// ─────────────────────────────────────────────────────────────

const QUEUE_NAME = 'compliance-scan';

/**
 * Worker concurrency - keep low to avoid HubSpot rate limits.
 */
const WORKER_CONCURRENCY = 1;

/**
 * Fields to process for company records.
 */
const COMPANY_FIELDS = [
  'name',
  'domain',
  'industry',
  'employee_count',
  'annual_revenue',
  'hq_city',
  'hq_state',
  'hq_country',
  'phone',
  'linkedin_url',
];

// ─────────────────────────────────────────────────────────────
// Job Types
// ─────────────────────────────────────────────────────────────

export interface ScanJobData {
  orgId: string;
  accessToken: string;
  hasExportScope?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Queue Instance
// ─────────────────────────────────────────────────────────────

let scanQueue: Queue<ScanJobData, ScanResult> | null = null;
let scanWorker: Worker<ScanJobData, ScanResult> | null = null;

/**
 * Get or create the compliance scan queue.
 */
export function getScanQueue(): Queue<ScanJobData, ScanResult> | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - compliance scan queue disabled');
    return null;
  }

  if (!scanQueue) {
    const connection = createRedisConnection();
    scanQueue = new Queue<ScanJobData, ScanResult>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000, // 30s, 60s, 120s
        },
        removeOnComplete: {
          count: 100,
          age: 7 * 24 * 60 * 60, // 7 days
        },
        removeOnFail: {
          count: 500,
          age: 30 * 24 * 60 * 60, // 30 days
        },
      },
    });
  }

  return scanQueue;
}

/**
 * Enqueue a compliance scan job.
 */
export async function enqueueScan(
  orgId: string,
  accessToken: string,
  hasExportScope = false
): Promise<{ queued: boolean; jobId?: string; reason?: string }> {
  const queue = getScanQueue();

  if (!queue) {
    return { queued: false, reason: 'Queue not configured' };
  }

  const jobId = `scan:${orgId}:${Date.now()}`;

  try {
    const job = await queue.add(
      'compliance-scan',
      { orgId, accessToken, hasExportScope },
      { jobId }
    );

    return { queued: true, jobId: job.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { queued: false, reason: message };
  }
}

// ─────────────────────────────────────────────────────────────
// Core Scan Logic
// ─────────────────────────────────────────────────────────────

/**
 * Run a compliance scan for an organization.
 * This is the main scan function called by the worker.
 */
export async function runComplianceScan(
  orgId: string,
  accessToken: string,
  hasExportScope = false,
  options?: {
    since?: Date;
    mode?: 'full' | 'incremental';
  }
): Promise<ScanResult> {
  const startTime = Date.now();
  const mode = options?.mode || 'full';
  const since = options?.since;

  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase not configured');
  }

  // Load harmonies
  loadLibraryHarmonies();
  const companyHarmonies = getHarmoniesByEntity('company');

  // Build harmony version map for stale detection
  const currentVersions = new Map<string, string>();
  for (const harmony of companyHarmonies) {
    currentVersions.set(harmony.spec.id, harmony.spec.version);
  }

  // Create HubSpot client
  const clientResult = await createHubSpotClient(accessToken);
  if ('error' in clientResult) {
    throw new Error(`HubSpot client error: ${clientResult.error}`);
  }
  const { client } = clientResult;

  // Fetch companies (filtered by lastmodifieddate if incremental)
  const filterTimestamp = mode === 'incremental' && since ? since.getTime() : undefined;
  console.log(`[Compliance Scan] Starting ${mode} scan for org ${orgId}${filterTimestamp ? ` (since ${since?.toISOString()})` : ''}`);
  const companyIndex = await client.buildCompanyIndex(hasExportScope, orgId, filterTimestamp);
  console.log(`[Compliance Scan] Loaded ${companyIndex.totalCompanies} companies`);

  let recordsScanned = 0;
  let fieldsProcessed = 0;
  let compliantCount = 0;
  let staleCount = 0;
  let unprocessedCount = 0;

  // Batch buffer for normalized_records inserts
  const BATCH_SIZE = 500;
  let batchBuffer: Array<{
    org_id: string;
    record_id: string;
    record_type: string;
    source: string | null;
    field: string;
    raw_value: string | null;
    normalized_value: string | null;
    harmony_id: string | null;
    harmony_version: string | null;
    status: ComplianceStatus;
    normalized_at: string | null;
    updated_at: string;
  }> = [];

  // Process each company
  for (const [hubspotId, entry] of Array.from(companyIndex.companyMap.entries())) {
    const properties = entry.rawProperties || {};

    // Process each field
    for (const field of COMPANY_FIELDS) {
      const rawValue = properties[field] as string | undefined;

      // Find applicable harmony for this field
      const harmony = findHarmonyForField(field, companyHarmonies);

      if (!harmony) {
        // No harmony for this field - mark as unprocessed if there's a value
        if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
          const now = new Date().toISOString();
          batchBuffer.push({
            org_id: orgId,
            record_id: hubspotId,
            record_type: 'company',
            source: null,
            field,
            raw_value: String(rawValue),
            normalized_value: null,
            harmony_id: null,
            harmony_version: null,
            status: 'unprocessed',
            normalized_at: null,
            updated_at: now,
          });

          if (batchBuffer.length >= BATCH_SIZE) {
            await flushBatch(batchBuffer);
            batchBuffer = [];
          }

          unprocessedCount++;
          fieldsProcessed++;
        }
        continue;
      }

      // Run normalization in dry-run mode (no HubSpot write)
      const normalizedResult = await normalizeField(
        field,
        rawValue,
        harmony,
        properties
      );

      // Determine status
      const currentVersion = currentVersions.get(harmony.spec.id);
      let status: ComplianceStatus = 'compliant';

      if (normalizedResult === null) {
        // Harmony didn't match - unprocessed
        status = 'unprocessed';
        unprocessedCount++;
      } else {
        // Check if version is current
        status = 'compliant';
        compliantCount++;
      }

      const now = new Date().toISOString();
      batchBuffer.push({
        org_id: orgId,
        record_id: hubspotId,
        record_type: 'company',
        source: 'hubspot',
        field,
        raw_value: rawValue !== undefined ? String(rawValue) : null,
        normalized_value: normalizedResult,
        harmony_id: harmony.spec.id,
        harmony_version: harmony.spec.version,
        status,
        normalized_at: status === 'compliant' ? now : null,
        updated_at: now,
      });

      if (batchBuffer.length >= BATCH_SIZE) {
        await flushBatch(batchBuffer);
        batchBuffer = [];
      }

      fieldsProcessed++;
    }

    recordsScanned++;

    // Log progress every 100 records
    if (recordsScanned % 100 === 0) {
      console.log(`[Compliance Scan] Processed ${recordsScanned} records...`);
    }
  }

  // Flush remaining batch
  if (batchBuffer.length > 0) {
    await flushBatch(batchBuffer);
  }

  // Update stale statuses
  staleCount = await updateStaleStatuses(orgId, currentVersions);

  // Compute score based on mode
  let score;
  if (mode === 'incremental' && since) {
    // Incremental: get current score (already updated via batch inserts)
    score = await getScore(orgId);
  } else {
    // Full scan: recompute score
    score = await getScore(orgId);
  }
  await storeScoreHistory(orgId, score);

  // Generate insights
  const insightsGenerated = await generateInsights(orgId);

  // Evaluate alerts
  const alertResult = await evaluateAlerts(orgId);

  const durationMs = Date.now() - startTime;
  console.log(`[Compliance Scan] Completed in ${durationMs}ms: ${recordsScanned} records, ${fieldsProcessed} fields`);

  return {
    orgId,
    recordsScanned,
    fieldsProcessed,
    compliantCount,
    staleCount,
    unprocessedCount,
    insightsGenerated,
    alertsTriggered: alertResult.triggered,
    durationMs,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Find the harmony that applies to a specific field.
 */
function findHarmonyForField(
  field: string,
  harmonies: ValidatedHarmony[]
): ValidatedHarmony | null {
  // Map canonical field names to harmony field paths
  const fieldMapping: Record<string, string> = {
    name: 'company.name',
    domain: 'company.domain',
    industry: 'company.industry',
    employee_count: 'company.employees',
    annual_revenue: 'company.revenue',
    hq_city: 'address.city',
    hq_state: 'address.state',
    hq_country: 'address.country',
    phone: 'phone',
    linkedin_url: 'linkedin_url',
  };

  const harmonyField = fieldMapping[field];
  if (!harmonyField) return null;

  return harmonies.find((h) =>
    h.spec.applies_to.fields.includes(harmonyField)
  ) || null;
}

/**
 * Normalize a single field value using a harmony.
 */
async function normalizeField(
  field: string,
  rawValue: string | undefined,
  harmony: ValidatedHarmony,
  record: Record<string, unknown>
): Promise<string | null> {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return null;
  }

  const normalizer = new Normalizer([harmony]);

  const candidate: RawCandidate = {
    value: rawValue,
    source: 'hubspot',
    retrieved_at: new Date().toISOString(),
    record,
  };

  const result = await normalizer.normalize(candidate);

  if (result.success && result.candidate) {
    const normalized = result.candidate.value;
    return normalized !== undefined && normalized !== null
      ? String(normalized)
      : null;
  }

  return null;
}

/**
 * Upsert a normalized record.
 */
/**
 * Flush batch buffer to normalized_records table.
 */
async function flushBatch(
  batch: Array<{
    org_id: string;
    record_id: string;
    record_type: string;
    source: string | null;
    field: string;
    raw_value: string | null;
    normalized_value: string | null;
    harmony_id: string | null;
    harmony_version: string | null;
    status: ComplianceStatus;
    normalized_at: string | null;
    updated_at: string;
  }>
): Promise<void> {
  if (!supabase || batch.length === 0) return;

  const { error } = await supabase
    .from('normalized_records')
    .upsert(batch, { onConflict: 'org_id,record_id,field' });

  if (error) {
    console.error('Error batch upserting normalized records:', error);
  }
}

async function upsertNormalizedRecord(
  input: NormalizedRecordInput,
  status: ComplianceStatus
): Promise<void> {
  if (!supabase) return;

  const now = new Date().toISOString();

  const { error } = await supabase
    .from('normalized_records')
    .upsert(
      {
        org_id: input.orgId,
        record_id: input.recordId,
        record_type: input.recordType,
        source: input.source || null,
        field: input.field,
        raw_value: input.rawValue,
        normalized_value: input.normalizedValue,
        harmony_id: input.harmonyId,
        harmony_version: input.harmonyVersion,
        status,
        normalized_at: status === 'compliant' ? now : null,
        updated_at: now,
      },
      { onConflict: 'org_id,record_id,field' }
    );

  if (error) {
    console.error('Error upserting normalized record:', error);
  }
}

/**
 * Update stale statuses for records where harmony version doesn't match.
 */
async function updateStaleStatuses(
  orgId: string,
  currentVersions: Map<string, string>
): Promise<number> {
  if (!supabase) return 0;

  let staleCount = 0;

  // For each harmony, update records where version doesn't match
  for (const [harmonyId, currentVersion] of Array.from(currentVersions.entries())) {
    const { data, error } = await supabase
      .from('normalized_records')
      .update({ status: 'stale', updated_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .eq('harmony_id', harmonyId)
      .neq('harmony_version', currentVersion)
      .eq('status', 'compliant')
      .select('id');

    if (error) {
      console.error(`Error updating stale status for ${harmonyId}:`, error);
      continue;
    }

    staleCount += data?.length || 0;
  }

  return staleCount;
}

// ─────────────────────────────────────────────────────────────
// Worker
// ─────────────────────────────────────────────────────────────

/**
 * Process a scan job.
 */
async function processScanJob(
  job: Job<ScanJobData, ScanResult>
): Promise<ScanResult> {
  const { orgId, accessToken, hasExportScope } = job.data;

  console.log(`[Compliance Worker] Processing scan job for org ${orgId}`);

  return runComplianceScan(orgId, accessToken, hasExportScope);
}

/**
 * Start the compliance scan worker.
 */
export function startScanWorker(): Worker<ScanJobData, ScanResult> | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - compliance scan worker disabled');
    return null;
  }

  if (scanWorker) {
    return scanWorker;
  }

  const connection = createRedisConnection();

  scanWorker = new Worker<ScanJobData, ScanResult>(
    QUEUE_NAME,
    processScanJob,
    {
      connection,
      concurrency: WORKER_CONCURRENCY,
    }
  );

  scanWorker.on('completed', (job, result) => {
    console.log(
      `[Compliance Worker] Job ${job.id} completed: ` +
      `${result.recordsScanned} records in ${result.durationMs}ms`
    );
  });

  scanWorker.on('failed', (job, error) => {
    console.error(`[Compliance Worker] Job ${job?.id} failed:`, error.message);
  });

  scanWorker.on('error', (error) => {
    console.error('[Compliance Worker] Worker error:', error);
  });

  console.log(`[Compliance Worker] Started with concurrency=${WORKER_CONCURRENCY}`);

  return scanWorker;
}

/**
 * Stop the compliance scan worker.
 */
export async function stopScanWorker(): Promise<void> {
  if (scanWorker) {
    await scanWorker.close();
    scanWorker = null;
  }

  if (scanQueue) {
    await scanQueue.close();
    scanQueue = null;
  }
}

/**
 * Get scan queue statistics.
 */
export async function getScanQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
} | null> {
  const queue = getScanQueue();
  if (!queue) return null;

  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}
