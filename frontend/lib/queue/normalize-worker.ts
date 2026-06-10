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
import { startStalledJobMonitoring, stopStalledJobMonitoring } from './stalled-job-detector';
import { withHubSpotRateLimit } from '../hubspot/shared-portal-rate-limiter';
import { supabase } from '../db/supabase';
import { getAccessToken } from '../hubspot/get-access-token';
import { HubSpotClient } from '../hubspot/client';
import { runNormalizationPreview } from '../harmonies/normalization-engine';
import type { Harmony, HubSpotRecord } from '../harmonies/normalization-engine';
import type { HubSpotCompany } from '../hubspot/types';
import { getFieldAssignments, buildFieldMap } from '../harmonies/field-assignments';
import { track } from '../telemetry/track';
import {
  batchLookupRegistry,
  tokenizeCompanyName,
  tokenizeContactName,
  queueForReview
} from '../names/registry';
import { applyContactNameRules } from '../names/normalizer';

export interface NormalizeJobData {
  runId: string;
  orgId: string;
  portalId: string;
  connectionId: string;
  harmonyIds: string[];
  selectedChanges: Array<{
    companyId: string;
    field: string;
    before?: string;  // Original value from HubSpot
    after?: string;   // Admin's chosen value (overrides normalizer if present)
  }>;
  objectType?: 'company' | 'contact';  // Optional for backward compatibility, defaults to 'company'
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

      // Get objectType early so we can use it for field assignments
      const objectType = job.data.objectType ?? 'company';

      await job.updateProgress({
        percentage: 15,
        stage: `Fetching ${companyIds.length} ${objectType} records from HubSpot`,
      });

      // Step 2: Fetch field assignments (replaces DEFAULT_FIELD_MAPPINGS)
      const fieldAssignments = await getFieldAssignments(orgId, objectType);
      const fieldMappingLookup = buildFieldMap(fieldAssignments);

      // Step 3: Fetch only the selected records from HubSpot
      const accessToken = await getAccessToken(orgId);
      const hubspot = new HubSpotClient(accessToken, portalId);

      // Build HubSpot properties to fetch from field assignments
      const fieldKeys = Array.from(new Set(selectedChanges.map((c) => c.field)));
      const displayField = objectType === 'company' ? 'name' : 'email';
      const properties = Array.from(new Set([
        displayField,
        objectType === 'company' ? 'domain' : undefined,
        ...fieldKeys.map(f => {
          // Use field mapping from assignments
          const hubspotProp = fieldMappingLookup.get(f);
          if (hubspotProp) return hubspotProp;

          // Fallback: strip object prefix (company.industry -> industry)
          return f.includes('.') ? f.split('.')[1] : f;
        })
      ].filter(Boolean) as string[]));

      console.log(`[Normalize Worker] Object type: ${objectType}`);
      console.log(`[Normalize Worker] Canonical fields:`, fieldKeys);
      console.log(`[Normalize Worker] HubSpot properties to fetch:`, properties);

      const records = await hubspot.getRecordsByIds(objectType, companyIds, properties);

      console.log(`[Normalize Worker] Fetched ${records?.length || 0} ${objectType} records from HubSpot`);

      if (!records || records.length === 0) {
        console.log(`[Normalize Worker] No ${objectType} records fetched, exiting early`);
        await updateRunStatus(runId, 'completed', {
          records_processed: 0,
          records_changed: 0,
          completed_at: new Date().toISOString(),
        });
        return { processed: 0, changed: 0 };
      }

      await job.updateProgress({
        percentage: 30,
        stage: 'Checking name registry',
      });

      // Step 4: Batch lookup registry before running normalization
      // Build HubSpot records with field mappings
      const hubspotRecords: HubSpotRecord[] = records.map((c: HubSpotCompany) => {
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

      // Collect unique tokens for batch registry lookup
      const companyNameTokens = new Set<string>();
      const firstNameTokens = new Set<string>();
      const lastNameTokens = new Set<string>();

      for (const record of hubspotRecords) {
        // Company names
        const companyName = record['company.name'] || record.name;
        if (companyName && typeof companyName === 'string') {
          const tokens = tokenizeCompanyName(companyName);
          tokens.forEach(token => companyNameTokens.add(token));
        }

        // Contact names (if processing contacts)
        if (objectType === 'contact') {
          const firstName = record['contact.firstname'] || record.firstname;
          const lastName = record['contact.lastname'] || record.lastname;

          if (firstName && typeof firstName === 'string') {
            const { firstTokens } = tokenizeContactName(firstName, undefined);
            firstTokens.forEach(token => firstNameTokens.add(token));
          }

          if (lastName && typeof lastName === 'string') {
            const { lastTokens } = tokenizeContactName(undefined, lastName);
            lastTokens.forEach(token => lastNameTokens.add(token));
          }
        }
      }

      // Batch lookup all registries in parallel
      console.log(`[Normalize Worker] Performing batch registry lookups:`,
        `${companyNameTokens.size} company tokens,`,
        `${firstNameTokens.size} first name tokens,`,
        `${lastNameTokens.size} last name tokens`
      );

      const [
        companyRegistryMap,
        firstNameRegistryMap,
        lastNameRegistryMap,
        contactTokenFirstMap,
        contactTokenLastMap
      ] = await Promise.all([
        batchLookupRegistry(orgId, 'company', Array.from(companyNameTokens)),
        objectType === 'contact'
          ? batchLookupRegistry(orgId, 'contact_first', Array.from(firstNameTokens))
          : Promise.resolve(new Map<string, string>()),
        objectType === 'contact'
          ? batchLookupRegistry(orgId, 'contact_last', Array.from(lastNameTokens))
          : Promise.resolve(new Map<string, string>()),
        objectType === 'contact'
          ? batchLookupRegistry(orgId, 'contact_token', Array.from(firstNameTokens))
          : Promise.resolve(new Map<string, string>()),
        objectType === 'contact'
          ? batchLookupRegistry(orgId, 'contact_token', Array.from(lastNameTokens))
          : Promise.resolve(new Map<string, string>())
      ]);

      // Track registry hits/misses per field type
      const registryStats = {
        company: { hits: 0, misses: 0 },
        firstName: { hits: 0, misses: 0 },
        lastName: { hits: 0, misses: 0 }
      };
      const registryOverrides = new Map<string, { field: string; value: string; source: string }>();

      // Apply registry lookups to records
      for (const record of hubspotRecords) {
        // Company name lookup
        const companyName = record['company.name'] || record.name;
        if (companyName && typeof companyName === 'string') {
          const normalizedToken = companyName.toLowerCase().trim();
          const canonical = companyRegistryMap.get(normalizedToken);

          if (canonical) {
            registryStats.company.hits++;
            registryOverrides.set(`${record.id}:company.name`, {
              field: 'company.name',
              value: canonical,
              source: 'registry'
            });
          } else {
            registryStats.company.misses++;
          }
        }

        // Contact first name lookup (if processing contacts)
        if (objectType === 'contact') {
          const firstName = record['contact.firstname'] || record.firstname;
          if (firstName && typeof firstName === 'string') {
            const normalizedToken = firstName.toLowerCase().trim();
            // Try contact_token first, then contact_first
            const canonical = contactTokenFirstMap.get(normalizedToken) ||
                            firstNameRegistryMap.get(normalizedToken);

            if (canonical) {
              registryStats.firstName.hits++;
              registryOverrides.set(`${record.id}:contact.firstname`, {
                field: 'contact.firstname',
                value: canonical,
                source: 'registry'
              });
            } else {
              registryStats.firstName.misses++;
            }
          }

          // Contact last name lookup
          const lastName = record['contact.lastname'] || record.lastname;
          if (lastName && typeof lastName === 'string') {
            const normalizedToken = lastName.toLowerCase().trim();
            // Try contact_token first, then contact_last
            const canonical = contactTokenLastMap.get(normalizedToken) ||
                            lastNameRegistryMap.get(normalizedToken);

            if (canonical) {
              registryStats.lastName.hits++;
              registryOverrides.set(`${record.id}:contact.lastname`, {
                field: 'contact.lastname',
                value: canonical,
                source: 'registry'
              });
            } else {
              registryStats.lastName.misses++;
            }
          }
        }
      }

      // Log registry results per field type
      if (objectType === 'company' && registryStats.company.hits + registryStats.company.misses > 0) {
        console.log(`[Normalize Worker] Registry: ${registryStats.company.hits} hits, ${registryStats.company.misses} misses for company names in batch`);
      }

      if (objectType === 'contact') {
        if (registryStats.firstName.hits + registryStats.firstName.misses > 0) {
          console.log(`[Normalize Worker] Registry: ${registryStats.firstName.hits} hits, ${registryStats.firstName.misses} misses for first names in batch`);
        }
        if (registryStats.lastName.hits + registryStats.lastName.misses > 0) {
          console.log(`[Normalize Worker] Registry: ${registryStats.lastName.hits} hits, ${registryStats.lastName.misses} misses for last names in batch`);
        }
      }

      // Calculate totals for telemetry
      const registryHits = registryStats.company.hits + registryStats.firstName.hits + registryStats.lastName.hits;
      const registryMisses = registryStats.company.misses + registryStats.firstName.misses + registryStats.lastName.misses;

      await job.updateProgress({
        percentage: 40,
        stage: 'Re-running normalization engine',
      });

      // Step 5: Re-run normalization preview on fetched records
      const allChanges = await runNormalizationPreview(hubspotRecords, harmonies, orgId);

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

      // Build map of admin corrections (if any)
      const adminCorrections = new Map<string, string>();
      for (const selected of selectedChanges) {
        if (selected.after) {
          adminCorrections.set(`${selected.companyId}:${selected.field}`, selected.after);
        }
      }

      if (adminCorrections.size > 0) {
        console.log(`[Normalize Worker] Found ${adminCorrections.size} admin corrections to apply`);
      }

      // Step 6: Apply admin corrections, registry overrides, and filter to selected changes
      const toApply = allChanges
        .map(change => {
          const overrideKey = `${change.hubspotRecordId}:${change.field}`;

          // Priority 1: Admin corrections (highest priority)
          const adminCorrection = adminCorrections.get(overrideKey);
          if (adminCorrection && selectedSet.has(overrideKey)) {
            return {
              ...change,
              after: adminCorrection,
              source: 'admin_correction',
              confidence: 1.0,
              matchType: 'exact' as const
            };
          }

          // Priority 2: Registry overrides
          const override = registryOverrides.get(overrideKey);
          if (override && selectedSet.has(overrideKey)) {
            return {
              ...change,
              after: override.value,
              source: override.source,
              confidence: 1.0,
              matchType: 'exact' as const
            };
          }

          // Priority 3: Normalizer output (default)
          return change;
        })
        .filter(
          (c) =>
            selectedSet.has(`${c.hubspotRecordId}:${c.field}`) &&
            c.after &&
            c.after !== c.before &&
            c.matchType !== 'none'
        );

      // Step 7: Queue low-confidence changes for review
      let queuedCount = 0;
      for (const change of toApply) {
        // Skip registry hits (already have confidence = 1.0)
        if ((change as any).source === 'registry' || (change as any).source === 'admin_correction') {
          continue;
        }

        // Queue if confidence is below threshold (0.85)
        const confidence = change.confidence ?? 0.85;
        if (confidence < 0.85) {
          queuedCount++;

          // Determine registry type based on field
          let registryType: 'company' | 'contact_first' | 'contact_last' | 'contact_token';
          if (change.field === 'company.name') {
            registryType = 'company';
          } else if (change.field === 'contact.firstname') {
            registryType = 'contact_first';
          } else if (change.field === 'contact.lastname') {
            registryType = 'contact_last';
          } else {
            registryType = 'contact_token';
          }

          await queueForReview(
            orgId,
            registryType,
            change.before || '',
            change.after || '',
            'low_confidence',
            {
              hubspot_record_id: change.hubspotRecordId,
              field: change.field,
              confidence,
              match_type: change.matchType,
              run_id: runId
            }
          );
        }
      }

      if (queuedCount > 0) {
        console.log(`[Normalize Worker] Queued ${queuedCount} low-confidence changes for review`);
      }

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
        percentage: 50,
        stage: `Writing ${toApply.length} changes to HubSpot`,
      });

      // Step 8: Group by company for batch update
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

      // Step 9: Build record name lookup for progress logging
      const recordNameMap = new Map<string, string>();
      for (const record of records) {
        recordNameMap.set(record.id, record.properties[displayField] || record.id);
      }

      // Step 10: Write to HubSpot in batches of 100
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
        error_message?: string | null;
        written_at: string;
      }> = [];

      for (let i = 0; i < companyEntries.length; i += batchSize) {
        const batch = companyEntries.slice(i, i + batchSize);

        try {
          const { results, errors } = await withHubSpotRateLimit(
            portalId,
            () => hubspot.batchUpdateRecords(
              objectType,
              batch.map(([id, properties]) => ({ id, properties }))
            )
          );

          // Track which records failed by index
          const failedIndices = new Set(errors.map(e => e.index - i)); // Adjust for batch offset
          const errorsByCompanyId = new Map<string, string>();

          // Map errors to company IDs
          errors.forEach(err => {
            const batchIndex = err.index - i;
            if (batchIndex >= 0 && batchIndex < batch.length) {
              const [companyId] = batch[batchIndex];
              errorsByCompanyId.set(companyId, err.error);
            }
          });

          for (const [companyId, properties] of batch) {
            const companyFailed = errorsByCompanyId.has(companyId);
            const errorMessage = errorsByCompanyId.get(companyId);

            if (companyFailed) {
              failed++;
            } else {
              changed++;
            }

            for (const [hubspotProp, newValue] of Object.entries(properties)) {
              // Get canonical field name from HubSpot property
              const canonicalField = propToCanonical.get(companyId)?.get(hubspotProp) || hubspotProp;

              const original = toApply.find(
                (c) => c.hubspotRecordId === companyId && c.field === canonicalField
              );

              progressItems.push({
                run_id: runId,
                hubspot_company_id: companyId,
                company_name: recordNameMap.get(companyId) || companyId,
                field_key: canonicalField,
                previous_value: original?.before ?? null,
                new_value: newValue,
                status: companyFailed ? 'failed' : 'written',
                error_message: errorMessage || null,
                written_at: new Date().toISOString(),
              });
            }
          }
        } catch (err: any) {
          console.error(`[Normalize Worker] Batch write failed:`, err.message);

          // Mark all records in this batch as failed
          for (const [companyId, properties] of batch) {
            for (const [hubspotProp, newValue] of Object.entries(properties)) {
              const canonicalField = propToCanonical.get(companyId)?.get(hubspotProp) || hubspotProp;
              const original = toApply.find(
                (c) => c.hubspotRecordId === companyId && c.field === canonicalField
              );

              progressItems.push({
                run_id: runId,
                hubspot_company_id: companyId,
                company_name: recordNameMap.get(companyId) || companyId,
                field_key: canonicalField,
                previous_value: original?.before ?? null,
                new_value: newValue,
                status: 'failed',
                error_message: err.message || 'Unknown error',
                written_at: new Date().toISOString(),
              });
            }
          }

          failed += batch.length;
        }

        const pct =
          50 + Math.round(((i + batch.length) / companyEntries.length) * 40);
        await job.updateProgress({
          percentage: pct,
          stage: `Written ${Math.min(i + batchSize, companyEntries.length)} of ${companyEntries.length} companies`,
        });
      }

      // Step 11: Log to normalization_run_progress in bulk
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

      // Step 12: Update run to completed
      await updateRunStatus(runId, 'completed', {
        records_processed: companyIds.length,
        records_changed: changed,
        records_failed: failed,
        completed_at: new Date().toISOString(),
      });

      // Track normalize_run_completed event
      track({
        event: 'normalize_run_completed',
        orgId,
        metadata: {
          run_id: runId,
          records_processed: companyIds.length,
          records_changed: changed,
          records_failed: failed,
          registry_hits: registryHits,
          registry_misses: registryMisses,
          queued_for_review: queuedCount,
        },
      });

      // Step 13: Invalidate issue counts cache (force recalculation on next load)
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
    {
      connection,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? '5', 10)
    }
  );

  console.log(`[Normalize Worker] Started with concurrency ${parseInt(process.env.WORKER_CONCURRENCY ?? '5', 10)}`);

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

  // Start stalled job monitoring
  startStalledJobMonitoring(worker, 'Normalize Worker');

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
