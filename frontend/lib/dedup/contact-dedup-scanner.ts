/**
 * Contact Dedup Scanner
 *
 * BullMQ job that scans all contacts in a portal to detect duplicates.
 * Uses contact-signals.ts for pair evaluation.
 */

import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection, isRedisConfigured } from '../queue/redis';
import { supabase, isSupabaseConfigured } from '../db/supabase';
import { createHubSpotClient } from '../hubspot/client';
import { evaluateContactPair, type ContactProperties } from './contact-signals';
import type { FiredSignal, PairGrade } from './types';

// ─────────────────────────────────────────────────────────────
// Queue Configuration
// ─────────────────────────────────────────────────────────────

const QUEUE_NAME = 'contact-dedup-scan';

/**
 * Worker concurrency - keep low to avoid HubSpot rate limits.
 */
const WORKER_CONCURRENCY = parseInt(process.env.DEDUP_WORKER_CONCURRENCY ?? '3', 10);

/**
 * Contact properties to fetch for dedup analysis.
 */
const CONTACT_PROPERTIES = [
  'email',
  'firstname',
  'lastname',
  'phone',
  'jobtitle',
  'company',
  'hs_linkedinid',
] as const;

// ─────────────────────────────────────────────────────────────
// Job Types
// ─────────────────────────────────────────────────────────────

export interface ContactDedupScanJobData {
  orgId: string;
  accessToken: string;
  connectionId: string;
  initiatedBy: string;
}

export interface ContactDedupScanResult {
  orgId: string;
  contactsScanned: number;
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

let scanQueue: Queue<ContactDedupScanJobData, ContactDedupScanResult> | null = null;
let scanWorker: Worker<ContactDedupScanJobData, ContactDedupScanResult> | null = null;

/**
 * Get or create the contact dedup scan queue.
 */
export function getContactDedupScanQueue(): Queue<ContactDedupScanJobData, ContactDedupScanResult> | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - contact dedup scan queue disabled');
    return null;
  }

  if (!scanQueue) {
    const connection = createRedisConnection();
    scanQueue = new Queue<ContactDedupScanJobData, ContactDedupScanResult>(QUEUE_NAME, {
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
 * Enqueue a contact dedup scan job.
 */
export async function enqueueContactDedupScan(
  orgId: string,
  accessToken: string,
  connectionId: string,
  initiatedBy: string
): Promise<{ queued: boolean; jobId?: string; runId?: string; reason?: string }> {
  const queue = getContactDedupScanQueue();

  if (!queue) {
    return { queued: false, reason: 'Queue not configured' };
  }

  if (!isSupabaseConfigured() || !supabase) {
    return { queued: false, reason: 'Database not configured' };
  }

  // Create run record
  const { data: run, error: runError } = await supabase
    .from('contact_dedup_runs')
    .insert({
      org_id: orgId,
      connection_id: connectionId,
      initiated_by: initiatedBy,
      status: 'running',
    })
    .select('id')
    .single();

  if (runError || !run) {
    console.error('Failed to create dedup run:', runError);
    return { queued: false, reason: 'Failed to create run record' };
  }

  const jobId = `contact-dedup:${orgId}:${run.id}`;

  try {
    const job = await queue.add(
      'contact-dedup-scan',
      { orgId, accessToken, connectionId, initiatedBy },
      { jobId }
    );

    return { queued: true, jobId: job.id, runId: run.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { queued: false, reason: message };
  }
}

// ─────────────────────────────────────────────────────────────
// Core Scan Logic
// ─────────────────────────────────────────────────────────────

/**
 * Fetch all contacts from HubSpot.
 */
async function fetchAllContacts(
  accessToken: string,
  portalId: string
): Promise<Map<string, ContactProperties>> {
  const clientResult = await createHubSpotClient(accessToken);
  if ('error' in clientResult) {
    throw new Error(`HubSpot client error: ${clientResult.error}`);
  }
  const { client } = clientResult;

  const contacts = new Map<string, ContactProperties>();
  let after: string | undefined;

  do {
    const response = await client.request<{
      results: Array<{
        id: string;
        properties: Record<string, string | null>;
      }>;
      paging?: { next?: { after: string } };
    }>(
      `/crm/v3/objects/contacts?properties=${CONTACT_PROPERTIES.join(',')}&limit=100${after ? `&after=${after}` : ''}`,
      { method: 'GET' }
    );

    for (const contact of response.results) {
      contacts.set(contact.id, {
        email: contact.properties.email || null,
        firstname: contact.properties.firstname || null,
        lastname: contact.properties.lastname || null,
        phone: contact.properties.phone || null,
        jobtitle: contact.properties.jobtitle || null,
        company: contact.properties.company || null,
        hs_linkedinid: contact.properties.hs_linkedinid || null,
      });
    }

    after = response.paging?.next?.after;
  } while (after);

  return contacts;
}

/**
 * Run a contact dedup scan for an organization.
 */
export async function runContactDedupScan(
  orgId: string,
  accessToken: string,
  connectionId: string
): Promise<ContactDedupScanResult> {
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

  console.log(`[Contact Dedup Scan] Starting scan for org ${orgId}`);

  // Fetch all contacts
  const contacts = await fetchAllContacts(accessToken, portalId);
  console.log(`[Contact Dedup Scan] Loaded ${contacts.size} contacts`);

  let contactsScanned = 0;
  let pairsDetected = 0;
  let pairsGradeA = 0;
  let pairsGradeB = 0;
  let pairsGradeC = 0;
  let pairsGradeD = 0;

  // Build blocking keys for efficient pair generation
  const emailIndex = new Map<string, string[]>();
  const phoneIndex = new Map<string, string[]>();
  const linkedInIndex = new Map<string, string[]>();

  for (const [id, contact] of Array.from(contacts.entries())) {
    // Email blocking
    if (contact.email) {
      const email = contact.email.toLowerCase().trim();
      if (!emailIndex.has(email)) {
        emailIndex.set(email, []);
      }
      emailIndex.get(email)!.push(id);
    }

    // Phone blocking
    if (contact.phone) {
      const digits = contact.phone.replace(/\D/g, '');
      if (digits.length >= 7) {
        const prefix = digits.slice(0, 6);
        if (!phoneIndex.has(prefix)) {
          phoneIndex.set(prefix, []);
        }
        phoneIndex.get(prefix)!.push(id);
      }
    }

    // LinkedIn blocking
    if (contact.hs_linkedinid) {
      const linkedin = contact.hs_linkedinid.toLowerCase().trim().replace(/\/+$/, '');
      if (!linkedInIndex.has(linkedin)) {
        linkedInIndex.set(linkedin, []);
      }
      linkedInIndex.get(linkedin)!.push(id);
    }
  }

  // Track seen pairs to avoid duplicates
  const seenPairs = new Set<string>();

  // Generate candidate pairs from blocking keys
  const candidatePairs: Array<[string, string]> = [];

  for (const ids of Array.from(emailIndex.values())) {
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

  for (const ids of Array.from(linkedInIndex.values())) {
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

  console.log(`[Contact Dedup Scan] Generated ${candidatePairs.length} candidate pairs`);

  // Evaluate each candidate pair
  for (const [idA, idB] of candidatePairs) {
    const contactA = contacts.get(idA);
    const contactB = contacts.get(idB);

    if (!contactA || !contactB) continue;

    const evaluation = evaluateContactPair(contactA, contactB);

    // Only store pairs with confidence > 50
    if (evaluation.confidence >= 50) {
      // Store pair in database
      const { error } = await supabase
        .from('contact_dedup_pairs')
        .upsert({
          org_id: orgId,
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
        console.error('Failed to store dedup pair:', error);
        continue;
      }

      pairsDetected++;
      if (evaluation.grade === 'A') pairsGradeA++;
      else if (evaluation.grade === 'B') pairsGradeB++;
      else if (evaluation.grade === 'C') pairsGradeC++;
      else if (evaluation.grade === 'D') pairsGradeD++;
    }

    contactsScanned++;

    // Log progress every 100 pairs
    if (contactsScanned % 100 === 0) {
      console.log(`[Contact Dedup Scan] Evaluated ${contactsScanned} pairs...`);
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(`[Contact Dedup Scan] Completed in ${durationMs}ms: ${contactsScanned} pairs evaluated, ${pairsDetected} duplicates found`);

  return {
    orgId,
    contactsScanned: contacts.size,
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
 * Process a contact dedup scan job.
 */
async function processScanJob(
  job: Job<ContactDedupScanJobData, ContactDedupScanResult>
): Promise<ContactDedupScanResult> {
  const { orgId, accessToken, connectionId, initiatedBy } = job.data;

  console.log(`[Contact Dedup Worker] Processing scan job for org ${orgId}, user ${initiatedBy}`);

  try {
    const result = await runContactDedupScan(orgId, accessToken, connectionId);

    // Update run record
    if (supabase) {
      await supabase
        .from('contact_dedup_runs')
        .update({
          status: 'completed',
          contacts_scanned: result.contactsScanned,
          pairs_detected: result.pairsDetected,
          pairs_grade_a: result.pairsGradeA,
          pairs_grade_b: result.pairsGradeB,
          pairs_grade_c: result.pairsGradeC,
          pairs_grade_d: result.pairsGradeD,
          completed_at: result.completedAt,
        })
        .eq('org_id', orgId)
        .eq('initiated_by', initiatedBy)
        .eq('status', 'running')
        .order('started_at', { ascending: false })
        .limit(1);
    }

    return result;
  } catch (error) {
    // Update run record to failed
    if (supabase) {
      await supabase
        .from('contact_dedup_runs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('org_id', orgId)
        .eq('initiated_by', initiatedBy)
        .eq('status', 'running')
        .order('started_at', { ascending: false })
        .limit(1);
    }

    throw error;
  }
}

/**
 * Start the contact dedup scan worker.
 */
export function startContactDedupScanWorker(): Worker<ContactDedupScanJobData, ContactDedupScanResult> | null {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured - contact dedup scan worker disabled');
    return null;
  }

  if (scanWorker) {
    return scanWorker;
  }

  const connection = createRedisConnection();

  scanWorker = new Worker<ContactDedupScanJobData, ContactDedupScanResult>(
    QUEUE_NAME,
    processScanJob,
    {
      connection,
      concurrency: WORKER_CONCURRENCY,
    }
  );

  scanWorker.on('completed', (job, result) => {
    console.log(
      `[Contact Dedup Worker] Job ${job.id} completed: ` +
      `${result.contactsScanned} contacts scanned, ${result.pairsDetected} duplicates found in ${result.durationMs}ms`
    );
  });

  scanWorker.on('failed', (job, error) => {
    console.error(`[Contact Dedup Worker] Job ${job?.id} failed:`, error.message);
  });

  scanWorker.on('error', (error) => {
    console.error('[Contact Dedup Worker] Worker error:', error);
  });

  console.log(`[Contact Dedup Worker] Started with concurrency=${WORKER_CONCURRENCY}`);

  return scanWorker;
}

/**
 * Stop the contact dedup scan worker.
 */
export async function stopContactDedupScanWorker(): Promise<void> {
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
export async function getContactDedupScanQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
} | null> {
  const queue = getContactDedupScanQueue();
  if (!queue) return null;

  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}
