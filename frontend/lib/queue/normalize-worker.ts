/**
 * Normalize Apply Worker
 *
 * Re-runs the normalization preview engine on selected companies,
 * filters to user-selected changes, and writes to HubSpot.
 *
 * Architecture: Preview is ephemeral (no DB persistence).
 * Worker must re-run runNormalizationPreview() to get normalized values.
 */

import { Worker, Job, Queue } from 'bullmq';
import { createRedisConnection, isRedisConfigured } from './redis';
import { supabase } from '../db/supabase';
import { getAccessToken } from '../hubspot/get-access-token';
import { HubSpotClient } from '../hubspot/client';
import { runNormalizationPreview } from '../harmonies/normalization-engine';
import type { Harmony } from '../harmonies/normalization-engine';
import type { HubSpotCompany } from '../hubspot/types';

export interface NormalizeJobData {
  runId: string;
  orgId: string;
  portalId: string;
  connectionId: string;
  harmonyIds: string[];
  selectedChanges: Array<{ companyId: string; field: string }>;
}

// Lazy-initialized queue - only created when accessed (API routes), not in worker process
let _normalizeQueue: Queue<NormalizeJobData> | null = null;

export function getNormalizeQueue(): Queue<NormalizeJobData> {
  if (!_normalizeQueue) {
    console.log('[Normalize Queue] Initializing queue with Redis connection');
    _normalizeQueue = new Queue('normalize-apply', {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return _normalizeQueue;
}

export function startNormalizeWorker() {
  if (!isRedisConfigured()) {
    console.error('Cannot start normalize worker - Redis not configured');
    return null;
  }

  console.log('[Normalize Worker] Creating Redis connection for worker...');
  const connection = createRedisConnection();

  // Add worker-specific connection event handlers
  connection.on('connect', () => {
    console.log('[Normalize Worker] Worker connection established');
  });

  connection.on('ready', () => {
    console.log('[Normalize Worker] Worker connection ready');
  });

  connection.on('error', (err) => {
    console.error('[Normalize Worker] Worker connection error:', err.message);
  });

  connection.on('close', () => {
    console.log('[Normalize Worker] Worker connection closed');
  });

  const worker = new Worker<NormalizeJobData>(
    'normalize-apply',
    async (job: Job<NormalizeJobData>) => {
      const { runId, orgId, portalId, harmonyIds, selectedChanges } = job.data;

      const selectedSet = new Set(
        selectedChanges.map((c) => `${c.companyId}:${c.field}`)
      );
      const companyIds = Array.from(new Set(selectedChanges.map((c) => c.companyId)));

      console.log(`[Normalize Worker] Run ${runId}: Processing ${companyIds.length} companies, ${selectedChanges.length} changes`);
      console.log(`[Normalize Worker] Selected changes:`, selectedChanges.slice(0, 5));

      await updateRunStatus(runId, 'processing');
      await job.updateProgress({ percentage: 5, stage: 'Fetching harmonies' });

      if (!supabase) {
        throw new Error('Database not configured');
      }

      // Step 1: Fetch harmonies
      const { data: harmoniesData } = await supabase
        .from('harmonies')
        .select('*')
        .eq('org_id', orgId)
        .in('id', harmonyIds)
        .eq('is_active', true);

      if (!harmoniesData || harmoniesData.length === 0) {
        await updateRunStatus(runId, 'completed', {
          records_processed: 0,
          records_changed: 0,
        });
        return { processed: 0, changed: 0 };
      }

      // Transform to Harmony type expected by normalization engine
      const harmonies: Harmony[] = harmoniesData.map((h: any) => ({
        id: h.id,
        name: h.name,
        field: h.field_key || h.field,
        objectType: h.object_type as 'company' | 'contact',
        transformType: h.transform_type || 'lookup',
        referenceTable: h.reference_table,
        fuzzyThreshold: h.fuzzy_threshold || 0.8,
        phoneticEnabled: h.phonetic_enabled || false,
        isActive: h.is_active,
        outputFormat: h.output_format || 'default',
        outputFormatsAvailable: h.output_formats_available || [],
        isPreset: h.is_preset || false,
      }));

      await job.updateProgress({
        percentage: 15,
        stage: `Fetching ${companyIds.length} companies from HubSpot`,
      });

      // Step 2: Fetch only the selected companies from HubSpot
      const accessToken = await getAccessToken(orgId);
      const hubspot = new HubSpotClient(accessToken, portalId);
      const fieldKeys = Array.from(new Set(selectedChanges.map((c) => c.field)));
      const properties = ['name', ...fieldKeys];

      const companies = await hubspot.getCompaniesByIds(companyIds, properties);

      console.log(`[Normalize Worker] Fetched ${companies?.length || 0} companies from HubSpot`);

      if (!companies || companies.length === 0) {
        console.log(`[Normalize Worker] No companies fetched, exiting early`);
        await updateRunStatus(runId, 'completed', {
          records_processed: 0,
          records_changed: 0,
        });
        return { processed: 0, changed: 0 };
      }

      await job.updateProgress({
        percentage: 30,
        stage: 'Re-running normalization engine',
      });

      // Step 3: Re-run normalization preview on fetched companies
      const records = companies.map((c: HubSpotCompany) => ({ id: c.id, ...c.properties }));
      const allChanges = await runNormalizationPreview(records, harmonies, orgId);

      console.log(`[Normalize Worker] Normalization found ${allChanges.length} total changes`);
      console.log(`[Normalize Worker] First 3 changes:`, allChanges.slice(0, 3).map(c => `${c.hubspotRecordId}:${c.field}`));
      console.log(`[Normalize Worker] Selected set:`, Array.from(selectedSet).slice(0, 3));

      // Step 4: Filter to only what the user selected
      const toApply = allChanges.filter(
        (c) =>
          selectedSet.has(`${c.hubspotRecordId}:${c.field}`) &&
          c.after &&
          c.after !== c.before &&
          c.matchType !== 'none'
      );

      console.log(`[Normalize Worker] After filtering: ${toApply.length} changes to apply`);

      if (toApply.length === 0) {
        console.log(`[Normalize Worker] No changes to apply after filtering, exiting`);
        await updateRunStatus(runId, 'completed', {
          records_processed: companyIds.length,
          records_changed: 0,
        });
        return { processed: companyIds.length, changed: 0 };
      }

      await job.updateProgress({
        percentage: 40,
        stage: `Writing ${toApply.length} changes to HubSpot`,
      });

      // Step 5: Group by company for batch update
      const byCompany = new Map<string, Record<string, string>>();
      for (const change of toApply) {
        const existing = byCompany.get(change.hubspotRecordId) ?? {};
        existing[change.field] = change.after;
        byCompany.set(change.hubspotRecordId, existing);
      }

      // Step 6: Write to HubSpot in batches of 100
      const companyEntries = Array.from(byCompany.entries());
      const batchSize = 100;
      let changed = 0;
      let failed = 0;
      const progressItems: Array<{
        run_id: string;
        hubspot_company_id: string;
        field_key: string;
        previous_value: string | null;
        new_value: string;
        status: string;
        written_at: string;
      }> = [];

      for (let i = 0; i < companyEntries.length; i += batchSize) {
        const batch = companyEntries.slice(i, i + batchSize);

        try {
          await hubspot.batchUpdateCompanies(
            batch.map(([id, properties]) => ({ id, properties }))
          );

          for (const [companyId, properties] of batch) {
            for (const [fieldKey, newValue] of Object.entries(properties)) {
              const original = toApply.find(
                (c) => c.hubspotRecordId === companyId && c.field === fieldKey
              );
              progressItems.push({
                run_id: runId,
                hubspot_company_id: companyId,
                field_key: fieldKey,
                previous_value: original?.before ?? null,
                new_value: newValue,
                status: 'written',
                written_at: new Date().toISOString(),
              });
            }
          }

          changed += batch.length;
        } catch (err: any) {
          console.error(`[Normalize Worker] Batch write failed:`, err.message);
          failed += batch.length;
        }

        const pct =
          40 + Math.round(((i + batch.length) / companyEntries.length) * 50);
        await job.updateProgress({
          percentage: pct,
          stage: `Written ${Math.min(i + batchSize, companyEntries.length)} of ${companyEntries.length} companies`,
        });
      }

      // Step 7: Log to normalization_run_progress in bulk
      if (progressItems.length > 0 && supabase) {
        await supabase
          .from('normalization_run_progress')
          .insert(progressItems)
          .then(({ error }) => {
            if (error)
              console.warn(
                '[Normalize Worker] Progress log failed:',
                error.message
              );
          });
      }

      // Step 8: Update run to completed
      await updateRunStatus(runId, 'completed', {
        records_processed: companyIds.length,
        records_changed: changed,
        records_failed: failed,
        completed_at: new Date().toISOString(),
      });

      await job.updateProgress({ percentage: 100, stage: 'Complete' });

      console.log(
        `[Normalize Worker] Run ${runId}: ${changed} changed, ${failed} failed`
      );

      return { processed: companyIds.length, changed, failed };
    },
    { connection, concurrency: 3 }
  );

  worker.on('completed', (job) => {
    console.log(`[Normalize Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Normalize Worker] Job ${job?.id} failed:`, err.message);
    if (job?.data?.runId) {
      updateRunStatus(job.data.runId, 'failed', { error: err.message }).catch(
        () => {}
      );
    }
  });

  return worker;
}

async function updateRunStatus(
  runId: string,
  status: string,
  extra: Record<string, any> = {}
) {
  if (!supabase) {
    console.warn('[Normalize Worker] Cannot update run status - database not configured');
    return;
  }

  await supabase
    .from('normalization_runs')
    .update({ status, ...extra })
    .eq('id', runId);
}
