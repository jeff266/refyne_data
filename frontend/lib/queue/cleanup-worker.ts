/**
 * Cleanup Worker
 *
 * Runs daily at 3am UTC to delete old run data (90-day retention).
 * Prevents database bloat from normalization_run_progress rows.
 */

import { Worker, Queue } from 'bullmq';
import { createRedisConnection } from './redis';
import { supabaseAdmin } from '../db/admin-client';

export const CLEANUP_QUEUE = 'cleanup';

export function getCleanupQueue(): Queue {
  return new Queue(CLEANUP_QUEUE, { connection: createRedisConnection() });
}

export function startCleanupWorker(): Worker {
  const worker = new Worker(
    CLEANUP_QUEUE,
    async (job) => {
      const startTime = Date.now();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      const cutoff = cutoffDate.toISOString();

      console.log(`[Cleanup] Starting cleanup job (cutoff: ${cutoff})`);

      let progressRowsDeleted = 0;
      let runsDeleted = 0;
      let dedupRunsDeleted = 0;
      let suggestionsDeleted = 0;
      let segmentationRunsDeleted = 0;
      let error: string | null = null;

      try {
        // Step 1: Clean old normalization runs (with progress rows)
        // Process in batches to avoid long-running transactions
        let hasMore = true;
        while (hasMore) {
          const { data: oldRuns } = await supabaseAdmin
            .from('normalization_runs')
            .select('id')
            .lt('created_at', cutoff)
            .limit(1000);

          if (!oldRuns || oldRuns.length === 0) {
            hasMore = false;
            break;
          }

          const runIds = oldRuns.map(r => r.id);

          // Delete progress rows first (FK constraint)
          const { count: progressCount } = await supabaseAdmin
            .from('normalization_run_progress')
            .delete()
            .in('run_id', runIds);

          progressRowsDeleted += progressCount || 0;

          // Delete the runs themselves
          const { count: runsCount } = await supabaseAdmin
            .from('normalization_runs')
            .delete()
            .in('id', runIds);

          runsDeleted += runsCount || 0;

          console.log(`[Cleanup] Batch: deleted ${progressCount} progress rows, ${runsCount} runs`);

          // If we got less than the limit, we're done
          if (oldRuns.length < 1000) {
            hasMore = false;
          }
        }

        console.log(`[Cleanup] Normalization cleanup complete: ${progressRowsDeleted} progress rows, ${runsDeleted} runs`);

        // Step 2: Clean old dedup scan runs
        const { count: dedupCount } = await supabaseAdmin
          .from('dedup_scan_runs')
          .delete()
          .lt('started_at', cutoff);

        dedupRunsDeleted = dedupCount || 0;
        console.log(`[Cleanup] Deleted ${dedupRunsDeleted} old dedup scan runs`);

        // Step 3: Clean old taxonomy suggestions that were accepted or rejected
        const { count: suggestionsCount } = await supabaseAdmin
          .from('taxonomy_suggestions')
          .delete()
          .in('status', ['accepted', 'rejected'])
          .lt('reviewed_at', cutoff);

        suggestionsDeleted = suggestionsCount || 0;
        console.log(`[Cleanup] Deleted ${suggestionsDeleted} old taxonomy suggestions`);

        // Step 4: Clean old job segmentation runs
        const { count: segmentationCount } = await supabaseAdmin
          .from('job_segmentation_runs')
          .delete()
          .eq('status', 'completed')
          .lt('completed_at', cutoff);

        segmentationRunsDeleted = segmentationCount || 0;
        console.log(`[Cleanup] Deleted ${segmentationRunsDeleted} old job segmentation runs`);

      } catch (err: any) {
        error = err?.message || 'Unknown error';
        console.error('[Cleanup] Error during cleanup:', error);
      }

      const durationMs = Date.now() - startTime;

      // Log cleanup run to database
      await supabaseAdmin.from('cleanup_runs').insert({
        ran_at: new Date().toISOString(),
        progress_rows_deleted: progressRowsDeleted,
        runs_deleted: runsDeleted,
        dedup_runs_deleted: dedupRunsDeleted,
        suggestions_deleted: suggestionsDeleted,
        segmentation_runs_deleted: segmentationRunsDeleted,
        duration_ms: durationMs,
        error,
      });

      console.log(`[Cleanup] Job complete in ${durationMs}ms - total deleted: ${progressRowsDeleted + runsDeleted + dedupRunsDeleted + suggestionsDeleted + segmentationRunsDeleted} rows`);

      return {
        progressRowsDeleted,
        runsDeleted,
        dedupRunsDeleted,
        suggestionsDeleted,
        segmentationRunsDeleted,
        durationMs,
      };
    },
    {
      connection: createRedisConnection(),
      concurrency: 1, // Only one cleanup job at a time
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Cleanup Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Cleanup Worker] Job ${job?.id} failed:`, err);
  });

  console.log('[Cleanup Worker] Started with concurrency 1');

  return worker;
}
