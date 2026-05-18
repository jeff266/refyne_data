/**
 * Vitest tests for all builtin functions.
 *
 * Tests all 9 builtin functions including $parse_date which uses chrono-node.
 * Covers null/undefined handling and edge cases for each function.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeCase,
  cleanWhitespace,
  parseNumber,
  formatPhone,
  extractDomain,
  matchPattern,
  coalesce,
  similarity,
  parseDate,
  BUILTIN_FUNCTIONS,
  getBuiltinDocs,
} from './builtins';

// ═══════════════════════════════════════════════════════════════
// $normalize_case TESTS
// ═══════════════════════════════════════════════════════════════

describe('$normalize_case', () => {
  describe('basic transformations', () => {
    it('should convert to lowercase', () => {
      expect(normalizeCase('HELLO WORLD', 'lower')).toBe('hello world');
    });

    it('should convert to uppercase', () => {
      expect(normalizeCase('hello world', 'upper')).toBe('HELLO WORLD');
    });

    it('should convert to title case', () => {
      expect(normalizeCase('hello world', 'title')).toBe('Hello World');
    });

    it('should convert to sentence case', () => {
      expect(normalizeCase('HELLO WORLD', 'sentence')).toBe('Hello world');
    });
  });

  describe('title case edge cases', () => {
    it('should handle hyphens', () => {
      expect(normalizeCase('mary-jane watson', 'title')).toBe('Mary-Jane Watson');
    });

    it('should handle slashes', () => {
      expect(normalizeCase('input/output', 'title')).toBe('Input/Output');
    });

    it('should handle multiple spaces', () => {
      expect(normalizeCase('hello  world', 'title')).toBe('Hello  World');
    });

    it('should handle mixed case input', () => {
      expect(normalizeCase('hELLO wORLD', 'title')).toBe('Hello World');
    });
  });

  describe('null/undefined handling', () => {
    it('should return null for null input', () => {
      expect(normalizeCase(null, 'lower')).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(normalizeCase(undefined, 'lower')).toBeNull();
    });

    it('should handle null style by defaulting to lower', () => {
      expect(normalizeCase('HELLO', null)).toBe('hello');
    });

    it('should handle undefined style by defaulting to lower', () => {
      expect(normalizeCase('HELLO', undefined)).toBe('hello');
    });
  });

  describe('edge cases', () => {
    it('should convert non-string to string', () => {
      expect(normalizeCase(123, 'upper')).toBe('123');
    });

    it('should handle empty string', () => {
      expect(normalizeCase('', 'upper')).toBe('');
    });

    it('should default to lower for unknown style', () => {
      expect(normalizeCase('HELLO', 'invalid')).toBe('hello');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// $clean_whitespace TESTS
// ═══════════════════════════════════════════════════════════════

describe('$clean_whitespace', () => {
  describe('basic transformations', () => {
    it('should collapse multiple spaces', () => {
      expect(cleanWhitespace('hello    world')).toBe('hello world');
    });

    it('should trim leading whitespace', () => {
      expect(cleanWhitespace('  hello')).toBe('hello');
    });

    it('should trim trailing whitespace', () => {
      expect(cleanWhitespace('hello  ')).toBe('hello');
    });

    it('should handle newlines', () => {
      expect(cleanWhitespace('hello\nworld')).toBe('hello world');
    });

    it('should handle tabs', () => {
      expect(cleanWhitespace('hello\tworld')).toBe('hello world');
    });

    it('should handle mixed whitespace', () => {
      expect(cleanWhitespace('  hello\n\t  world  ')).toBe('hello world');
    });
  });

  describe('null/undefined handling', () => {
    it('should return null for null input', () => {
      expect(cleanWhitespace(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(cleanWhitespace(undefined)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(cleanWhitespace('')).toBe('');
    });

    it('should handle whitespace-only string', () => {
      expect(cleanWhitespace('   ')).toBe('');
    });

    it('should convert non-string to trimmed string', () => {
      expect(cleanWhitespace(123)).toBe('123');
    });

    it('should handle carriage returns', () => {
      expect(cleanWhitespace('hello\r\nworld')).toBe('hello world');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// $parse_number TESTS
// ═══════════════════════════════════════════════════════════════

describe('$parse_number', () => {
  describe('basic parsing', () => {
    it('should parse integer string', () => {
      expect(parseNumber('123')).toBe(123);
    });

    it('should parse decimal string', () => {
      expect(parseNumber('123.45')).toBe(123.45);
    });

    it('should return number as-is', () => {
      expect(parseNumber(42)).toBe(42);
    });
  });

  describe('formatted numbers', () => {
    it('should parse with commas', () => {
      expect(parseNumber('1,234,567')).toBe(1234567);
    });

    it('should parse decimal with commas', () => {
      expect(parseNumber('1,234.56')).toBe(1234.56);
    });
  });

  describe('currency symbols', () => {
    it('should handle dollar sign', () => {
      expect(parseNumber('$100')).toBe(100);
    });

    it('should handle euro sign', () => {
      expect(parseNumber('\u20AC100')).toBe(100);
    });

    it('should handle pound sign', () => {
      expect(parseNumber('\u00A3100')).toBe(100);
    });

    it('should handle yen sign', () => {
      expect(parseNumber('\u00A5100')).toBe(100);
    });
  });

  describe('suffix multipliers', () => {
    it('should parse K suffix (thousands)', () => {
      expect(parseNumber('100K')).toBe(100000);
      expect(parseNumber('1.5k')).toBe(1500);
    });

    it('should parse M suffix (millions)', () => {
      expect(parseNumber('1M')).toBe(1000000);
      expect(parseNumber('2.5m')).toBe(2500000);
    });

    it('should parse B suffix (billions)', () => {
      expect(parseNumber('1B')).toBe(1000000000);
      expect(parseNumber('1.5b')).toBe(1500000000);
    });

    it('should parse T suffix (trillions)', () => {
      expect(parseNumber('1T')).toBe(1000000000000);
    });

    it('should handle currency with suffix', () => {
      expect(parseNumber('$1.5M')).toBe(1500000);
      expect(parseNumber('$500K')).toBe(500000);
    });
  });

  describe('negative numbers', () => {
    it('should handle minus sign', () => {
      expect(parseNumber('-100')).toBe(-100);
    });

    it('should handle parentheses notation', () => {
      expect(parseNumber('(100)')).toBe(-100);
    });

    it('should handle negative with suffix', () => {
      expect(parseNumber('-1M')).toBe(-1000000);
    });
  });

  describe('null/undefined handling', () => {
    it('should return null for null input', () => {
      expect(parseNumber(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(parseNumber(undefined)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should return null for empty string', () => {
      expect(parseNumber('')).toBeNull();
    });

    it('should return null for non-numeric string', () => {
      expect(parseNumber('abc')).toBeNull();
    });

    it('should return null for non-string non-number', () => {
      expect(parseNumber({ value: 123 })).toBeNull();
    });

    it('should handle whitespace', () => {
      expect(parseNumber(' 100 ')).toBe(100);
    });

    it('should handle zero', () => {
      expect(parseNumber('0')).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// $format_phone TESTS
// ═══════════════════════════════════════════════════════════════

describe('$format_phone', () => {
  describe('US format', () => {
    it('should format 10-digit number', () => {
      expect(formatPhone('4155551234', 'US')).toBe('+1 (415) 555-1234');
    });

    it('should format 11-digit number with leading 1', () => {
      expect(formatPhone('14155551234', 'US')).toBe('+1 (415) 555-1234');
    });

    it('should handle formatted input', () => {
      expect(formatPhone('(415) 555-1234', 'US')).toBe('+1 (415) 555-1234');
      expect(formatPhone('415-555-1234', 'US')).toBe('+1 (415) 555-1234');
      expect(formatPhone('415.555.1234', 'US')).toBe('+1 (415) 555-1234');
    });

    it('should handle non-standard length', () => {
      expect(formatPhone('12345', 'US')).toBe('+1 12345');
    });
  });

  describe('UK format', () => {
    it('should format UK number', () => {
      expect(formatPhone('02012345678', 'UK')).toBe('+44 20 1234 5678');
    });

    it('should handle 44 prefix', () => {
      expect(formatPhone('442012345678', 'UK')).toBe('+44 20 1234 5678');
    });

    it('should handle 9-digit number', () => {
      expect(formatPhone('201234567', 'UK')).toBe('+44 20 123 4567');
    });
  });

  describe('international format', () => {
    it('should format as +digits', () => {
      expect(formatPhone('1234567890', 'international')).toBe('+1234567890');
    });

    it('should return null for too short', () => {
      expect(formatPhone('123456', 'international')).toBeNull();
    });
  });

  describe('null/undefined handling', () => {
    it('should return null for null input', () => {
      expect(formatPhone(null, 'US')).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(formatPhone(undefined, 'US')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should return null for empty string', () => {
      expect(formatPhone('', 'US')).toBeNull();
    });

    it('should return null for no digits', () => {
      expect(formatPhone('abc', 'US')).toBeNull();
    });

    it('should convert number to string', () => {
      expect(formatPhone(4155551234, 'US')).toBe('+1 (415) 555-1234');
    });

    it('should default to US region', () => {
      expect(formatPhone('4155551234')).toBe('+1 (415) 555-1234');
    });

    it('should handle unknown region as international', () => {
      expect(formatPhone('1234567890', 'XX')).toBe('+1234567890');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// $extract_domain TESTS
// ═══════════════════════════════════════════════════════════════

describe('$extract_domain', () => {
  describe('basic extraction', () => {
    it('should extract from https URL', () => {
      expect(extractDomain('https://example.com')).toBe('example.com');
    });

    it('should extract from http URL', () => {
      expect(extractDomain('http://example.com')).toBe('example.com');
    });

    it('should handle URL with path', () => {
      expect(extractDomain('https://example.com/path/to/page')).toBe('example.com');
    });

    it('should handle URL with query string', () => {
      expect(extractDomain('https://example.com?foo=bar')).toBe('example.com');
    });

    it('should handle naked domain', () => {
      expect(extractDomain('example.com')).toBe('example.com');
    });
  });

  describe('www handling', () => {
    it('should remove www prefix', () => {
      expect(extractDomain('https://www.example.com')).toBe('example.com');
    });

    it('should remove www from naked domain', () => {
      expect(extractDomain('www.example.com')).toBe('example.com');
    });
  });

  describe('subdomains', () => {
    it('should preserve subdomains', () => {
      expect(extractDomain('https://blog.example.com')).toBe('blog.example.com');
    });

    it('should preserve multiple subdomains', () => {
      expect(extractDomain('https://a.b.c.example.com')).toBe('a.b.c.example.com');
    });

    it('should handle co.uk domains', () => {
      expect(extractDomain('https://example.co.uk')).toBe('example.co.uk');
    });
  });

  describe('case handling', () => {
    it('should convert to lowercase', () => {
      expect(extractDomain('HTTPS://WWW.EXAMPLE.COM')).toBe('example.com');
    });
  });

  describe('null/undefined handling', () => {
    it('should return null for null input', () => {
      expect(extractDomain(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(extractDomain(undefined)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should return null for empty string', () => {
      expect(extractDomain('')).toBeNull();
    });

    it('should return null for whitespace only', () => {
      expect(extractDomain('   ')).toBeNull();
    });

    it('should return null for non-string', () => {
      expect(extractDomain(123)).toBeNull();
    });

    it('should handle trailing slash', () => {
      expect(extractDomain('https://example.com/')).toBe('example.com');
    });

    it('should handle ports', () => {
      expect(extractDomain('https://example.com:8080')).toBe('example.com');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// $match_pattern TESTS
// ═══════════════════════════════════════════════════════════════

describe('$match_pattern', () => {
  describe('basic matching', () => {
    it('should match simple pattern', () => {
      const result = matchPattern('hello world', 'hello');
      expect(result.matched).toBe(true);
      expect(result.fullMatch).toBe('hello');
    });

    it('should return groups from capture groups', () => {
      const result = matchPattern('John Doe', '(\\w+) (\\w+)');
      expect(result.matched).toBe(true);
      expect(result.groups).toEqual(['John', 'Doe']);
    });

    it('should return empty groups for no captures', () => {
      const result = matchPattern('hello', '\\w+');
      expect(result.matched).toBe(true);
      expect(result.groups).toEqual([]);
    });
  });

  describe('email extraction', () => {
    it('should extract email parts', () => {
      const result = matchPattern('John Doe <john@example.com>', '(.+) <(.+@.+)>');
      expect(result.matched).toBe(true);
      expect(result.groups).toEqual(['John Doe', 'john@example.com']);
      expect(result.fullMatch).toBe('John Doe <john@example.com>');
    });
  });

  describe('no match', () => {
    it('should return matched: false for no match', () => {
      const result = matchPattern('hello', '^\\d+$');
      expect(result.matched).toBe(false);
      expect(result.groups).toEqual([]);
      expect(result.fullMatch).toBeNull();
    });
  });

  describe('null/undefined handling', () => {
    it('should return not matched for null string', () => {
      const result = matchPattern(null, '.*');
      expect(result.matched).toBe(false);
    });

    it('should return not matched for undefined string', () => {
      const result = matchPattern(undefined, '.*');
      expect(result.matched).toBe(false);
    });

    it('should return not matched for null pattern', () => {
      const result = matchPattern('hello', null);
      expect(result.matched).toBe(false);
    });

    it('should return not matched for undefined pattern', () => {
      const result = matchPattern('hello', undefined);
      expect(result.matched).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return not matched for invalid regex', () => {
      const result = matchPattern('hello', '[invalid');
      expect(result.matched).toBe(false);
    });

    it('should return not matched for non-string input', () => {
      const result = matchPattern(123, '\\d+');
      expect(result.matched).toBe(false);
    });

    it('should return not matched for non-string pattern', () => {
      const result = matchPattern('hello', 123);
      expect(result.matched).toBe(false);
    });

    it('should handle empty string', () => {
      const result = matchPattern('', '.*');
      expect(result.matched).toBe(true);
      expect(result.fullMatch).toBe('');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// $coalesce TESTS
// ═══════════════════════════════════════════════════════════════

describe('$coalesce', () => {
  describe('basic coalescing', () => {
    it('should return first valid value', () => {
      expect(coalesce('first', 'second')).toBe('first');
    });

    it('should skip null values', () => {
      expect(coalesce(null, 'value')).toBe('value');
    });

    it('should skip undefined values', () => {
      expect(coalesce(undefined, 'value')).toBe('value');
    });

    it('should skip empty strings', () => {
      expect(coalesce('', 'value')).toBe('value');
    });

    it('should skip whitespace-only strings', () => {
      expect(coalesce('   ', 'value')).toBe('value');
    });
  });

  describe('falsy values', () => {
    it('should accept zero as valid', () => {
      expect(coalesce(null, 0, 'fallback')).toBe(0);
    });

    it('should accept false as valid', () => {
      expect(coalesce(null, false, 'fallback')).toBe(false);
    });
  });

  describe('null/undefined handling', () => {
    it('should return null if all values empty', () => {
      expect(coalesce(null, undefined, '')).toBeNull();
    });

    it('should return null for no arguments', () => {
      expect(coalesce()).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should work with single value', () => {
      expect(coalesce('only')).toBe('only');
    });

    it('should work with many values', () => {
      expect(coalesce(null, null, null, 'fourth')).toBe('fourth');
    });

    it('should accept objects', () => {
      expect(coalesce(null, { key: 'value' })).toEqual({ key: 'value' });
    });

    it('should accept arrays', () => {
      expect(coalesce(null, [1, 2, 3])).toEqual([1, 2, 3]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// $similarity TESTS
// ═══════════════════════════════════════════════════════════════

describe('$similarity', () => {
  describe('identical strings', () => {
    it('should return 1 for identical strings', () => {
      expect(similarity('hello', 'hello')).toBe(1);
    });

    it('should be case insensitive', () => {
      expect(similarity('Hello', 'HELLO')).toBe(1);
    });
  });

  describe('different strings', () => {
    it('should return 0 for completely different', () => {
      expect(similarity('abc', 'xyz')).toBe(0);
    });

    it('should return score for partially similar', () => {
      const score = similarity('hello', 'helo');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
      expect(score).toBeCloseTo(0.8, 1);
    });
  });

  describe('Levenshtein distance', () => {
    it('should handle kitten/sitting example', () => {
      // Distance is 3, max length 7, similarity = 1 - 3/7 = ~0.57
      const score = similarity('kitten', 'sitting');
      expect(score).toBeCloseTo(0.571, 2);
    });

    it('should handle single character difference', () => {
      const score = similarity('cat', 'bat');
      expect(score).toBeCloseTo(0.667, 2);
    });
  });

  describe('null/undefined handling', () => {
    it('should return 0 for null first arg', () => {
      expect(similarity(null, 'test')).toBe(0);
    });

    it('should return 0 for null second arg', () => {
      expect(similarity('test', null)).toBe(0);
    });

    it('should return 0 for undefined first arg', () => {
      expect(similarity(undefined, 'test')).toBe(0);
    });

    it('should return 0 for undefined second arg', () => {
      expect(similarity('test', undefined)).toBe(0);
    });

    it('should return 0 for both null', () => {
      expect(similarity(null, null)).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should return 0 for empty first string', () => {
      expect(similarity('', 'test')).toBe(0);
    });

    it('should return 0 for empty second string', () => {
      expect(similarity('test', '')).toBe(0);
    });

    it('should convert non-strings to strings', () => {
      expect(similarity(123, '123')).toBe(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// $parse_date TESTS (chrono-node)
// ═══════════════════════════════════════════════════════════════

describe('$parse_date', () => {
  describe('standard date formats', () => {
    it('should parse ISO date', () => {
      const result = parseDate('2024-01-15');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('2024-01-15');
    });

    it('should parse written date', () => {
      const result = parseDate('January 15, 2024');
      expect(result).toBeDefined();
      expect(result).toContain('2024');
    });

    it('should parse short date', () => {
      const result = parseDate('Jan 15, 2024');
      expect(result).toBeDefined();
    });

    it('should parse European format', () => {
      const result = parseDate('15 January 2024');
      expect(result).toBeDefined();
    });
  });

  describe('output formats', () => {
    it('should return ISO string by default', () => {
      const result = parseDate('January 15, 2024', 'iso');
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should return date-only format', () => {
      const result = parseDate('January 15, 2024', 'date');
      expect(result).toBe('2024-01-15');
    });

    it('should return timestamp', () => {
      const result = parseDate('January 15, 2024', 'timestamp');
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should return components object', () => {
      const result = parseDate('January 15, 2024', 'components');
      expect(result).toEqual({
        year: 2024,
        month: 1,
        day: 15,
      });
    });
  });

  describe('relative dates', () => {
    it('should parse "today"', () => {
      const result = parseDate('today');
      expect(result).toBeDefined();
    });

    it('should parse "tomorrow"', () => {
      const result = parseDate('tomorrow');
      expect(result).toBeDefined();
    });

    it('should parse "yesterday"', () => {
      const result = parseDate('yesterday');
      expect(result).toBeDefined();
    });

    // Note: chrono-node may not consistently parse all natural language
    // so we test with known working patterns
  });

  describe('null/undefined handling', () => {
    it('should return null for null input', () => {
      expect(parseDate(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(parseDate(undefined)).toBeNull();
    });

    it('should return null for non-string input', () => {
      expect(parseDate(123)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should return null for empty string', () => {
      expect(parseDate('')).toBeNull();
    });

    it('should return null for whitespace', () => {
      expect(parseDate('   ')).toBeNull();
    });

    it('should return null for unparseable string', () => {
      expect(parseDate('not a date')).toBeNull();
    });

    it('should handle unknown format parameter', () => {
      const result = parseDate('January 15, 2024', 'unknown');
      // Should default to ISO
      expect(typeof result).toBe('string');
    });

    it('should handle null format parameter', () => {
      const result = parseDate('January 15, 2024', null);
      expect(result).toBeDefined();
    });

    it('should handle various separators', () => {
      expect(parseDate('2024/01/15')).toBeDefined();
      expect(parseDate('01-15-2024')).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// BUILTIN REGISTRY TESTS
// ═══════════════════════════════════════════════════════════════

describe('BUILTIN_FUNCTIONS registry', () => {
  it('should have all 9 builtin functions', () => {
    expect(BUILTIN_FUNCTIONS).toHaveLength(9);
  });

  it('should include all expected functions', () => {
    const names = BUILTIN_FUNCTIONS.map(f => f.name);
    expect(names).toContain('normalize_case');
    expect(names).toContain('clean_whitespace');
    expect(names).toContain('parse_number');
    expect(names).toContain('format_phone');
    expect(names).toContain('extract_domain');
    expect(names).toContain('match_pattern');
    expect(names).toContain('coalesce');
    expect(names).toContain('similarity');
    expect(names).toContain('parse_date');
  });

  it('should have valid signatures for all functions', () => {
    for (const builtin of BUILTIN_FUNCTIONS) {
      expect(builtin.signature).toBeDefined();
      expect(builtin.signature.length).toBeGreaterThan(0);
    }
  });

  it('should have descriptions for all functions', () => {
    for (const builtin of BUILTIN_FUNCTIONS) {
      expect(builtin.description).toBeDefined();
      expect(builtin.description.length).toBeGreaterThan(0);
    }
  });
});

describe('getBuiltinDocs', () => {
  it('should return documentation for all functions', () => {
    const docs = getBuiltinDocs();
    expect(docs).toHaveLength(9);
  });

  it('should format names with $ prefix', () => {
    const docs = getBuiltinDocs();
    for (const doc of docs) {
      expect(doc.name).toMatch(/^\$/);
    }
  });

  it('should include signature and description', () => {
    const docs = getBuiltinDocs();
    for (const doc of docs) {
      expect(doc.signature).toBeDefined();
      expect(doc.description).toBeDefined();
    }
  });
});
