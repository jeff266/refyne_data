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
import type { Harmony, HubSpotRecord } from '../harmonies/normalization-engine';
import type { HubSpotCompany } from '../hubspot/types';
import { getFieldAssignments, buildFieldMap } from '../harmonies/field-assignments';

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

      // Build set of selected changes using canonical field names
      const selectedSet = new Set(
        selectedChanges.map((c) => `${c.companyId}:${c.field}`)
      );
      const companyIds = Array.from(new Set(selectedChanges.map((c) => c.companyId)));

      console.log(`[Normalize Worker] Run ${runId}: Processing ${companyIds.length} companies, ${selectedChanges.length} changes`);
      console.log(`[Normalize Worker] Selected changes:`, selectedChanges.slice(0, 5));
      console.log(`[Normalize Worker] Selected set (normalized):`, Array.from(selectedSet).slice(0, 5));

      await updateRunStatus(runId, 'processing');
      await job.updateProgress({ percentage: 5, stage: 'Fetching harmonies' });

      if (!supabase) {
        throw new Error('Database not configured');
      }

      // Step 1: Fetch harmonies
      console.log(`[Normalize Worker] Fetching harmonies for org ${orgId}, harmonyIds:`, harmonyIds);

      const { data: harmoniesData, error: harmoniesError } = await supabase
        .from('harmonies')
        .select('*')
        .or(`org_id.is.null,org_id.eq.${orgId}`)
        .in('id', harmonyIds)
        .eq('is_active', true);

      console.log(`[Normalize Worker] Harmonies query result: ${harmoniesData?.length || 0} found, error:`, harmoniesError);

      if (!harmoniesData || harmoniesData.length === 0) {
        console.log(`[Normalize Worker] No harmonies found! Exiting early. Searched for:`, harmonyIds);
        await updateRunStatus(runId, 'completed', {
          records_processed: 0,
          records_changed: 0,
          completed_at: new Date().toISOString(),
        });
        return { processed: 0, changed: 0 };
      }

      console.log(`[Normalize Worker] Found ${harmoniesData.length} harmonies:`, harmoniesData.map(h => h.id));

      // Transform to Harmony type expected by normalization engine
      const harmonies: Harmony[] = harmoniesData.map((h: any) => ({
        id: h.id,
        name: h.name,
        field: h.field_key || h.field,
        objectType: h.object_type as 'company' | 'contact',
        transformType: h.transform_type || 'lookup',
        transformFunction: h.transform_function,
        transformConfig: h.transform_config || {},
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

      // Step 2: Fetch field assignments (replaces DEFAULT_FIELD_MAPPINGS)
      const fieldAssignments = await getFieldAssignments(orgId, 'company');
      const fieldMappingLookup = buildFieldMap(fieldAssignments);

      // Step 3: Fetch only the selected companies from HubSpot
      const accessToken = await getAccessToken(orgId);
      const hubspot = new HubSpotClient(accessToken, portalId);

      // Build HubSpot properties to fetch from field assignments
      const fieldKeys = Array.from(new Set(selectedChanges.map((c) => c.field)));
      const properties = Array.from(new Set([
        'name',
        'domain',
        ...fieldKeys.map(f => {
          // Use field mapping from assignments
          const hubspotProp = fieldMappingLookup.get(f);
          if (hubspotProp) return hubspotProp;

          // Fallback: strip object prefix (company.industry -> industry)
          return f.includes('.') ? f.split('.')[1] : f;
        })
      ]));

      console.log(`[Normalize Worker] Canonical fields:`, fieldKeys);
      console.log(`[Normalize Worker] HubSpot properties to fetch:`, properties);

      const companies = await hubspot.getCompaniesByIds(companyIds, properties);

      console.log(`[Normalize Worker] Fetched ${companies?.length || 0} companies from HubSpot`);

      if (!companies || companies.length === 0) {
        console.log(`[Normalize Worker] No companies fetched, exiting early`);
        await updateRunStatus(runId, 'completed', {
          records_processed: 0,
          records_changed: 0,
          completed_at: new Date().toISOString(),
        });
        return { processed: 0, changed: 0 };
      }

      await job.updateProgress({
        percentage: 30,
        stage: 'Re-running normalization engine',
      });

      // Step 4: Re-run normalization preview on fetched companies
      const records: HubSpotRecord[] = companies.map((c: HubSpotCompany) => {
        const record: HubSpotRecord = {
          id: c.id,
          ...c.properties,
        };

        // Map HubSpot properties to canonical field names using field assignments
        for (const assignment of fieldAssignments) {
          const value = c.properties[assignment.hubspotProperty];
          if (value !== undefined) {
            record[assignment.canonicalField] = value;
          }
        }

        return record;
      });
      const allChanges = await runNormalizationPreview(records, harmonies, orgId);

      console.log(`[Normalize Worker] Normalization found ${allChanges.length} total changes`);
      console.log('[Normalize Worker] Sample changes from preview:',
        allChanges.slice(0, 3).map(c => ({
          hubspotRecordId: c.hubspotRecordId,
          field: c.field,
          before: c.before,
          after: c.after
        }))
      );
      console.log('[Normalize Worker] Selected set contents:', Array.from(selectedSet));

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
          completed_at: new Date().toISOString(),
        });
        return { processed: companyIds.length, changed: 0 };
      }

      await job.updateProgress({
        percentage: 40,
        stage: `Writing ${toApply.length} changes to HubSpot`,
      });

      // Step 5: Group by company for batch update
      const byCompany = new Map<string, Record<string, string>>();
      // Track mapping from HubSpot property -> canonical field for progress logging
      const propToCanonical = new Map<string, Map<string, string>>();

      for (const change of toApply) {
        const existing = byCompany.get(change.hubspotRecordId) ?? {};

        // Map canonical field name to HubSpot property name
        const hubspotProperty = fieldMappingLookup.get(change.field) ||
          (change.field.includes('.') ? change.field.split('.')[1] : change.field);

        existing[hubspotProperty] = change.after;
        byCompany.set(change.hubspotRecordId, existing);

        // Track reverse mapping for progress logging
        if (!propToCanonical.has(change.hubspotRecordId)) {
          propToCanonical.set(change.hubspotRecordId, new Map());
        }
        propToCanonical.get(change.hubspotRecordId)!.set(hubspotProperty, change.field);
      }

      // Step 6: Build company name lookup for progress logging
      const companyNameMap = new Map<string, string>();
      for (const company of companies) {
        companyNameMap.set(company.id, company.properties.name || company.id);
      }

      // Step 7: Write to HubSpot in batches of 100
      const companyEntries = Array.from(byCompany.entries());
      const batchSize = 100;
      let changed = 0;
      let failed = 0;
      const progressItems: Array<{
        run_id: string;
        hubspot_company_id: string;
        company_name: string;
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
            for (const [hubspotProp, newValue] of Object.entries(properties)) {
              // Get canonical field name from HubSpot property
              const canonicalField = propToCanonical.get(companyId)?.get(hubspotProp) || hubspotProp;

              const original = toApply.find(
                (c) => c.hubspotRecordId === companyId && c.field === canonicalField
              );

              progressItems.push({
                run_id: runId,
                hubspot_company_id: companyId,
                company_name: companyNameMap.get(companyId) || companyId,
                field_key: canonicalField,
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

      // Step 8: Log to normalization_run_progress in bulk
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

      // Step 9: Update run to completed
      await updateRunStatus(runId, 'completed', {
        records_processed: companyIds.length,
        records_changed: changed,
        records_failed: failed,
        completed_at: new Date().toISOString(),
      });

      // Step 10: Invalidate issue counts cache (force recalculation on next load)
      if (isRedisConfigured()) {
        try {
          const redis = createRedisConnection();
          const objectType = 'company'; // TODO: Get from run metadata when supporting contacts/deals
          const cacheKey = `normalize:counts:${orgId}:${portalId}:${objectType}`;
          await redis.del(cacheKey);
          console.log(`[Normalize Worker] Invalidated cache: ${cacheKey}`);
        } catch (cacheErr) {
          console.warn('[Normalize Worker] Failed to invalidate cache:', cacheErr);
          // Non-fatal - continue
        }
      }

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
