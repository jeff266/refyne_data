/**
 * Company Dedup Scanner
 *
 * BullMQ job that scans all companies in a portal to detect duplicates.
 * Uses company-signals.ts for pair evaluation.
 */

import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection, isRedisConfigured } from '../queue/redis';
import { supabase, isSupabaseConfigured } from '../db/supabase';
import { createHubSpotClient } from '../hubspot/client';
import { evaluateCompanyPair, type CompanyProperties, normalizeDomain } from './company-signals';
import type { FiredSignal, PairGrade } from './types';

// ─────────────────────────────────────────────────────────────
// Queue Configuration
// ─────────────────────────────────────────────────────────────

const QUEUE_NAME = 'company-dedup-scan';

/**
 * Worker concurrency - keep low to avoid HubSpot rate limits.
 */
const WORKER_CONCURRENCY = 1;

/**
 * Company properties to fetch for dedup analysis.
 */
const COMPANY_PROPERTIES = [
  'name',
  'domain',
  'phone',
  'industry',
  'linkedin_company_page',
] as const;

// ─────────────────────────────────────────────────────────────
// Job Types
// ─────────────────────────────────────────────────────────────

export interface CompanyDedupScanJobData {
  orgId: string;
  accessToken: string;
  connectionId: string;
  initiatedBy: string;
}

export interface CompanyDedupScanResult {
  orgId: string;
  companiesScanned: number;
  pairsDetected: number;
  pairsGradeA: number;
  pairsGradeB: number;
  pairsGradeC: number;
  pairsGradeD: number;
  durationMs: number;
  completedAt: string;
}

// ─────────────────────────────────────────────────────────────
// Queue Instance
// ─────────────────────────────────────────────────────────────

let scanQueue: Queue<CompanyDedupScanJobData, CompanyDedupScanResult> | null = null;
let scanWorker: Worker<CompanyDedupScanJobData, CompanyDedupScanResult> | null = null;

/**
 * Get or create the company dedup scan queue.
 */
export function getCompanyDedupScanQueue(): Queue<CompanyDedupScanJobData, CompanyDedupScanResult> | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - company dedup scan queue disabled');
    return null;
  }

  if (!scanQueue) {
    const connection = createRedisConnection();
    scanQueue = new Queue<CompanyDedupScanJobData, CompanyDedupScanResult>(QUEUE_NAME, {
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
 * Enqueue a company dedup scan job.
 */
export async function enqueueCompanyDedupScan(
  orgId: string,
  accessToken: string,
  connectionId: string,
  initiatedBy: string
): Promise<{ queued: boolean; jobId?: string; reason?: string }> {
  const queue = getCompanyDedupScanQueue();

  if (!queue) {
    return { queued: false, reason: 'Queue not configured' };
  }

  if (!isSupabaseConfigured() || !supabase) {
    return { queued: false, reason: 'Database not configured' };
  }

  const jobId = `company-dedup:${orgId}:${Date.now()}`;

  try {
    const job = await queue.add(
      'company-dedup-scan',
      { orgId, accessToken, connectionId, initiatedBy },
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
 * Normalize domain for blocking key.
 * Returns null if domain is in exclusion list.
 */
function getDomainBlockingKey(
  domain: string | null,
  excludedDomains: Set<string>
): string | null {
  if (!domain) return null;
  const normalized = normalizeDomain(domain);
  if (!normalized) return null;

  // Skip domains in exclusion list (social media, directories, etc.)
  if (excludedDomains.has(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Get phone prefix for blocking key.
 */
function getPhoneBlockingKey(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(0, 7) : null;
}

/**
 * Get name prefix for blocking key.
 */
function getNameBlockingKey(name: string | null): string | null {
  if (!name) return null;
  const cleaned = name.toLowerCase().trim();
  return cleaned.length >= 4 ? cleaned.slice(0, 4) : null;
}

/**
 * Fetch all companies from HubSpot.
 */
async function fetchAllCompanies(
  accessToken: string,
  portalId: string,
  job?: Job<CompanyDedupScanJobData, CompanyDedupScanResult>
): Promise<Map<string, CompanyProperties>> {
  const clientResult = await createHubSpotClient(accessToken);
  if ('error' in clientResult) {
    throw new Error(`HubSpot client error: ${clientResult.error}`);
  }
  const { client } = clientResult;

  const companies = new Map<string, CompanyProperties>();
  let after: string | undefined;
  let totalFetched = 0;
  let estimatedTotal = 0;

  do {
    const response = await client.request<{
      results: Array<{
        id: string;
        properties: Record<string, string | null>;
      }>;
      paging?: { next?: { after: string } };
      total?: number;
    }>(
      `/crm/v3/objects/companies?properties=${COMPANY_PROPERTIES.join(',')}&limit=100${after ? `&after=${after}` : ''}`,
      { method: 'GET' }
    );

    for (const company of response.results) {
      companies.set(company.id, {
        name: company.properties.name || null,
        domain: company.properties.domain || null,
        phone: company.properties.phone || null,
        industry: company.properties.industry || null,
        linkedin_company_page: company.properties.linkedin_company_page || null,
      });
    }

    totalFetched += response.results.length;

    // Use total from first response if available, otherwise estimate
    if (response.total !== undefined && estimatedTotal === 0) {
      estimatedTotal = response.total;
    }

    // Emit progress for each page
    if (job) {
      const progress = estimatedTotal > 0
        ? Math.min(49, (totalFetched / estimatedTotal) * 50)
        : Math.min(49, totalFetched / 100 * 2); // Fallback estimation

      await job.updateProgress({
        phase: 'progress',
        message: 'Loading companies...',
        progress,
        pairsFound: 0,
      });
    }

    after = response.paging?.next?.after;
  } while (after);

  return companies;
}

/**
 * Run a company dedup scan for an organization.
 */
export async function runCompanyDedupScan(
  orgId: string,
  accessToken: string,
  connectionId: string,
  job?: Job<CompanyDedupScanJobData, CompanyDedupScanResult>
): Promise<CompanyDedupScanResult> {
  const startTime = Date.now();

  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase not configured');
  }

  // Get portal ID from connection
  const { data: connection, error: connError } = await supabase
    .from('hubspot_connections')
    .select('portal_id')
    .eq('id', connectionId)
    .single();

  if (connError || !connection) {
    throw new Error(`Connection not found: ${connError?.message}`);
  }

  const portalId = connection.portal_id;

  console.log(`[Company Dedup Scan] Starting scan for org ${orgId}, portal ${portalId}`);

  // Emit started progress
  if (job) {
    await job.updateProgress({
      phase: 'started',
      message: 'Initializing scan...',
      progress: 0,
      pairsFound: 0,
    });
  }

  // Fetch domain exclusions for this org
  const { data: exclusions } = await supabase
    .from('dedup_domain_exclusions')
    .select('domain')
    .eq('org_id', orgId);

  const excludedDomains = new Set(exclusions?.map(e => e.domain) || []);
  console.log(`[Company Dedup Scan] Loaded ${excludedDomains.size} excluded domains`);

  // Fetch all companies
  const companies = await fetchAllCompanies(accessToken, portalId, job);
  console.log(`[Company Dedup Scan] Loaded ${companies.size} companies`);

  // Emit progress after loading companies
  if (job) {
    await job.updateProgress({
      phase: 'started',
      message: `Scanning ${companies.size} companies`,
      progress: 0,
      pairsFound: 0,
    });
  }

  let pairsEvaluated = 0;
  let pairsDetected = 0;
  let pairsGradeA = 0;
  let pairsGradeB = 0;
  let pairsGradeC = 0;
  let pairsGradeD = 0;

  // Build blocking keys for efficient pair generation
  const domainIndex = new Map<string, string[]>();
  const phoneIndex = new Map<string, string[]>();
  const nameIndex = new Map<string, string[]>();

  for (const [id, company] of Array.from(companies.entries())) {
    // Domain blocking (excludes social media/directory domains)
    const domainKey = getDomainBlockingKey(company.domain, excludedDomains);
    if (domainKey) {
      if (!domainIndex.has(domainKey)) {
        domainIndex.set(domainKey, []);
      }
      domainIndex.get(domainKey)!.push(id);
    }

    // Phone blocking
    const phoneKey = getPhoneBlockingKey(company.phone);
    if (phoneKey) {
      if (!phoneIndex.has(phoneKey)) {
        phoneIndex.set(phoneKey, []);
      }
      phoneIndex.get(phoneKey)!.push(id);
    }

    // Name prefix blocking
    const nameKey = getNameBlockingKey(company.name);
    if (nameKey) {
      if (!nameIndex.has(nameKey)) {
        nameIndex.set(nameKey, []);
      }
      nameIndex.get(nameKey)!.push(id);
    }
  }

  // Track seen pairs to avoid duplicates
  const seenPairs = new Set<string>();

  // Generate candidate pairs from blocking keys
  const candidatePairs: Array<[string, string]> = [];

  // Domain index (highest priority)
  for (const ids of Array.from(domainIndex.values())) {
    if (ids.length > 1) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const pairKey = [ids[i], ids[j]].sort().join('|');
          if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey);
            candidatePairs.push([ids[i], ids[j]]);
          }
        }
      }
    }
  }

  // Phone index
  for (const ids of Array.from(phoneIndex.values())) {
    if (ids.length > 1) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const pairKey = [ids[i], ids[j]].sort().join('|');
          if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey);
            candidatePairs.push([ids[i], ids[j]]);
          }
        }
      }
    }
  }

  // Name prefix index
  for (const ids of Array.from(nameIndex.values())) {
    if (ids.length > 1) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const pairKey = [ids[i], ids[j]].sort().join('|');
          if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey);
            candidatePairs.push([ids[i], ids[j]]);
          }
        }
      }
    }
  }

  console.log(`[Company Dedup Scan] Generated ${candidatePairs.length} candidate pairs`);

  const totalPairs = candidatePairs.length;

  // Emit progress before evaluation starts
  if (job) {
    await job.updateProgress({
      phase: 'progress',
      message: 'Checking domain matches...',
      progress: 50,
      pairsFound: 0,
    });
  }

  // Evaluate each candidate pair
  for (const [idA, idB] of candidatePairs) {
    const companyA = companies.get(idA);
    const companyB = companies.get(idB);

    if (!companyA || !companyB) continue;

    const evaluation = evaluateCompanyPair(companyA, companyB);

    // Only store pairs with confidence >= 65 (Grade C or better)
    if (evaluation.confidence >= 65) {
      // Store pair in database
      const { error } = await supabase
        .from('dedup_pairs')
        .upsert({
          org_id: orgId,
          connection_id: connectionId,
          portal_id: portalId,
          record_a_id: idA,
          record_b_id: idB,
          confidence: evaluation.confidence,
          grade: evaluation.grade,
          name_similarity: evaluation.nameSimilarity,
          signals_fired: evaluation.signalsFired,
          status: 'pending',
          detected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'org_id,record_a_id,record_b_id' });

      if (error) {
        console.error('[Company Dedup Scan] Failed to store dedup pair:', error);
        continue;
      }

      pairsDetected++;
      if (evaluation.grade === 'A') pairsGradeA++;
      else if (evaluation.grade === 'B') pairsGradeB++;
      else if (evaluation.grade === 'C') pairsGradeC++;
      else if (evaluation.grade === 'D') pairsGradeD++;
    }

    pairsEvaluated++;

    // Emit progress every 100 pairs
    if (job && pairsEvaluated % 100 === 0) {
      const evaluationProgress = totalPairs > 0
        ? (pairsEvaluated / totalPairs) * 50
        : 0;

      const message = pairsEvaluated < totalPairs / 2
        ? 'Evaluating name similarity...'
        : 'Calculating confidence scores...';

      await job.updateProgress({
        phase: 'progress',
        message,
        progress: 50 + evaluationProgress,
        pairsFound: pairsDetected,
      });

      console.log(`[Company Dedup Scan] Evaluated ${pairsEvaluated} pairs...`);
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(`[Company Dedup Scan] Completed in ${durationMs}ms: ${pairsEvaluated} pairs evaluated, ${pairsDetected} duplicates found (A:${pairsGradeA} B:${pairsGradeB} C:${pairsGradeC})`);

  // Emit completion progress
  if (job) {
    await job.updateProgress({
      phase: 'completed',
      message: `Found ${pairsDetected} duplicate pairs`,
      progress: 100,
      pairsFound: pairsDetected,
      gradeBreakdown: {
        A: pairsGradeA,
        B: pairsGradeB,
        C: pairsGradeC,
        D: pairsGradeD,
      },
    });
  }

  return {
    orgId,
    companiesScanned: companies.size,
    pairsDetected,
    pairsGradeA,
    pairsGradeB,
    pairsGradeC,
    pairsGradeD,
    durationMs,
    completedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// Worker
// ─────────────────────────────────────────────────────────────

/**
 * Process a company dedup scan job.
 */
async function processScanJob(
  job: Job<CompanyDedupScanJobData, CompanyDedupScanResult>
): Promise<CompanyDedupScanResult> {
  const { orgId, accessToken, connectionId, initiatedBy } = job.data;

  console.log(`[Company Dedup Worker] Processing scan job for org ${orgId}, user ${initiatedBy}`);

  try {
    const result = await runCompanyDedupScan(orgId, accessToken, connectionId, job);
    return result;
  } catch (error) {
    console.error(`[Company Dedup Worker] Scan failed:`, error);
    throw error;
  }
}

/**
 * Start the company dedup scan worker.
 */
export function startCompanyDedupScanWorker(): Worker<CompanyDedupScanJobData, CompanyDedupScanResult> | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - company dedup scan worker disabled');
    return null;
  }

  if (scanWorker) {
    return scanWorker;
  }

  const connection = createRedisConnection();

  scanWorker = new Worker<CompanyDedupScanJobData, CompanyDedupScanResult>(
    QUEUE_NAME,
    processScanJob,
    {
      connection,
      concurrency: WORKER_CONCURRENCY,
    }
  );

  scanWorker.on('completed', (job, result) => {
    console.log(
      `[Company Dedup Worker] Job ${job.id} completed: ` +
      `${result.companiesScanned} companies scanned, ${result.pairsDetected} duplicates found in ${result.durationMs}ms`
    );
  });

  scanWorker.on('failed', (job, error) => {
    console.error(`[Company Dedup Worker] Job ${job?.id} failed:`, error.message);
  });

  scanWorker.on('error', (error) => {
    console.error('[Company Dedup Worker] Worker error:', error);
  });

  console.log(`[Company Dedup Worker] Started with concurrency=${WORKER_CONCURRENCY}`);

  return scanWorker;
}

/**
 * Stop the company dedup scan worker.
 */
export async function stopCompanyDedupScanWorker(): Promise<void> {
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
export async function getCompanyDedupScanQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
} | null> {
  const queue = getCompanyDedupScanQueue();
  if (!queue) return null;

  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}
