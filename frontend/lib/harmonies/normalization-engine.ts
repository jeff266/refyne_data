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
import { extractHarmonyOutput, getEffectiveOutputFormat } from './output';

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
  outputFormat?: string;
  outputFormatsAvailable?: Array<{ key: string; label: string; default?: boolean }>;
  isPreset?: boolean;
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

  // Query cache - Supabase .in() doesn't support functions, so we fetch all for this harmony
  // and filter in memory. This is acceptable since cache is scoped to org+harmony.
  const { data, error } = await supabase
    .from('harmony_lookup_cache')
    .select('input_value, canonical_value, match_type, confidence')
    .eq('org_id', orgId)
    .eq('harmony_id', harmonyId);

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

  // Note: Database constraint uses lower(input_value), but Supabase upsert
  // doesn't support function-based constraints. We rely on the cache lookup
  // to handle case-insensitivity by lowercasing the search values.
  const { error } = await supabase
    .from('harmony_lookup_cache')
    .upsert(rows, {
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

    // Extract the appropriate field from canonical value based on output format
    let finalValue = result.canonical;

    // Check if canonical value is JSON (structured output)
    if (result.canonical && result.canonical.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(result.canonical);
        if (harmony.outputFormatsAvailable && harmony.outputFormatsAvailable.length > 0) {
          const effectiveFormat = harmony.outputFormat || 'default';
          finalValue = extractHarmonyOutput(parsed, effectiveFormat, harmony.outputFormatsAvailable);
        } else {
          // No output formats defined, use first value from JSON
          finalValue = typeof parsed === 'object' ? String(Object.values(parsed)[0] || result.canonical) : result.canonical;
        }
      } catch (e) {
        // Not valid JSON, use as-is
        finalValue = result.canonical;
      }
    }

    if (finalValue === raw) continue;

    changes.push({
      hubspotRecordId: record.id,
      field: harmony.field,
      harmonyId: harmony.id,
      before: raw,
      beforeDisplay: await getDisplayLabel(harmony.field, raw),
      after: finalValue,
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

/**
 * Check if input has mixed-case context suggesting intentional branding.
 * True if the string has both lowercase and uppercase letters.
 */
function hasMixedCaseContext(input: string): boolean {
  return /[a-z]/.test(input) && /[A-Z]/.test(input);
}

/**
 * Smart title case for company names.
 * Handles parentheses, abbreviations, brands, and conjunctions.
 */
function applySmartTitleCase(name: string): string {
  const conjunctions = new Set([
    'and', 'or', 'the', 'of', 'in', 'for', 'with', 'at', 'by', 'to', 'a', 'an'
  ]);

  return name
    .trim()
    .split(/(\s+|(?=[(/])|(?<=[)/]))/) // Split on spaces and around parens
    .map((token, index) => {
      // Preserve punctuation tokens
      if (/^[()\/\-&,.]$/.test(token)) return token;
      if (!token.trim()) return token;

      // Strip leading/trailing whitespace for checks but preserve in output
      const trimmed = token.trim();

      // Rule 1: All-caps token 3 chars or fewer → preserve uppercase (includes acronyms in parens)
      if (/^[A-Z]{1,3}$/.test(trimmed)) return token;

      // Rule 2: All-caps 4-5 chars in mixed-case context → preserve
      if (/^[A-Z]{4,5}$/.test(trimmed) && hasMixedCaseContext(name)) return token;

      // Rule 3: Mixed-case brand token (camelCase/PascalCase brands)
      if (/^[a-z].*[A-Z]/.test(trimmed) || /^[A-Z][a-z]+[A-Z]/.test(trimmed)) return token;

      // Rule 4: Conjunctions lowercase unless first word
      const lower = token.toLowerCase();
      if (index > 0 && conjunctions.has(trimmed.toLowerCase())) return lower;

      // Rule 5: Standard title case
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
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
