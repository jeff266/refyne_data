/**
 * Custom JSONata builtin functions for Harmony transformations.
 *
 * These functions extend JSONata with domain-specific utilities
 * for data normalization commonly needed in enrichment pipelines.
 */

import type jsonata from 'jsonata';
import * as chrono from 'chrono-node';

/**
 * Case normalization styles.
 */
export type CaseStyle = 'lower' | 'upper' | 'title' | 'sentence';

/**
 * Phone region codes for formatting.
 */
export type PhoneRegion = 'US' | 'UK' | 'DE' | 'FR' | 'AU' | 'international';

/**
 * Result of a pattern match operation.
 */
export interface PatternMatchResult {
  matched: boolean;
  groups: string[];
  fullMatch: string | null;
}

/**
 * Normalize string case.
 *
 * @param str - Input string
 * @param style - Case style: 'lower', 'upper', 'title', 'sentence'
 * @returns Normalized string or null if input is null/undefined
 *
 * @example
 * $normalize_case("ACME CORP", "title") => "Acme Corp"
 * $normalize_case("hello world", "sentence") => "Hello world"
 */
export function normalizeCase(str: unknown, style: unknown): string | null {
  if (str === null || str === undefined) return null;
  if (typeof str !== 'string') return String(str);

  const s = String(style || 'lower');

  switch (s) {
    case 'lower':
      return str.toLowerCase();

    case 'upper':
      return str.toUpperCase();

    case 'title':
      // Handle common title case edge cases
      return str
        .toLowerCase()
        .replace(/(?:^|\s|[-/])\S/g, (char) => char.toUpperCase());

    case 'sentence':
      // Capitalize first letter, rest lowercase
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

    default:
      return str.toLowerCase();
  }
}

/**
 * Clean whitespace in a string.
 * Collapses multiple spaces to single space and trims.
 *
 * @param str - Input string
 * @returns Cleaned string or null if input is null/undefined
 *
 * @example
 * $clean_whitespace("  Hello   World  ") => "Hello World"
 * $clean_whitespace("Line1\n\n\nLine2") => "Line1 Line2"
 */
export function cleanWhitespace(str: unknown): string | null {
  if (str === null || str === undefined) return null;
  if (typeof str !== 'string') return String(str).trim();

  return str
    .replace(/\s+/g, ' ') // Collapse all whitespace to single space
    .trim();
}

/**
 * Parse a numeric value from various string formats.
 * Handles currency symbols, abbreviations (K, M, B), and locale formatting.
 *
 * @param str - Input string with numeric value
 * @returns Parsed number or null if unparseable
 *
 * @example
 * $parse_number("$1.5M") => 1500000
 * $parse_number("15,000") => 15000
 * $parse_number("2.5B") => 2500000000
 * $parse_number("$500K") => 500000
 * $parse_number("1,234.56") => 1234.56
 */
export function parseNumber(str: unknown): number | null {
  if (str === null || str === undefined) return null;
  if (typeof str === 'number') return str;
  if (typeof str !== 'string') return null;

  // Remove currency symbols and whitespace
  let cleaned = str.replace(/[$\u20AC\u00A3\u00A5\s]/g, '');

  // Handle empty string
  if (cleaned === '') return null;

  // Check for multiplier suffixes (case insensitive)
  let multiplier = 1;
  const lastChar = cleaned.slice(-1).toUpperCase();

  if (lastChar === 'K') {
    multiplier = 1_000;
    cleaned = cleaned.slice(0, -1);
  } else if (lastChar === 'M') {
    multiplier = 1_000_000;
    cleaned = cleaned.slice(0, -1);
  } else if (lastChar === 'B') {
    multiplier = 1_000_000_000;
    cleaned = cleaned.slice(0, -1);
  } else if (lastChar === 'T') {
    multiplier = 1_000_000_000_000;
    cleaned = cleaned.slice(0, -1);
  }

  // Remove commas (thousand separators)
  cleaned = cleaned.replace(/,/g, '');

  // Handle negative numbers
  const isNegative = cleaned.startsWith('-') || cleaned.startsWith('(');
  cleaned = cleaned.replace(/[()-]/g, '');

  // Parse the base number
  const num = parseFloat(cleaned);

  if (isNaN(num)) return null;

  const result = num * multiplier;
  return isNegative ? -result : result;
}

/**
 * Format a phone number to a standard format.
 *
 * @param str - Input phone number string
 * @param region - Region code for formatting (default: 'US')
 * @returns Formatted phone string or null if invalid
 *
 * @example
 * $format_phone("4155551234", "US") => "+1 (415) 555-1234"
 * $format_phone("+1-415-555-1234", "US") => "+1 (415) 555-1234"
 * $format_phone("02012345678", "UK") => "+44 20 1234 5678"
 */
export function formatPhone(str: unknown, region: unknown): string | null {
  if (str === null || str === undefined) return null;
  if (typeof str !== 'string') str = String(str);

  // Extract only digits
  const digits = (str as string).replace(/\D/g, '');

  if (digits.length === 0) return null;

  const r = String(region || 'US').toUpperCase() as PhoneRegion;

  switch (r) {
    case 'US': {
      // US format: +1 (XXX) XXX-XXXX
      let num = digits;

      // Remove leading 1 if present and length is 11
      if (num.length === 11 && num.startsWith('1')) {
        num = num.slice(1);
      }

      if (num.length !== 10) {
        // Return cleaned but unformatted if not 10 digits
        return digits.length > 0 ? `+1 ${digits}` : null;
      }

      return `+1 (${num.slice(0, 3)}) ${num.slice(3, 6)}-${num.slice(6)}`;
    }

    case 'UK': {
      // UK format: +44 XX XXXX XXXX
      let num = digits;

      // Remove leading 44 if present
      if (num.startsWith('44')) {
        num = num.slice(2);
      }
      // Remove leading 0 if present
      if (num.startsWith('0')) {
        num = num.slice(1);
      }

      if (num.length < 9 || num.length > 10) {
        return digits.length > 0 ? `+44 ${digits}` : null;
      }

      // Format based on length
      if (num.length === 10) {
        return `+44 ${num.slice(0, 2)} ${num.slice(2, 6)} ${num.slice(6)}`;
      }
      return `+44 ${num.slice(0, 2)} ${num.slice(2, 5)} ${num.slice(5)}`;
    }

    case 'international':
    default: {
      // International: just clean and add + if missing
      if (digits.length < 7) return null;
      return `+${digits}`;
    }
  }
}

/**
 * Extract domain from a URL.
 *
 * @param url - Input URL string
 * @returns Domain string or null if invalid
 *
 * @example
 * $extract_domain("https://www.example.com/path") => "example.com"
 * $extract_domain("http://subdomain.example.co.uk/page") => "example.co.uk"
 * $extract_domain("example.com") => "example.com"
 */
export function extractDomain(url: unknown): string | null {
  if (url === null || url === undefined) return null;
  if (typeof url !== 'string') return null;

  let str = url.trim();
  if (str === '') return null;

  // Add protocol if missing (for URL parsing)
  if (!str.includes('://')) {
    str = 'https://' + str;
  }

  try {
    const parsed = new URL(str);
    let hostname = parsed.hostname.toLowerCase();

    // Remove www prefix
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }

    return hostname || null;
  } catch {
    // Try regex fallback for malformed URLs
    const match = str.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/i);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }
    return null;
  }
}

/**
 * Match a string against a regex pattern with capture groups.
 *
 * @param str - Input string to match
 * @param pattern - Regex pattern string
 * @returns Match result object with matched flag and groups array
 *
 * @example
 * $match_pattern("John Doe <john@example.com>", "(.+) <(.+@.+)>")
 *   => { matched: true, groups: ["John Doe", "john@example.com"], fullMatch: "John Doe <john@example.com>" }
 */
export function matchPattern(str: unknown, pattern: unknown): PatternMatchResult {
  const nullResult: PatternMatchResult = {
    matched: false,
    groups: [],
    fullMatch: null,
  };

  if (str === null || str === undefined) return nullResult;
  if (pattern === null || pattern === undefined) return nullResult;
  if (typeof str !== 'string' || typeof pattern !== 'string') return nullResult;

  try {
    const regex = new RegExp(pattern);
    const match = str.match(regex);

    if (!match) return nullResult;

    return {
      matched: true,
      groups: match.slice(1), // Capture groups (excluding full match)
      fullMatch: match[0],
    };
  } catch {
    // Invalid regex pattern
    return nullResult;
  }
}

/**
 * Return the first non-null, non-undefined, non-empty value.
 *
 * @param values - Array of values to check
 * @returns First truthy value or null if all are empty
 *
 * @example
 * $coalesce(null, "", "fallback") => "fallback"
 * $coalesce(undefined, 0, "text") => 0 (0 is valid, not empty)
 */
export function coalesce(...values: unknown[]): unknown {
  for (const val of values) {
    if (val === null || val === undefined) continue;
    if (typeof val === 'string' && val.trim() === '') continue;
    return val;
  }
  return null;
}

/**
 * Calculate Levenshtein-based similarity score between two strings.
 * Returns a value from 0 (completely different) to 1 (identical).
 *
 * @param a - First string
 * @param b - Second string
 * @returns Similarity score 0-1
 *
 * @example
 * $similarity("hello", "hello") => 1.0
 * $similarity("hello", "helo") => 0.8
 * $similarity("abc", "xyz") => 0.0
 */
export function similarity(a: unknown, b: unknown): number {
  if (a === null || a === undefined || b === null || b === undefined) return 0;

  const strA = String(a).toLowerCase();
  const strB = String(b).toLowerCase();

  if (strA === strB) return 1;
  if (strA.length === 0 || strB.length === 0) return 0;

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(strA, strB);
  const maxLength = Math.max(strA.length, strB.length);

  // Convert distance to similarity (0-1 scale)
  return 1 - distance / maxLength;
}

/**
 * Calculate Levenshtein distance between two strings.
 * Uses dynamic programming for O(n*m) time complexity.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Create distance matrix
  const d: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first column
  for (let i = 0; i <= m; i++) {
    d[i][0] = i;
  }

  // Initialize first row
  for (let j = 0; j <= n; j++) {
    d[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return d[m][n];
}

/**
 * Parse a date from natural language or various formats.
 * Uses chrono-node for flexible date parsing.
 *
 * @param str - Input string containing a date
 * @param format - Output format: 'iso' (default), 'date', 'timestamp', 'components'
 * @returns Parsed date in requested format, or null if unparseable
 *
 * @example
 * $parse_date("January 15, 2024") => "2024-01-15T00:00:00.000Z"
 * $parse_date("next Tuesday", "date") => "2024-01-23"
 * $parse_date("2 weeks ago", "timestamp") => 1704672000000
 * $parse_date("Mar 5th 2024", "components") => { year: 2024, month: 3, day: 5 }
 */
export function parseDate(
  str: unknown,
  format?: unknown
): string | number | { year: number; month: number; day: number } | null {
  if (str === null || str === undefined) return null;
  if (typeof str !== 'string') return null;

  const trimmed = str.trim();
  if (trimmed === '') return null;

  // Try to parse with chrono-node
  const parsed = chrono.parseDate(trimmed);
  if (!parsed) return null;

  const fmt = String(format || 'iso').toLowerCase();

  switch (fmt) {
    case 'iso':
      return parsed.toISOString();

    case 'date':
      // Return just the date portion YYYY-MM-DD
      return parsed.toISOString().split('T')[0];

    case 'timestamp':
      return parsed.getTime();

    case 'components':
      return {
        year: parsed.getFullYear(),
        month: parsed.getMonth() + 1, // 1-indexed
        day: parsed.getDate(),
      };

    default:
      return parsed.toISOString();
  }
}

/**
 * Interface for the builtins registry.
 */
export interface BuiltinFunction {
  name: string;
  fn: (...args: unknown[]) => unknown;
  signature: string;
  description: string;
}

/**
 * Registry of all builtin functions.
 */
export const BUILTIN_FUNCTIONS: BuiltinFunction[] = [
  {
    name: 'normalize_case',
    fn: normalizeCase,
    signature: '<s-s:s>',
    description: 'Normalize string case: lower, upper, title, or sentence',
  },
  {
    name: 'clean_whitespace',
    fn: cleanWhitespace,
    signature: '<s:s>',
    description: 'Collapse multiple spaces and trim whitespace',
  },
  {
    name: 'parse_number',
    fn: parseNumber,
    signature: '<s:n>',
    description: 'Parse number from formatted string ($1.5M, 15,000, etc)',
  },
  {
    name: 'format_phone',
    fn: formatPhone,
    signature: '<s-s:s>',
    description: 'Format phone number for region (US, UK, international)',
  },
  {
    name: 'extract_domain',
    fn: extractDomain,
    signature: '<s:s>',
    description: 'Extract domain from URL',
  },
  {
    name: 'match_pattern',
    fn: matchPattern,
    signature: '<s-s:o>',
    description: 'Match string against regex pattern with capture groups',
  },
  {
    name: 'coalesce',
    fn: coalesce,
    signature: '<x+:x>',
    description: 'Return first non-null, non-empty value',
  },
  {
    name: 'similarity',
    fn: similarity,
    signature: '<s-s:n>',
    description: 'Calculate Levenshtein similarity score 0-1',
  },
  {
    name: 'parse_date',
    fn: parseDate,
    signature: '<s-s?:x>',
    description: 'Parse date from natural language (iso, date, timestamp, components)',
  },
];

/**
 * Register all builtin functions on a JSONata expression.
 *
 * @param expr - Compiled JSONata expression
 */
export function registerBuiltins(expr: jsonata.Expression): void {
  for (const builtin of BUILTIN_FUNCTIONS) {
    expr.registerFunction(builtin.name, builtin.fn, builtin.signature);
  }
}

/**
 * Get documentation for all builtin functions.
 * Useful for editor autocomplete and help text.
 */
export function getBuiltinDocs(): Array<{
  name: string;
  signature: string;
  description: string;
}> {
  return BUILTIN_FUNCTIONS.map(({ name, signature, description }) => ({
    name: `$${name}`,
    signature,
    description,
  }));
}
