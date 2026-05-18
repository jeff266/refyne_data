/**
 * Normalized Records Writer
 *
 * Writes normalization results to the normalized_records table.
 * Used by the normalization pipeline and batch writer to track compliance.
 */

import { supabase, isSupabaseConfigured } from '../db/supabase';
import {
  getHarmonyById,
  loadLibraryHarmonies,
  getHarmoniesByEntity,
  getLibraryHarmonies,
} from '../harmonies/library';
import { Normalizer } from '../harmonies/pipeline/normalizer';
import type { ValidatedHarmony } from '../harmonies/spec/schema';
import type { RawCandidate } from '../harmonies/pipeline/types';
import type { NormalizedRecordInput, ComplianceStatus, RecordType } from './types';

// ─────────────────────────────────────────────────────────────
// Field Processing
// ─────────────────────────────────────────────────────────────

/**
 * Field normalization result.
 */
export interface FieldNormalizationResult {
  field: string;
  rawValue: string | null;
  normalizedValue: string | null;
  harmonyId: string | null;
  harmonyVersion: string | null;
  status: ComplianceStatus;
}

/**
 * Canonical field to Harmony field path mapping.
 */
const FIELD_TO_HARMONY_PATH: Record<string, string> = {
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
  email: 'email',
  first_name: 'person.name',
  last_name: 'person.name',
  title: 'person.title',
};

/**
 * Normalize a single field value and return the result.
 */
export async function normalizeFieldValue(
  field: string,
  rawValue: unknown,
  record: Record<string, unknown>,
  entity: 'company' | 'person' = 'company'
): Promise<FieldNormalizationResult> {
  // Ensure harmonies are loaded
  loadLibraryHarmonies();

  const stringValue = rawValue !== null && rawValue !== undefined
    ? String(rawValue)
    : null;

  // Find applicable harmony
  const harmonyPath = FIELD_TO_HARMONY_PATH[field];
  if (!harmonyPath) {
    // No harmony mapping for this field
    return {
      field,
      rawValue: stringValue,
      normalizedValue: stringValue,
      harmonyId: null,
      harmonyVersion: null,
      status: stringValue ? 'unprocessed' : 'compliant',
    };
  }

  // Find harmony that applies to this field path
  const harmony = findHarmonyForPath(harmonyPath, entity);

  if (!harmony) {
    // No harmony for this field
    return {
      field,
      rawValue: stringValue,
      normalizedValue: stringValue,
      harmonyId: null,
      harmonyVersion: null,
      status: stringValue ? 'unprocessed' : 'compliant',
    };
  }

  // Skip if no value to normalize
  if (stringValue === null || stringValue === '') {
    return {
      field,
      rawValue: null,
      normalizedValue: null,
      harmonyId: harmony.spec.id,
      harmonyVersion: harmony.spec.version,
      status: 'compliant',
    };
  }

  // Run normalization
  const normalizer = new Normalizer([harmony]);
  const candidate: RawCandidate = {
    value: stringValue,
    source: 'hubspot',
    retrieved_at: new Date().toISOString(),
    record,
  };

  const result = await normalizer.normalize(candidate);

  if (result.success && result.candidate) {
    const normalizedValue = result.candidate.value !== null && result.candidate.value !== undefined
      ? String(result.candidate.value)
      : null;

    // Check if harmony actually transformed the value
    const wasTransformed = result.candidate.harmony_applied !== null;

    return {
      field,
      rawValue: stringValue,
      normalizedValue,
      harmonyId: harmony.spec.id,
      harmonyVersion: harmony.spec.version,
      status: wasTransformed ? 'compliant' : 'unprocessed',
    };
  }

  // Normalization failed - mark as unprocessed
  return {
    field,
    rawValue: stringValue,
    normalizedValue: null,
    harmonyId: harmony.spec.id,
    harmonyVersion: harmony.spec.version,
    status: 'unprocessed',
  };
}

/**
 * Find a harmony for a given field path and entity.
 */
function findHarmonyForPath(
  path: string,
  entity: 'company' | 'person'
): ValidatedHarmony | null {
  const harmonies = getHarmoniesByEntity(entity);

  return harmonies.find(h =>
    h.spec.applies_to.fields.includes(path)
  ) || null;
}

// ─────────────────────────────────────────────────────────────
// Record Writing
// ─────────────────────────────────────────────────────────────

/**
 * Write a single normalized record field to the database.
 */
export async function writeNormalizedRecord(
  input: NormalizedRecordInput
): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    return;
  }

  const now = new Date().toISOString();
  const status: ComplianceStatus = input.harmonyId ? 'compliant' : 'unprocessed';

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
    console.error('Error writing normalized record:', error);
  }
}

/**
 * Write multiple normalized record fields in batch.
 * Fire-and-forget to avoid blocking the main pipeline.
 */
export function writeNormalizedRecordsBatch(
  inputs: NormalizedRecordInput[]
): void {
  if (!isSupabaseConfigured() || !supabase || inputs.length === 0) {
    return;
  }

  const now = new Date().toISOString();

  const records = inputs.map(input => {
    const status: ComplianceStatus = input.harmonyId ? 'compliant' : 'unprocessed';
    return {
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
    };
  });

  // Fire and forget - don't await
  supabase
    .from('normalized_records')
    .upsert(records, { onConflict: 'org_id,record_id,field' })
    .then(({ error }) => {
      if (error) {
        console.error('Error batch writing normalized records:', error);
      }
    });
}

/**
 * Process and write all fields for a record.
 * Used by the batch writer after normalization.
 */
export async function processAndWriteRecordFields(
  orgId: string,
  recordId: string,
  recordType: RecordType,
  properties: Record<string, unknown>,
  source: string = 'hubspot'
): Promise<FieldNormalizationResult[]> {
  const entity = recordType === 'company' ? 'company' : 'person';
  const results: FieldNormalizationResult[] = [];
  const inputs: NormalizedRecordInput[] = [];

  // Define fields to process based on record type
  const fieldsToProcess = recordType === 'company'
    ? ['name', 'domain', 'industry', 'employee_count', 'annual_revenue', 'hq_city', 'hq_state', 'hq_country', 'phone', 'linkedin_url']
    : ['email', 'first_name', 'last_name', 'title', 'phone'];

  // Map property names to canonical fields
  const propertyMapping: Record<string, string> = {
    name: 'name',
    domain: 'domain',
    industry: 'industry',
    numberofemployees: 'employee_count',
    annualrevenue: 'annual_revenue',
    city: 'hq_city',
    state: 'hq_state',
    country: 'hq_country',
    phone: 'phone',
    linkedin_company_page: 'linkedin_url',
    email: 'email',
    firstname: 'first_name',
    lastname: 'last_name',
    jobtitle: 'title',
  };

  for (const field of fieldsToProcess) {
    // Find the HubSpot property for this canonical field
    const hubspotProp = Object.entries(propertyMapping)
      .find(([_, canonical]) => canonical === field)?.[0];

    const rawValue = hubspotProp ? properties[hubspotProp] : properties[field];

    const result = await normalizeFieldValue(field, rawValue, properties, entity);
    results.push(result);

    inputs.push({
      orgId,
      recordId,
      recordType,
      source,
      field: result.field,
      rawValue: result.rawValue,
      normalizedValue: result.normalizedValue,
      harmonyId: result.harmonyId,
      harmonyVersion: result.harmonyVersion,
    });
  }

  // Write all fields in batch (fire-and-forget)
  writeNormalizedRecordsBatch(inputs);

  return results;
}

/**
 * Get current harmony versions for stale detection.
 */
export function getCurrentHarmonyVersions(): Map<string, string> {
  loadLibraryHarmonies();
  const harmonies = getLibraryHarmonies();

  const versions = new Map<string, string>();
  for (const harmony of harmonies) {
    versions.set(harmony.spec.id, harmony.spec.version);
  }

  return versions;
}
