/**
 * Taxonomy Suggestion Queue
 *
 * BullMQ queue for processing taxonomy suggestion scans.
 * Finds unmapped values in HubSpot and classifies them via Claude Haiku.
 */

import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection, isRedisConfigured } from './redis';
import { HubSpotClient } from '../hubspot/client';
import { getAccessToken } from '../hubspot/get-access-token';
import { runTaxonomySuggester } from '../harmonies/taxonomy-suggester';

// ─────────────────────────────────────────────────────────────
// Queue Configuration
// ─────────────────────────────────────────────────────────────

const QUEUE_NAME = 'taxonomy-suggestions';

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? '5', 10);

const RETRY_SETTINGS = {
  attempts: 2,
  backoff: {
    type: 'exponential' as const,
    delay: 3000,
  },
};

// ─────────────────────────────────────────────────────────────
// Job Types
// ─────────────────────────────────────────────────────────────

export interface TaxonomySuggestionJobData {
  orgId: string;
  harmonyId: string;
  hubspotProperty: string;
  objectType: 'company' | 'contact';
  harmonyContext: string;
  portalId: string;
  connectionId: string;
}

export interface TaxonomySuggestionProgress {
  phase: 'started' | 'scanning' | 'classifying' | 'completed' | 'failed';
  message: string;
  progress: number;
  found?: number;
  stored?: number;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Queue Instance
// ─────────────────────────────────────────────────────────────

let queue: Queue<TaxonomySuggestionJobData, void, string> | null = null;

export function getTaxonomySuggestionQueue() {
  if (!isRedisConfigured()) return null;

  if (!queue) {
    queue = new Queue<TaxonomySuggestionJobData>(QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        ...RETRY_SETTINGS,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    });
  }

  return queue;
}

// ─────────────────────────────────────────────────────────────
// Worker
// ─────────────────────────────────────────────────────────────

let worker: Worker<TaxonomySuggestionJobData, void, string> | null = null;

export function startTaxonomySuggestionWorker() {
  if (!isRedisConfigured()) {
    console.log('[taxonomy-suggestion-worker] Redis not configured, worker not started');
    return null;
  }

  if (worker) {
    console.log('[taxonomy-suggestion-worker] Worker already running');
    return worker;
  }

  worker = new Worker<TaxonomySuggestionJobData>(
    QUEUE_NAME,
    async (job: Job<TaxonomySuggestionJobData>) => {
      const { orgId, harmonyId, hubspotProperty, objectType, harmonyContext, portalId, connectionId } = job.data;

      console.log(`[taxonomy-suggestion-worker] Starting scan for harmony ${harmonyId}`);

      await job.updateProgress({
        phase: 'started',
        message: 'Initializing scan...',
        progress: 0,
      });

      try {
        // Get HubSpot client
        const accessToken = await getAccessToken(orgId);
        if (!accessToken) {
          throw new Error('Failed to get HubSpot access token');
        }

        const client = new HubSpotClient(accessToken, portalId);

        await job.updateProgress({
          phase: 'scanning',
          message: `Scanning ${objectType} records for unmapped values...`,
          progress: 10,
        });

        // Run suggester
        const result = await runTaxonomySuggester(
          client,
          harmonyId,
          hubspotProperty,
          objectType,
          orgId,
          harmonyContext
        );

        await job.updateProgress({
          phase: 'classifying',
          message: `Classified ${result.stored} values via AI...`,
          progress: 80,
        });

        await job.updateProgress({
          phase: 'completed',
          message: `Found ${result.found} unmapped values, stored ${result.stored} suggestions`,
          progress: 100,
          found: result.found,
          stored: result.stored,
        });

        console.log(
          `[taxonomy-suggestion-worker] Completed: ${result.found} found, ${result.stored} stored`
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[taxonomy-suggestion-worker] Error:', error);

        await job.updateProgress({
          phase: 'failed',
          message: errorMessage,
          progress: 0,
          error: errorMessage,
        });

        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: WORKER_CONCURRENCY,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[taxonomy-suggestion-worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[taxonomy-suggestion-worker] Job ${job?.id} failed:`, err);
  });

  console.log(`[taxonomy-suggestion-worker] Worker started with concurrency ${WORKER_CONCURRENCY}`);

  return worker;
}

export function stopTaxonomySuggestionWorker() {
  if (worker) {
    worker.close();
    worker = null;
    console.log('[taxonomy-suggestion-worker] Worker stopped');
  }
}

// ─────────────────────────────────────────────────────────────
// Job Enqueue
// ─────────────────────────────────────────────────────────────

export async function enqueueTaxonomySuggestionScan(
  data: TaxonomySuggestionJobData
): Promise<string | null> {
  const q = getTaxonomySuggestionQueue();
  if (!q) return null;

  const job = await q.add('taxonomy-suggestion-scan', data);
  return job.id || null;
}
