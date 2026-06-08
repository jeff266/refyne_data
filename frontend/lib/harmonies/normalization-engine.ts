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
import {
  evaluateConditionGroups,
  getConditionFields,
  type ConditionGroups,
} from './condition-evaluator';
import { parsePhoneNumber } from 'libphonenumber-js';

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
  conditionGroups?: ConditionGroups | null; // NEW: Conditional execution
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

// ── Required Properties Helper ─────────────────────────────────────

/**
 * Collect all HubSpot properties needed for harmony execution.
 * Includes both write target fields AND condition source fields.
 * Used to minimize API payload size by only fetching required properties.
 */
export function getRequiredProperties(harmonies: Harmony[]): Set<string> {
  const properties = new Set<string>();

  for (const harmony of harmonies) {
    // Add write target field (extract property name from canonical field)
    if (harmony.field) {
      const propertyName = harmony.field.includes('.')
        ? harmony.field.split('.').pop()
        : harmony.field;
      if (propertyName) properties.add(propertyName);
    }

    // Add condition source fields
    if (harmony.conditionGroups) {
      const conditionFields = getConditionFields(harmony.conditionGroups);
      conditionFields.forEach(field => properties.add(field));
    }
  }

  return properties;
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

  // CONDITIONAL EXECUTION: Filter records by condition groups
  // NULL/undefined conditionGroups = run on all records (existing behavior)
  const eligibleRecords = harmony.conditionGroups
    ? records.filter(record =>
        evaluateConditionGroups(record, harmony.conditionGroups!)
      )
    : records;

  if (eligibleRecords.length === 0) {
    console.log(`[Normalization Engine] Harmony ${harmony.id}: 0 records matched conditions`);
    return [];
  }

  // Get HubSpot property name from field assignments
  const hubspotProperty = await getHubSpotProperty(harmony, orgId);
  if (!hubspotProperty) {
    console.warn(`[Normalization Engine] No property mapping for harmony ${harmony.id}`);
    return [];
  }

  // 1. Collect unique non-empty field values (from eligible records only)
  const uniqueValues = Array.from(
    new Set(
      eligibleRecords
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

  // 5. Generate change list (only for eligible records)
  const changes: NormalizationResult[] = [];

  for (const record of eligibleRecords) {
    const raw = record[hubspotProperty];
    if (!raw) continue;

    const rawStr = String(raw ?? '').trim();
    const result = allMappings.get(rawStr.toLowerCase());
    if (!result || result.matchType === 'none') continue;
    if (result.canonical === raw) continue;

    // Extract the appropriate field from canonical value based on output format
    let finalValue = result.canonical;

    // Check if canonical value is JSON (structured output)
    const canonicalStr = String(result.canonical ?? '').trim();
    if (result.canonical && canonicalStr.startsWith('{')) {
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

/**
 * Format international national number with appropriate spacing.
 * Handles common country-specific formatting patterns.
 */
function formatInternationalNational(countryCode: string, nationalNumber: string): string {
  // UK: 20 7010 2000 (area code + local)
  if (countryCode === '44' && nationalNumber.length === 10) {
    return `${nationalNumber.slice(0, 2)} ${nationalNumber.slice(2, 6)} ${nationalNumber.slice(6)}`;
  }
  // Australia: 2 9374 4000
  if (countryCode === '61' && nationalNumber.length === 9) {
    return `${nationalNumber.slice(0, 1)} ${nationalNumber.slice(1, 5)} ${nationalNumber.slice(5)}`;
  }
  // Default: group in threes from the right
  const groups: string[] = [];
  let remaining = nationalNumber;
  while (remaining.length > 0) {
    if (remaining.length <= 4) {
      groups.unshift(remaining);
      break;
    }
    groups.unshift(remaining.slice(-3));
    remaining = remaining.slice(0, -3);
  }
  return groups.join(' ');
}

function normalizePhoneE164(phone: string, config?: Record<string, any>): string | null {
  // E.164 normalization with configurable default country code and format
  const defaultCountryCode = config?.default_country_code || '1';
  const stripExtensions = config?.strip_extensions ?? true;
  const format = config?.format || 'e164_compact';

  // Safe string coercion
  const phoneStr = String(phone ?? '');

  // Remove extension if enabled
  let cleaned = phoneStr;
  if (stripExtensions) {
    // Remove common extension patterns (x123, ext 123, #123)
    cleaned = phoneStr.replace(/\s*(x|ext\.?|extension|#)\s*\d+$/i, '');
  }

  // CHECK 1: Vanity Number Translation
  // If input contains letters (A-Z after stripping formatting), translate to digits
  const VANITY_MAP: Record<string, string> = {
    A: '2', B: '2', C: '2',
    D: '3', E: '3', F: '3',
    G: '4', H: '4', I: '4',
    J: '5', K: '5', L: '5',
    M: '6', N: '6', O: '6',
    P: '7', Q: '7', R: '7', S: '7',
    T: '8', U: '8', V: '8',
    W: '9', X: '9', Y: '9', Z: '9',
  };

  if (/[A-Za-z]/.test(cleaned)) {
    const original = cleaned;
    cleaned = cleaned.toUpperCase().split('').map(char => VANITY_MAP[char] || char).join('');
    console.log(`[Phone] Vanity number translated: ${original} → ${cleaned}`);
  }

  // BUG FIX: Detect "1 " or "1-" prefix (US country code without +)
  // This handles inputs like "1 (310) 387-9598" or "1-310-387-9598"
  const trimmed = cleaned.trim();
  if (trimmed.startsWith('1 ') || trimmed.startsWith('1-')) {
    cleaned = '+' + trimmed;
  }

  const digits = cleaned.replace(/\D/g, '');

  // CHECK 2: Shortcode Detection
  // If digit count < 7, skip normalization entirely (shortcodes like 911, 12345)
  if (digits.length < 7) {
    console.log(`[Phone] Shortcode detected, skipping: ${digits}`);
    return null;
  }

  // Determine country code and national number
  let countryCode = defaultCountryCode;
  let nationalNumber = digits;

  // Check if already has country code (starts with +)
  if (cleaned.trim().startsWith('+') && digits.length >= 7 && digits.length <= 15) {
    // Extract country code based on known patterns
    if (digits.startsWith('1') && digits.length === 11) {
      // US/Canada: +1 XXXXXXXXXX
      countryCode = '1';
      nationalNumber = digits.slice(1);
    } else if (digits.startsWith('44')) {
      // UK: +44 XXXXXXXXXX
      countryCode = '44';
      nationalNumber = digits.slice(2);
    } else if (digits.startsWith('61')) {
      // Australia: +61 XXXXXXXXX
      countryCode = '61';
      nationalNumber = digits.slice(2);
    } else if (digits.startsWith('33')) {
      // France: +33 XXXXXXXXX
      countryCode = '33';
      nationalNumber = digits.slice(2);
    } else if (digits.startsWith('49')) {
      // Germany: +49 XXXXXXXXXX
      countryCode = '49';
      nationalNumber = digits.slice(2);
    } else {
      // Other international: try to detect country code length (1-3 digits)
      // Assume single digit country code for simplicity
      if (digits.length >= 8 && digits[0] !== '0') {
        countryCode = digits[0];
        nationalNumber = digits.slice(1);
      } else {
        // Can't determine, use as-is
        nationalNumber = digits;
      }
    }
  } else if (digits.length === 10) {
    // 10-digit number → use default country code
    nationalNumber = digits;
  } else if (digits.length === 11 && digits[0] === defaultCountryCode[0]) {
    // 11-digit number starting with country code
    countryCode = defaultCountryCode;
    nationalNumber = digits.slice(1);
  } else if (digits.length < 7) {
    // Invalid length
    return null;
  }

  // Apply formatting based on config
  let result: string;
  if (format === 'e164_formatted') {
    // Formatted international output using libphonenumber-js for accurate country code detection
    try {
      let parsed;
      // Try parsing the cleaned string first (preserves original + if present)
      try {
        parsed = parsePhoneNumber(cleaned.trim());
      } catch {
        // If that fails, try with digits prefixed with +
        parsed = parsePhoneNumber(`+${digits}`);
      }

      if (parsed && parsed.isValid()) {
        if (parsed.country === 'US' || parsed.country === 'CA') {
          // US/Canada format: +1 (XXX) XXX-XXXX
          const national = parsed.nationalNumber;
          result = `+1 (${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
        } else {
          // Non-US: use country code from parser + compact national number (single space)
          result = `+${parsed.countryCallingCode} ${parsed.nationalNumber}`;
        }
      } else {
        // Fallback if parsing failed or invalid
        if (countryCode === '1' && nationalNumber.length === 10) {
          result = `+1 (${nationalNumber.slice(0, 3)}) ${nationalNumber.slice(3, 6)}-${nationalNumber.slice(6)}`;
        } else {
          result = `+${countryCode} ${nationalNumber}`;
        }
      }
    } catch (error) {
      // Fallback on any error
      if (countryCode === '1' && nationalNumber.length === 10) {
        result = `+1 (${nationalNumber.slice(0, 3)}) ${nationalNumber.slice(3, 6)}-${nationalNumber.slice(6)}`;
      } else {
        result = `+${countryCode} ${nationalNumber}`;
      }
    }
  } else if (format === 'e164_dashes') {
    // International with dashes: +1 310-387-9598
    if (countryCode === '1' && nationalNumber.length === 10) {
      // US format: +1 XXX-XXX-XXXX
      result = `+1 ${nationalNumber.slice(0, 3)}-${nationalNumber.slice(3, 6)}-${nationalNumber.slice(6)}`;
    } else {
      // International: replace spaces with dashes in national part
      // For non-US, format as: +CC national-with-dashes
      const spacedNational = formatInternationalNational(countryCode, nationalNumber);
      result = `+${countryCode} ${spacedNational.replace(/\s/g, '-')}`;
    }
  } else if (format === 'e164_spaces') {
    // International with spaces: +1 310 387 9598
    if (countryCode === '1' && nationalNumber.length === 10) {
      // US format: +1 XXX XXX XXXX
      result = `+1 ${nationalNumber.slice(0, 3)} ${nationalNumber.slice(3, 6)} ${nationalNumber.slice(6)}`;
    } else {
      // International: format with spaces
      const spacedNational = formatInternationalNational(countryCode, nationalNumber);
      result = `+${countryCode} ${spacedNational}`;
    }
  } else if (format === 'national') {
    // National format (US only): (XXX) XXX-XXXX
    if (nationalNumber.length === 10) {
      result = `(${nationalNumber.slice(0, 3)}) ${nationalNumber.slice(3, 6)}-${nationalNumber.slice(6)}`;
    } else {
      result = nationalNumber;
    }
    // National format doesn't need E.164 length validation (no + sign)
    return result;
  } else if (format === 'e164_international') {
    // Legacy alias for e164_formatted
    if (countryCode === '1' && nationalNumber.length === 10) {
      result = `+1 (${nationalNumber.slice(0, 3)}) ${nationalNumber.slice(3, 6)}-${nationalNumber.slice(6)}`;
    } else {
      result = `+${countryCode} ${nationalNumber}`;
    }
  } else {
    // e164_compact (default): +CCXXXXXXXXXX
    result = `+${countryCode}${nationalNumber}`;
  }

  // CHECK 3: E.164 Length Validation
  // E.164 max length: 16 characters total (+ sign + up to 15 digits)
  // Only validate formats that start with + (skip national format)
  if (result.startsWith('+')) {
    const e164Digits = result.replace(/\D/g, '');
    // E.164 allows max 15 digits (not counting the + sign)
    if (e164Digits.length > 15) {
      console.log(`[Phone] Invalid E.164 length (${e164Digits.length} digits), skipping: ${result}`);
      return null;
    }
  }

  return result;
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
  const str = String(input ?? '').trim();
  if (!str) return input;
  const trimmed = str;

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
  const str = String(input ?? '').trim();
  return str
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

// US States mapping for state_abbreviate function
const US_STATES: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ',
  'arkansas': 'AR', 'california': 'CA', 'colorado': 'CO',
  'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL',
  'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA',
  'maine': 'ME', 'maryland': 'MD', 'massachusetts': 'MA',
  'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE',
  'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', 'tennessee': 'TN',
  'texas': 'TX', 'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA',
  'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI',
  'wyoming': 'WY', 'district of columbia': 'DC',
  // Common abbreviation variants
  'calif': 'CA', 'calif.': 'CA', 'tex': 'TX', 'tex.': 'TX',
  'fla': 'FL', 'fla.': 'FL', 'mich': 'MI', 'mich.': 'MI',
};

// Common countries mapping for country_code_iso2 function
const COMMON_COUNTRIES: Record<string, string> = {
  'united states': 'US', 'usa': 'US', 'u.s.a.': 'US',
  'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB',
  'canada': 'CA', 'australia': 'AU', 'germany': 'DE',
  'france': 'FR', 'spain': 'ES', 'italy': 'IT',
  'netherlands': 'NL', 'sweden': 'SE', 'norway': 'NO',
  'denmark': 'DK', 'finland': 'FI', 'switzerland': 'CH',
  'austria': 'AT', 'belgium': 'BE', 'ireland': 'IE',
  'new zealand': 'NZ', 'singapore': 'SG', 'japan': 'JP',
  'india': 'IN', 'brazil': 'BR', 'mexico': 'MX',
  'israel': 'IL', 'south africa': 'ZA', 'uae': 'AE',
  'united arab emirates': 'AE',
};

const FORMAT_FUNCTIONS: Record<string, FormatFn> = {
  'e164_phone': normalizePhoneE164,
  'email_lowercase': (v) => String(v ?? '').toLowerCase().trim(),
  'linkedin_url': normalizeLinkedInUrl,
  'smart_title_case': applySmartTitleCase,
  'numeric_parse': normalizeNumeric,
  'url_canonical': (v: string) => {
    try {
      const str = String(v ?? '');
      const url = new URL(str.startsWith('http') ? str : `https://${str}`);
      return url.toString();
    } catch {
      return null;
    }
  },
  // Tier 1 format functions
  'trim_whitespace': (v: string) => String(v ?? '').trim().replace(/\s+/g, ' '),
  'employee_range': (v: string) => {
    const n = parseInt(v.replace(/[^0-9]/g, ''));
    if (isNaN(n)) return v;
    if (n <= 1) return '1';
    if (n <= 10) return '2-10';
    if (n <= 50) return '11-50';
    if (n <= 200) return '51-200';
    if (n <= 500) return '201-500';
    if (n <= 1000) return '501-1000';
    if (n <= 5000) return '1001-5000';
    if (n <= 10000) return '5001-10000';
    return '10001+';
  },
  'extract_domain': (v: string) => {
    try {
      const str = String(v ?? '');
      const url = str.startsWith('http') ? str : `https://${str}`;
      const domain = new URL(url).hostname
        .replace(/^www\./, '')
        .toLowerCase();
      return domain;
    } catch {
      // Not a URL, try treating as raw domain
      return String(v ?? '').replace(/^www\./, '').toLowerCase().trim();
    }
  },
  'state_abbreviate': (v: string) => {
    const str = String(v ?? '').trim();
    const lower = str.toLowerCase();
    // Already a 2-letter code
    if (/^[a-z]{2}$/.test(lower)) return str.toUpperCase();
    return US_STATES[lower] ?? v;
  },
  'country_code_iso2': (v: string) => {
    const str = String(v ?? '').trim();
    const lower = str.toLowerCase();
    // Check map first (handles both full names and common abbreviations like 'uk' -> 'GB')
    const mapped = COMMON_COUNTRIES[lower];
    if (mapped) return mapped;
    // If already 2 letters and not in map, assume it's already ISO2
    if (/^[a-z]{2}$/.test(lower)) return str.toUpperCase();
    // Unrecognized country, return as-is
    return str;
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

  // CONDITIONAL EXECUTION: Filter records by condition groups
  // NULL/undefined conditionGroups = run on all records (existing behavior)
  const eligibleRecords = harmony.conditionGroups
    ? records.filter(record =>
        evaluateConditionGroups(record, harmony.conditionGroups!)
      )
    : records;

  if (eligibleRecords.length === 0) {
    console.log(`[Normalization Engine] Harmony ${harmony.id}: 0 records matched conditions`);
    return [];
  }

  // Get HubSpot property name from field assignments
  const hubspotProperty = await getHubSpotProperty(harmony, orgId);
  if (!hubspotProperty) {
    console.warn(`[Normalization Engine] No property mapping for harmony ${harmony.id}`);
    return [];
  }

  const changes: NormalizationResult[] = [];
  const config = harmony.transformConfig || {};

  for (const record of eligibleRecords) {
    const raw = record[hubspotProperty];
    if (!raw) continue;

    // Safe string coercion for format functions
    const rawStr = String(raw ?? '');
    const formatted = formatFn(rawStr, config);
    if (!formatted || formatted === rawStr) continue;

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
