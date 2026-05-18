/**
 * Batch Writer
 *
 * Orchestrates batch write operations to HubSpot with dedup gate
 * and field-level write policy enforcement.
 */

import type { RawRecord } from '../mcp/types';
import type { FieldMapping } from './types';
import type {
  BatchWriteInput,
  BatchWriteResult,
  RecordWriteResult,
  DedupGateResult,
} from './write-types';
import type { HubSpotClient, CompanyIndex } from './client';
import { checkDedupGate, addToReviewQueue } from './dedup-gate';
import { canonicalToHubSpotProperties, getDefaultWriteMappings } from './inverse-mapper';
import { processAndWriteRecordFields } from '../compliance/normalized-records-writer';

/**
 * Extended batch write result with index stats.
 */
export interface BatchWriteResultWithIndex extends BatchWriteResult {
  indexStats?: {
    totalCompanies: number;
    companiesWithParent: number;
    parentChildPairsDetected: number;
    suppressionsCreated: number;
  };
}

/**
 * Execute batch write to HubSpot with dedup gate and policy enforcement.
 *
 * Flow:
 * 1. Build company index (domain, LinkedIn, parent associations)
 * 2. Run dedup gate for all records using index
 * 3. Group records by action (upsert/insert/review/skip)
 * 4. Add review items to queue
 * 5. Prepare write payloads with policy enforcement
 * 6. Execute batch write (100 records per request)
 * 7. Return detailed results with index stats
 */
export async function executeBatchWrite(
  input: BatchWriteInput,
  client: HubSpotClient,
  mappings?: FieldMapping[],
  orgId?: string
): Promise<BatchWriteResultWithIndex> {
  const startTime = Date.now();
  const results: RecordWriteResult[] = [];
  const fieldMappings = mappings || getDefaultWriteMappings();

  let dedupCheckMs = 0;
  let writeMs = 0;
  let indexBuildMs = 0;

  // ─────────────────────────────────────────────────────────────
  // Phase 0: Build company index for O(1) dedup lookups
  // ─────────────────────────────────────────────────────────────
  const indexStart = Date.now();
  let companyIndex: CompanyIndex | undefined;

  // Only build index for batch mode (more than 10 records)
  if (input.records.length > 10) {
    try {
      companyIndex = await client.buildCompanyIndex();
      console.log(`Built company index: ${companyIndex.totalCompanies} companies, ${companyIndex.companiesWithParent} with parent associations`);
    } catch (err) {
      console.warn('Failed to build company index, falling back to API calls:', err);
    }
  }
  indexBuildMs = Date.now() - indexStart;

  // ─────────────────────────────────────────────────────────────
  // Phase 1: Run dedup gate for all records
  // ─────────────────────────────────────────────────────────────
  const dedupStart = Date.now();
  const dedupResults = new Map<string, DedupGateResult>();

  for (const record of input.records) {
    const recordId = record._id as string;
    const dedupResult = await checkDedupGate(record, client, orgId, companyIndex);
    dedupResults.set(recordId, dedupResult);
  }
  dedupCheckMs = Date.now() - dedupStart;

  // ─────────────────────────────────────────────────────────────
  // Phase 2: Group records by action
  // ─────────────────────────────────────────────────────────────
  const toUpsert: Array<{ record: RawRecord; targetId: string }> = [];
  const toInsert: RawRecord[] = [];
  const toReview: Array<{ record: RawRecord; dedupResult: DedupGateResult }> = [];

  for (const record of input.records) {
    const recordId = record._id as string;
    const dedupResult = dedupResults.get(recordId)!;

    switch (dedupResult.action) {
      case 'upsert':
        toUpsert.push({ record, targetId: dedupResult.targetHubSpotId! });
        break;
      case 'insert':
        toInsert.push(record);
        break;
      case 'review':
        toReview.push({ record, dedupResult });
        break;
      case 'skip':
        results.push({
          recordId,
          hubspotId: null,
          action: 'skipped',
          dedupOutcome: dedupResult,
          fieldsUpdated: [],
          fieldsSkipped: [],
        });
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Phase 3: Add review items to queue
  // ─────────────────────────────────────────────────────────────
  for (const { record, dedupResult } of toReview) {
    addToReviewQueue(record, dedupResult);
    results.push({
      recordId: record._id as string,
      hubspotId: null,
      action: 'queued_for_review',
      dedupOutcome: dedupResult,
      fieldsUpdated: [],
      fieldsSkipped: [],
    });
  }

  // If dry run, return now without writing
  if (input.dryRun) {
    // Simulate what would happen using current values from company index
    for (const { record, targetId } of toUpsert) {
      // Get current HubSpot values from company index
      const companyEntry = companyIndex?.companyMap.get(targetId);
      const currentValues = companyEntry?.rawProperties || {};

      const { decisions } = canonicalToHubSpotProperties(
        record,
        fieldMappings,
        currentValues
      );
      results.push({
        recordId: record._id as string,
        hubspotId: targetId,
        action: 'updated',
        dedupOutcome: dedupResults.get(record._id as string)!,
        fieldsUpdated: decisions.filter(d => d.action === 'write'),
        fieldsSkipped: decisions.filter(d => d.action === 'skip'),
      });
    }

    for (const record of toInsert) {
      const { decisions } = canonicalToHubSpotProperties(
        record,
        fieldMappings,
        {} // New records have no current values
      );
      results.push({
        recordId: record._id as string,
        hubspotId: null,
        action: 'created',
        dedupOutcome: dedupResults.get(record._id as string)!,
        fieldsUpdated: decisions.filter(d => d.action === 'write'),
        fieldsSkipped: decisions.filter(d => d.action === 'skip'),
      });
    }

    return buildResult(input.records.length, results, dedupCheckMs, 0, startTime);
  }

  // ─────────────────────────────────────────────────────────────
  // Phase 4: Prepare and execute writes
  // ─────────────────────────────────────────────────────────────
  const writeStart = Date.now();

  // Process upserts (need to fetch current values for policy check)
  if (toUpsert.length > 0) {
    // Batch fetch current values
    const targetIds = toUpsert.map(u => u.targetId);
    const currentRecords = await client.getCompaniesByIds(targetIds);
    const currentValuesMap = new Map(
      currentRecords.map(r => [r.id, r.properties])
    );

    // Prepare update payloads
    const updatePayloads: Array<{
      id: string;
      properties: Record<string, string | number | null>;
      recordId: string;
      decisions: ReturnType<typeof canonicalToHubSpotProperties>['decisions'];
    }> = [];

    for (const { record, targetId } of toUpsert) {
      const currentValues = currentValuesMap.get(targetId) || {};
      const { properties, decisions } = canonicalToHubSpotProperties(
        record,
        fieldMappings,
        currentValues
      );

      // Only include if there are fields to write
      const fieldsToWrite = decisions.filter(d => d.action === 'write');
      if (fieldsToWrite.length > 0 && Object.keys(properties).length > 0) {
        updatePayloads.push({
          id: targetId,
          properties,
          recordId: record._id as string,
          decisions,
        });
      } else {
        // No changes needed
        results.push({
          recordId: record._id as string,
          hubspotId: targetId,
          action: 'skipped',
          dedupOutcome: dedupResults.get(record._id as string)!,
          fieldsUpdated: [],
          fieldsSkipped: decisions,
        });
      }
    }

    // Execute batch update
    if (updatePayloads.length > 0) {
      const updateResponse = await client.batchUpdateCompanies(
        updatePayloads.map(p => ({ id: p.id, properties: p.properties }))
      );

      // Map results back
      const successIds = new Set(updateResponse.results.map(r => r.id));

      for (const payload of updatePayloads) {
        const success = successIds.has(payload.id);
        results.push({
          recordId: payload.recordId,
          hubspotId: payload.id,
          action: success ? 'updated' : 'error',
          dedupOutcome: dedupResults.get(payload.recordId)!,
          fieldsUpdated: success ? payload.decisions.filter(d => d.action === 'write') : [],
          fieldsSkipped: payload.decisions.filter(d => d.action === 'skip'),
          error: success ? undefined : 'Update failed',
        });

        // Write compliance records for successful updates (fire-and-forget)
        if (success && orgId) {
          const record = toUpsert.find(u => u.targetId === payload.id)?.record;
          if (record) {
            processAndWriteRecordFields(
              orgId,
              payload.id,
              'company',
              record as Record<string, unknown>,
              'hubspot'
            ).catch(err => console.error('Error writing compliance records:', err));
          }
        }
      }
    }
  }

  // Process inserts
  if (toInsert.length > 0) {
    const insertPayloads: Array<{
      properties: Record<string, string | number | null>;
      recordId: string;
      decisions: ReturnType<typeof canonicalToHubSpotProperties>['decisions'];
    }> = [];

    for (const record of toInsert) {
      const { properties, decisions } = canonicalToHubSpotProperties(
        record,
        fieldMappings,
        {} // No current values for new records
      );

      if (Object.keys(properties).length > 0) {
        insertPayloads.push({
          properties,
          recordId: record._id as string,
          decisions,
        });
      } else {
        results.push({
          recordId: record._id as string,
          hubspotId: null,
          action: 'error',
          dedupOutcome: dedupResults.get(record._id as string)!,
          fieldsUpdated: [],
          fieldsSkipped: decisions,
          error: 'No fields to write',
        });
      }
    }

    // Execute batch create
    if (insertPayloads.length > 0) {
      const createResponse = await client.batchCreateCompanies(
        insertPayloads.map(p => ({ properties: p.properties }))
      );

      // Map results back (in order)
      for (let i = 0; i < insertPayloads.length; i++) {
        const payload = insertPayloads[i];
        const apiResult = createResponse.results[i];
        const error = createResponse.errors.find(e => e.index === i);

        if (apiResult && !error) {
          results.push({
            recordId: payload.recordId,
            hubspotId: apiResult.id,
            action: 'created',
            dedupOutcome: dedupResults.get(payload.recordId)!,
            fieldsUpdated: payload.decisions.filter(d => d.action === 'write'),
            fieldsSkipped: payload.decisions.filter(d => d.action === 'skip'),
          });

          // Write compliance records for successful creates (fire-and-forget)
          if (orgId) {
            const record = toInsert.find(r => r._id === payload.recordId);
            if (record) {
              processAndWriteRecordFields(
                orgId,
                apiResult.id,
                'company',
                record as Record<string, unknown>,
                'hubspot'
              ).catch(err => console.error('Error writing compliance records:', err));
            }
          }
        } else {
          results.push({
            recordId: payload.recordId,
            hubspotId: null,
            action: 'error',
            dedupOutcome: dedupResults.get(payload.recordId)!,
            fieldsUpdated: [],
            fieldsSkipped: payload.decisions,
            error: error?.error || 'Create failed',
          });
        }
      }
    }
  }

  writeMs = Date.now() - writeStart;

  // Count parent-child detections and suppressions
  let parentChildPairsDetected = 0;
  let suppressionsCreated = 0;
  for (const result of results) {
    if (result.dedupOutcome.warning?.includes('Parent-child')) {
      parentChildPairsDetected++;
      suppressionsCreated++;
    }
  }

  const baseResult = buildResult(input.records.length, results, dedupCheckMs + indexBuildMs, writeMs, startTime);

  return {
    ...baseResult,
    indexStats: companyIndex ? {
      totalCompanies: companyIndex.totalCompanies,
      companiesWithParent: companyIndex.companiesWithParent,
      parentChildPairsDetected,
      suppressionsCreated,
    } : undefined,
  };
}

/**
 * Build the final batch write result.
 */
function buildResult(
  total: number,
  results: RecordWriteResult[],
  dedupCheckMs: number,
  writeMs: number,
  startTime: number
): BatchWriteResult {
  return {
    total,
    created: results.filter(r => r.action === 'created').length,
    updated: results.filter(r => r.action === 'updated').length,
    skipped: results.filter(r => r.action === 'skipped').length,
    queuedForReview: results.filter(r => r.action === 'queued_for_review').length,
    errors: results.filter(r => r.action === 'error').length,
    results,
    timing: {
      totalMs: Date.now() - startTime,
      dedupCheckMs,
      writeMs,
    },
  };
}
