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
import { getFieldAssignments } from './field-assignments';

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
  transformFunction?: string | null;
  transformConfig?: Record<string, any>;
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

// ── Field Assignment Helper ────────────────────────────────────────

/**
 * Get HubSpot property name for a harmony using field assignments.
 * Falls back to extracting from canonical field if no assignment found.
 */
async function getHubSpotProperty(
  harmony: Harmony,
  orgId: string
): Promise<string | null> {
  // Try to get from field assignments first
  try {
    const assignments = await getFieldAssignments(orgId, harmony.objectType);

    // Match on both harmonyId AND canonical field
    const assignment = assignments.find(
      a => a.harmonyId === harmony.id && a.canonicalField === harmony.field
    );

    if (assignment) {
      return assignment.hubspotProperty;
    }
  } catch (err) {
    console.warn('[Normalization Engine] Failed to get field assignment:', err);
  }

  // Fallback: extract from canonical field (legacy behavior)
  if (harmony.field.includes('.')) {
    return harmony.field.split('.').pop() || null;
  }
  return harmony.field;
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

  // Get HubSpot property name from field assignments
  const hubspotProperty = await getHubSpotProperty(harmony, orgId);
  if (!hubspotProperty) {
    console.warn(`[Normalization Engine] No property mapping for harmony ${harmony.id}`);
    return [];
  }

  // 1. Collect unique non-empty field values
  const uniqueValues = Array.from(
    new Set(
      records
        .map((r) => r[hubspotProperty])
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
    const raw = record[hubspotProperty];
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

function normalizePhoneE164(phone: string, config?: Record<string, any>): string | null {
  // E.164 normalization with configurable default country code
  const defaultCountryCode = config?.default_country_code || '1';
  const stripExtensions = config?.strip_extensions ?? true;

  // Remove extension if enabled
  let cleaned = phone;
  if (stripExtensions) {
    // Remove common extension patterns (x123, ext 123, #123)
    cleaned = phone.replace(/\s*(x|ext\.?|extension|#)\s*\d+$/i, '');
  }

  const digits = cleaned.replace(/\D/g, '');

  // Check if already in E.164 format (starts with + and has 7-15 digits)
  // If so, return cleaned version without spaces/dashes
  if (cleaned.trim().startsWith('+') && digits.length >= 7 && digits.length <= 15) {
    return `+${digits}`;
  }

  // 10-digit number → add country code
  if (digits.length === 10) {
    return `+${defaultCountryCode}${digits}`;
  }

  // 11-digit number starting with country code
  if (digits.length === 11 && digits[0] === defaultCountryCode[0]) {
    return `+${digits}`;
  }

  // Invalid length or format
  return null;
}

function normalizeLinkedInUrl(url: string): string | null {
  // Normalize LinkedIn URLs to canonical format with www prefix
  const match = url.match(/linkedin\.com\/(?:in|company)\/([^/?]+)/i);
  if (!match) return null;
  const slug = match[1];
  return url.includes('/company/')
    ? `https://www.linkedin.com/company/${slug}`
    : `https://www.linkedin.com/in/${slug}`;
}

/**
 * Check if input has mixed-case context suggesting intentional branding.
 * True if the string has both lowercase and uppercase letters.
 */
function hasMixedCaseContext(input: string): boolean {
  return /[a-z]/.test(input) && /[A-Z]/.test(input);
}

/**
 * Brand token map: lowercase input → canonical output
 * Loaded from company-name.yaml config via configureTitleCase()
 */
let BRAND_TOKEN_MAP: Map<string, string> = new Map();
let CONJUNCTION_SET: Set<string> = new Set([
  'and','or','the','of','in','for','with','at','by','to','a','an',
  'but','nor','so','yet','as'
]);
let HONOR_HYPHEN_BOUNDARY: boolean = true;

/**
 * Configure title case with brand tokens and conjunctions from harmony config
 */
export function configureTitleCase(config: {
  brandTokens?: string[]
  conjunctions?: string[]
  honorHyphenBoundary?: boolean
}) {
  if (config.brandTokens) {
    BRAND_TOKEN_MAP = new Map(
      config.brandTokens.map(token => [token.toLowerCase(), token])
    );
  }
  if (config.conjunctions) {
    CONJUNCTION_SET = new Set(config.conjunctions);
  }
  if (config.honorHyphenBoundary !== undefined) {
    HONOR_HYPHEN_BOUNDARY = config.honorHyphenBoundary;
  }
}

/**
 * Fetch org-specific name exceptions from database (without Redis caching for now)
 */
export async function getOrgNameExceptions(orgId: string): Promise<Set<string>> {
  if (!supabase) return new Set();

  try {
    const { data, error } = await supabase
      .from('normalize_name_exceptions')
      .select('exact_value')
      .eq('org_id', orgId);

    if (error) {
      console.warn('[Smart Title Case] Failed to fetch org exceptions:', error);
      return new Set();
    }

    return new Set((data || []).map((r: any) => r.exact_value));
  } catch (err) {
    console.warn('[Smart Title Case] Error fetching org exceptions:', err);
    return new Set();
  }
}

/**
 * Smart title case with hyphen boundary awareness, brand tokens, and org exceptions
 */
export function toSmartTitleCase(
  input: string,
  config?: { orgExceptions?: Set<string> }
): string {
  if (!input?.trim()) return input;
  const trimmed = input.trim();

  // Rule 0: Org exception → return exact stored value (case-insensitive match)
  if (config?.orgExceptions) {
    const exceptions = Array.from(config.orgExceptions);
    for (const exception of exceptions) {
      if (exception.toLowerCase() === trimmed.toLowerCase()) {
        return exception;
      }
    }
  }

  // Detect if input has mixed case (for Rule 4: preserve 4-5 char acronyms in mixed context)
  const inputHasMixedCase = /[a-z]/.test(trimmed) && /[A-Z]/.test(trimmed);

  // Tokenize: split on whitespace and around ( ) / but keep - attached
  const tokens = tokenizeForTitleCase(trimmed);

  const result: string[] = [];
  let prevSignificantDelimiter = 'start';  // 'start' | 'space' | 'hyphen' | 'paren' | 'slash'

  for (const token of tokens) {
    // Pure whitespace or punctuation delimiters: pass through, update delimiter state
    if (/^[\s]+$/.test(token)) {
      result.push(' ');  // Collapse multiple spaces to single space
      prevSignificantDelimiter = 'space';
      continue;
    }
    if (token === '-') {
      result.push(token);
      prevSignificantDelimiter = 'hyphen';
      continue;
    }
    if (token === '(' || token === ')' || token === '/') {
      result.push(token);
      prevSignificantDelimiter = 'paren';
      continue;
    }
    if (/^[&,.]$/.test(token)) {
      result.push(token);
      continue;
    }

    const isFirst = prevSignificantDelimiter === 'start';
    const afterHyphen = prevSignificantDelimiter === 'hyphen';

    result.push(transformTitleCaseToken(token, isFirst, afterHyphen, inputHasMixedCase));
    prevSignificantDelimiter = 'space';
  }

  return result.join('');
}

/**
 * Tokenize for title case: split on whitespace and around ( ) / -
 */
function tokenizeForTitleCase(input: string): string[] {
  // Split on whitespace (keeping delimiter), and split before/after ( ) /
  // Keep hyphens as their own token so we can track afterHyphen state
  return input.split(/(\s+|(?=[()/])|(?<=[()/])|(?=-)(?<!=)|(?<=-)(?!-))/)
    .filter(t => t !== undefined && t.length > 0);
}

/**
 * Tokenize function for backward compatibility with existing tests
 * @deprecated Use toSmartTitleCase instead
 */
export function tokenize(input: string): string[] {
  if (!input) return [];

  // Old tokenization logic for backward compatibility with tests
  return input
    .trim()
    .split(/(\s+)|(\()|(\))|(\-)|([/&,.])/)
    .filter(token => token !== undefined && token.length > 0);
}

/**
 * Transform a single title case token
 */
function transformTitleCaseToken(
  token: string,
  isFirst: boolean,
  afterHyphen: boolean,
  inputHasMixedCase: boolean = false
): string {
  if (!token) return token;
  const lower = token.toLowerCase();

  // Rule 1: Brand token map (case-insensitive lookup)
  const brand = BRAND_TOKEN_MAP.get(lower);
  if (brand) return brand;

  // Rule 2: Conjunctions → lowercase unless first word (check BEFORE acronyms!)
  // This ensures AND, OF, etc. are lowercased even though they're 2-3 chars
  // Special case: first word or after hyphen (if honorHyphenBoundary) → title-cased
  if (CONJUNCTION_SET.has(lower)) {
    if (isFirst || (afterHyphen && HONOR_HYPHEN_BOUNDARY)) {
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }
    return lower;
  }

  // Rule 3: All-caps ≤3 chars → preserve (IBM, AI, YC, US, LLC, Inc)
  if (/^[A-Z]{1,3}$/.test(token)) return token;

  // Rule 3.5: All-caps with periods → preserve acronyms (A.B.C., I.B.M.)
  if (/^[A-Z](\.[A-Z])+\.?$/.test(token)) return token;

  // Rule 4: All-caps 4-5 chars in mixed-case input context → preserve (LEARN Behavioral)
  if (/^[A-Z]{4,5}$/.test(token) && inputHasMixedCase) return token;

  // Rule 5: Tokens containing digits → preserve (B2B, t10r, Web3, iOS)
  if (/\d/.test(token)) return token;

  // Rule 6: Mixed-case interior caps → preserve brand casing (iPhone, eBay, FedEx)
  // Require lowercase at END to avoid matching random mixed case like "aCmE"
  const isCamelCase = /^[a-z]+[A-Z][a-z]+$/.test(token); // iPhone, eBay
  const isPascalCase = /^[A-Z][a-z]+[A-Z][a-z]+$/.test(token); // FedEx, HubSpot
  if (isCamelCase || isPascalCase) return token;

  // Rule 7: After hyphen → title case (not conjunction rule)
  // Fixes: In-Q-Tel, Cloud-Based, t-Mobile
  if (afterHyphen) {
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  // Rule 8: Default → standard title case
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Smart title case for company names (wrapper for backward compatibility)
 * Handles parentheses, abbreviations, brands, and conjunctions.
 */
function applySmartTitleCase(name: string, config?: Record<string, any>): string {
  if (!name) return name;

  // For now, call toSmartTitleCase without org exceptions
  // Org exceptions will be loaded separately when needed
  return toSmartTitleCase(name);
}

/**
 * Parse numeric values from strings (employees, revenue, etc.)
 * Handles formats like "50-100", "$1.5M", "100k employees"
 */
function normalizeNumeric(value: string, config?: Record<string, any>): string | null {
  // Remove currency symbols, commas, and whitespace
  const cleaned = value.replace(/[$,\s]/g, '');

  // Handle range formats (take midpoint)
  const rangeMatch = cleaned.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    return String(Math.round((low + high) / 2));
  }

  // Handle K/M/B suffixes
  const suffixMatch = cleaned.match(/^(\d+(?:\.\d+)?)(k|m|b)$/i);
  if (suffixMatch) {
    const num = parseFloat(suffixMatch[1]);
    const suffix = suffixMatch[2].toLowerCase();
    const multiplier = suffix === 'k' ? 1000 : suffix === 'm' ? 1000000 : 1000000000;
    return String(Math.round(num * multiplier));
  }

  // Handle plain numbers
  const numMatch = cleaned.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) {
    return String(Math.round(parseFloat(numMatch[1])));
  }

  return null;
}

type FormatFn = (value: string, config?: Record<string, any>) => string | null;

const FORMAT_FUNCTIONS: Record<string, FormatFn> = {
  'e164_phone': normalizePhoneE164,
  'email_lowercase': (v) => v.toLowerCase().trim(),
  'linkedin_url': normalizeLinkedInUrl,
  'smart_title_case': applySmartTitleCase,
  'numeric_parse': normalizeNumeric,
  'url_canonical': (v: string) => {
    try {
      const url = new URL(v.startsWith('http') ? v : `https://${v}`);
      return url.toString();
    } catch {
      return null;
    }
  },
};

export async function applyFormatHarmony(
  records: HubSpotRecord[],
  harmony: Harmony,
  orgId: string
): Promise<NormalizationResult[]> {
  // Look up format function using transform_function (data-driven)
  // Fallback to harmony.id for backward compatibility during transition
  const functionKey = harmony.transformFunction || harmony.id;
  const formatFn = FORMAT_FUNCTIONS[functionKey];

  if (!formatFn) {
    throw new Error(
      `No format function for harmony ${harmony.id}. ` +
      `Tried transform_function='${harmony.transformFunction}' and harmony.id='${harmony.id}'`
    );
  }

  // Get HubSpot property name from field assignments
  const hubspotProperty = await getHubSpotProperty(harmony, orgId);
  if (!hubspotProperty) {
    console.warn(`[Normalization Engine] No property mapping for harmony ${harmony.id}`);
    return [];
  }

  const changes: NormalizationResult[] = [];
  const config = harmony.transformConfig || {};

  for (const record of records) {
    const raw = record[hubspotProperty];
    if (!raw) continue;

    const formatted = formatFn(raw, config);
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
        : await applyFormatHarmony(records, harmony, orgId);

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
