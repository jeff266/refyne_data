/**
 * Normalization Engine - Bulk HubSpot Record Normalization
 *
 * Applies harmonies to existing HubSpot records and returns a preview
 * of changes for user review before applying to HubSpot.
 *
 * Supports two transformation types:
 * - lookup: Reference table JOIN with fuzzy/phonetic matching
 * - format: Algorithmic transformations (phone, email, etc.)
 */

import { supabase } from '@/lib/db/supabase';

// ── Types ──────────────────────────────────────────────────────────

export interface HubSpotRecord {
  id: string;
  [field: string]: any;
}

export interface Harmony {
  id: string;
  name: string;
  field: string;
  objectType: 'company' | 'contact';
  transformType: 'lookup' | 'format';
  referenceTable?: string;
  fuzzyThreshold?: number;
  phoneticEnabled?: boolean;
  isActive: boolean;
}

export interface NormalizationResult {
  hubspotRecordId: string;
  field: string;
  harmonyId: string;
  before: string;
  beforeDisplay: string;
  after: string;
  matchType: 'exact' | 'fuzzy' | 'phonetic' | 'none';
  confidence: number;
  requiresReview: boolean;
  // true if fuzzy/phonetic match — user should verify
}

interface LookupResult {
  canonical: string;
  matchType: 'exact' | 'fuzzy' | 'phonetic' | 'none';
  confidence: number;
}

interface LookupCacheRow {
  input_value: string;
  canonical_value: string | null;
  match_type: 'exact' | 'fuzzy' | 'phonetic' | 'none';
  confidence: number;
}

interface BatchLookupRow {
  input_value: string;
  canonical_value: string | null;
  match_type: 'exact' | 'fuzzy' | 'phonetic' | 'none';
  confidence: number;
}

// ── Cache Helpers ──────────────────────────────────────────────────

async function getCachedLookups(
  orgId: string,
  harmonyId: string,
  values: string[]
): Promise<Map<string, LookupResult>> {
  if (values.length === 0) return new Map();
  if (!supabase) return new Map();

  const { data, error } = await supabase
    .from('harmony_lookup_cache')
    .select('input_value, canonical_value, match_type, confidence')
    .eq('org_id', orgId)
    .eq('harmony_id', harmonyId)
    .in('lower(input_value)', values.map((v) => v.toLowerCase()));

  if (error) {
    console.warn('[Normalization Engine] Cache lookup failed:', error);
    return new Map();
  }

  const cache = new Map<string, LookupResult>();
  for (const row of (data || []) as LookupCacheRow[]) {
    cache.set(row.input_value.toLowerCase(), {
      canonical: row.canonical_value || '',
      matchType: row.match_type,
      confidence: row.confidence,
    });
  }

  return cache;
}

async function cacheLookups(
  orgId: string,
  harmonyId: string,
  mappings: Map<string, LookupResult>
): Promise<void> {
  if (mappings.size === 0) return;
  if (!supabase) return;

  const rows = Array.from(mappings.entries()).map(([input, result]) => ({
    org_id: orgId,
    harmony_id: harmonyId,
    input_value: input,
    canonical_value: result.canonical,
    match_type: result.matchType,
    confidence: result.confidence,
  }));

  const { error } = await supabase
    .from('harmony_lookup_cache')
    .upsert(rows, {
      onConflict: 'org_id,harmony_id,lower(input_value)',
      ignoreDuplicates: false,
    });

  if (error) {
    console.warn('[Normalization Engine] Cache write failed:', error);
  }
}

// ── Display Label Helper ───────────────────────────────────────────

async function getDisplayLabel(field: string, value: string): Promise<string> {
  // For now, just return the value
  // In the future, could fetch label from HubSpot API for enum fields
  return value;
}

// ── Lookup Harmony (Reference Table JOIN) ──────────────────────────

export async function applyLookupHarmony(
  records: HubSpotRecord[],
  harmony: Harmony,
  orgId: string
): Promise<NormalizationResult[]> {
  if (!harmony.referenceTable) {
    throw new Error(`Harmony ${harmony.id} has no reference_table`);
  }

  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  // 1. Collect unique non-empty field values
  const uniqueValues = Array.from(
    new Set(
      records
        .map((r) => r[harmony.field])
        .filter((v) => v && typeof v === 'string' && v.trim().length > 0)
    )
  );

  if (uniqueValues.length === 0) return [];

  // 2. Check cache first
  const cached = await getCachedLookups(orgId, harmony.id, uniqueValues);
  const uncachedValues = uniqueValues.filter((v) => !cached.has(v.toLowerCase()));

  // 3. Batch lookup for uncached values
  let freshMappings = new Map<string, LookupResult>();

  if (uncachedValues.length > 0) {
    const { data, error } = await supabase.rpc('batch_lookup_harmony', {
      p_table_name: harmony.referenceTable,
      p_input_values: uncachedValues,
      p_org_id: orgId,
      p_fuzzy_threshold: harmony.fuzzyThreshold ?? 0.8,
      p_phonetic_enabled: harmony.phoneticEnabled ?? false,
    });

    if (error) {
      console.error('[Normalization Engine] Batch lookup failed:', error);
      throw error;
    }

    freshMappings = new Map(
      (data || []).map((row: BatchLookupRow) => [
        row.input_value.toLowerCase(),
        {
          canonical: row.canonical_value || '',
          matchType: row.match_type,
          confidence: row.confidence,
        },
      ])
    );

    // 4. Cache results
    await cacheLookups(orgId, harmony.id, freshMappings);
  }

  const allMappings = new Map<string, LookupResult>();
  cached.forEach((value, key) => allMappings.set(key, value));
  freshMappings.forEach((value, key) => allMappings.set(key, value));

  // 5. Generate change list
  const changes: NormalizationResult[] = [];

  for (const record of records) {
    const raw = record[harmony.field];
    if (!raw) continue;

    const result = allMappings.get(raw.toLowerCase().trim());
    if (!result || result.matchType === 'none') continue;
    if (result.canonical === raw) continue;

    changes.push({
      hubspotRecordId: record.id,
      field: harmony.field,
      harmonyId: harmony.id,
      before: raw,
      beforeDisplay: await getDisplayLabel(harmony.field, raw),
      after: result.canonical,
      matchType: result.matchType,
      confidence: result.confidence,
      requiresReview: result.matchType !== 'exact',
      // fuzzy and phonetic matches need human verification
    });
  }

  return changes;
}

// ── Format Harmony (Algorithmic) ───────────────────────────────────

function normalizePhoneE164(phone: string): string | null {
  // Simple E.164 normalization - strips non-digits, adds +1 for US
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    return `+${digits}`;
  }
  return null;
}

function normalizeLinkedInUrl(url: string): string | null {
  // Normalize LinkedIn URLs to canonical format
  const match = url.match(/linkedin\.com\/(?:in|company)\/([^/?]+)/i);
  if (!match) return null;
  const slug = match[1];
  return url.includes('/company/')
    ? `https://linkedin.com/company/${slug}`
    : `https://linkedin.com/in/${slug}`;
}

function applySmartTitleCase(name: string): string {
  // Smart title case for company names
  const words = name.toLowerCase().split(' ');
  const titleCased = words.map((word) => {
    // Keep common acronyms uppercase
    if (['llc', 'inc', 'corp', 'ltd', 'plc', 'lp', 'llp'].includes(word)) {
      return word.toUpperCase();
    }
    // Capitalize first letter
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
  return titleCased.join(' ');
}

const FORMAT_FUNCTIONS: Record<string, (value: string) => string | null> = {
  'phone-e164': normalizePhoneE164,
  'email-lowercase': (v) => v.toLowerCase().trim(),
  'linkedin-url': normalizeLinkedInUrl,
  'company-name': applySmartTitleCase,
};

export async function applyFormatHarmony(
  records: HubSpotRecord[],
  harmony: Harmony
): Promise<NormalizationResult[]> {
  const formatFn = FORMAT_FUNCTIONS[harmony.id];
  if (!formatFn) {
    throw new Error(`No format function for harmony ${harmony.id}`);
  }

  const changes: NormalizationResult[] = [];

  for (const record of records) {
    const raw = record[harmony.field];
    if (!raw) continue;

    const formatted = formatFn(raw);
    if (!formatted || formatted === raw) continue;

    changes.push({
      hubspotRecordId: record.id,
      field: harmony.field,
      harmonyId: harmony.id,
      before: raw,
      beforeDisplay: raw,
      after: formatted,
      matchType: 'exact',
      confidence: 100,
      requiresReview: false,
    });
  }

  return changes;
}

// ── Main Entry Point ───────────────────────────────────────────────

export async function runNormalizationPreview(
  records: HubSpotRecord[],
  harmonies: Harmony[],
  orgId: string
): Promise<NormalizationResult[]> {
  const allChanges: NormalizationResult[] = [];

  for (const harmony of harmonies.filter((h) => h.isActive)) {
    const changes =
      harmony.transformType === 'lookup'
        ? await applyLookupHarmony(records, harmony, orgId)
        : await applyFormatHarmony(records, harmony);

    allChanges.push(...changes);
  }

  return allChanges;
}

// ── Clear Cache Helper ─────────────────────────────────────────────

export async function clearLookupCache(orgId: string, harmonyId: string): Promise<void> {
  if (!supabase) {
    console.warn('[Normalization Engine] Supabase not configured, cannot clear cache');
    return;
  }

  const { error } = await supabase
    .from('harmony_lookup_cache')
    .delete()
    .eq('org_id', orgId)
    .eq('harmony_id', harmonyId);

  if (error) {
    console.error('[Normalization Engine] Failed to clear cache:', error);
  }
}
