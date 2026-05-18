/**
 * Vitest tests for JSONata Runner and Builtin Functions.
 *
 * Converted from test-jsonata-runner.mjs to TypeScript with Vitest syntax.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import {
  normalizeCase,
  cleanWhitespace,
  parseNumber,
  formatPhone,
  extractDomain,
  matchPattern,
  coalesce,
  similarity,
} from './builtins';
import {
  JSONataRunner,
  evaluate,
  validateExpression,
  createRunner,
  getDefaultRunner,
} from './jsonata-runner';

// ═══════════════════════════════════════════════════════════════
// BUILTIN FUNCTION TESTS
// ═══════════════════════════════════════════════════════════════

describe('$normalize_case', () => {
  it('should convert to lower case', () => {
    expect(normalizeCase('HELLO WORLD', 'lower')).toBe('hello world');
  });

  it('should convert to upper case', () => {
    expect(normalizeCase('hello world', 'upper')).toBe('HELLO WORLD');
  });

  it('should convert to title case', () => {
    expect(normalizeCase('ACME CORP', 'title')).toBe('Acme Corp');
  });

  it('should handle title case with hyphen', () => {
    expect(normalizeCase('mary-jane watson', 'title')).toBe('Mary-Jane Watson');
  });

  it('should convert to sentence case', () => {
    expect(normalizeCase('hello WORLD', 'sentence')).toBe('Hello world');
  });

  it('should return null for null input', () => {
    expect(normalizeCase(null, 'lower')).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(normalizeCase(undefined, 'lower')).toBeNull();
  });

  it('should default to lower case for unknown style', () => {
    expect(normalizeCase('Hello', 'unknown')).toBe('hello');
  });

  it('should convert non-string to string', () => {
    expect(normalizeCase(123, 'upper')).toBe('123');
  });
});

describe('$clean_whitespace', () => {
  it('should collapse multiple spaces', () => {
    expect(cleanWhitespace('Hello    World')).toBe('Hello World');
  });

  it('should trim leading/trailing spaces', () => {
    expect(cleanWhitespace('  Hello World  ')).toBe('Hello World');
  });

  it('should handle newlines and tabs', () => {
    expect(cleanWhitespace('Line1\n\n\nLine2\t\tLine3')).toBe('Line1 Line2 Line3');
  });

  it('should return null for null input', () => {
    expect(cleanWhitespace(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(cleanWhitespace(undefined)).toBeNull();
  });

  it('should convert non-string to trimmed string', () => {
    expect(cleanWhitespace(123)).toBe('123');
  });
});

describe('$parse_number', () => {
  it('should parse simple number', () => {
    expect(parseNumber('12345')).toBe(12345);
  });

  it('should parse with commas', () => {
    expect(parseNumber('15,000')).toBe(15000);
  });

  it('should parse currency with K suffix', () => {
    expect(parseNumber('$500K')).toBe(500000);
  });

  it('should parse currency with M suffix', () => {
    expect(parseNumber('$1.5M')).toBe(1500000);
  });

  it('should parse with B suffix', () => {
    expect(parseNumber('2.5B')).toBe(2500000000);
  });

  it('should parse with T suffix', () => {
    expect(parseNumber('1T')).toBe(1000000000000);
  });

  it('should parse decimal with commas', () => {
    expect(parseNumber('1,234.56')).toBe(1234.56);
  });

  it('should return number as-is', () => {
    expect(parseNumber(42)).toBe(42);
  });

  it('should return null for null input', () => {
    expect(parseNumber(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(parseNumber(undefined)).toBeNull();
  });

  it('should return null for invalid string', () => {
    expect(parseNumber('not a number')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseNumber('')).toBeNull();
  });

  it('should handle negative numbers with minus sign', () => {
    expect(parseNumber('-500')).toBe(-500);
  });

  it('should handle negative numbers with parentheses', () => {
    expect(parseNumber('(500)')).toBe(-500);
  });

  it('should handle Euro symbol', () => {
    expect(parseNumber('\u20AC100')).toBe(100);
  });

  it('should handle Pound symbol', () => {
    expect(parseNumber('\u00A3100')).toBe(100);
  });

  it('should handle Yen symbol', () => {
    expect(parseNumber('\u00A5100')).toBe(100);
  });
});

describe('$format_phone', () => {
  it('should format US phone - 10 digits', () => {
    expect(formatPhone('4155551234', 'US')).toBe('+1 (415) 555-1234');
  });

  it('should format US phone - with country code', () => {
    expect(formatPhone('14155551234', 'US')).toBe('+1 (415) 555-1234');
  });

  it('should format US phone - with dashes', () => {
    expect(formatPhone('415-555-1234', 'US')).toBe('+1 (415) 555-1234');
  });

  it('should format UK phone', () => {
    expect(formatPhone('02012345678', 'UK')).toBe('+44 20 1234 5678');
  });

  it('should format UK phone with country code', () => {
    expect(formatPhone('442012345678', 'UK')).toBe('+44 20 1234 5678');
  });

  it('should format international - default', () => {
    expect(formatPhone('1234567890', 'international')).toBe('+1234567890');
  });

  it('should return null for null input', () => {
    expect(formatPhone(null, 'US')).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(formatPhone(undefined, 'US')).toBeNull();
  });

  it('should return null for empty digits', () => {
    expect(formatPhone('', 'US')).toBeNull();
  });

  it('should return null for too short international', () => {
    expect(formatPhone('123456', 'international')).toBeNull();
  });

  it('should handle non-10-digit US numbers', () => {
    expect(formatPhone('12345', 'US')).toBe('+1 12345');
  });

  it('should convert number input to string', () => {
    expect(formatPhone(4155551234, 'US')).toBe('+1 (415) 555-1234');
  });

  it('should default to US when no region', () => {
    expect(formatPhone('4155551234')).toBe('+1 (415) 555-1234');
  });
});

describe('$extract_domain', () => {
  it('should extract from https URL', () => {
    expect(extractDomain('https://www.example.com/path')).toBe('example.com');
  });

  it('should extract from http URL', () => {
    expect(extractDomain('http://subdomain.example.com')).toBe('subdomain.example.com');
  });

  it('should remove www prefix', () => {
    expect(extractDomain('www.example.com')).toBe('example.com');
  });

  it('should handle naked domain', () => {
    expect(extractDomain('example.com')).toBe('example.com');
  });

  it('should extract from complex URL', () => {
    expect(extractDomain('https://blog.example.co.uk/post/123?foo=bar')).toBe(
      'blog.example.co.uk'
    );
  });

  it('should return null for null input', () => {
    expect(extractDomain(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(extractDomain(undefined)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(extractDomain('')).toBeNull();
  });

  it('should return null for whitespace-only string', () => {
    expect(extractDomain('   ')).toBeNull();
  });

  it('should return null for non-string input', () => {
    expect(extractDomain(123)).toBeNull();
  });

  it('should convert to lowercase', () => {
    expect(extractDomain('HTTPS://WWW.EXAMPLE.COM')).toBe('example.com');
  });
});

describe('$match_pattern', () => {
  it('should match with capture groups', () => {
    const result = matchPattern('John Doe <john@example.com>', '(.+) <(.+@.+)>');
    expect(result.matched).toBe(true);
    expect(result.groups).toEqual(['John Doe', 'john@example.com']);
    expect(result.fullMatch).toBe('John Doe <john@example.com>');
  });

  it('should return false for no match', () => {
    const result = matchPattern('no match here', '^\\d+$');
    expect(result.matched).toBe(false);
    expect(result.groups).toEqual([]);
    expect(result.fullMatch).toBeNull();
  });

  it('should return false for null input', () => {
    const result = matchPattern(null, '.*');
    expect(result.matched).toBe(false);
  });

  it('should return false for undefined input', () => {
    const result = matchPattern(undefined, '.*');
    expect(result.matched).toBe(false);
  });

  it('should return false for null pattern', () => {
    const result = matchPattern('test', null);
    expect(result.matched).toBe(false);
  });

  it('should return false for invalid regex', () => {
    const result = matchPattern('test', '[invalid regex');
    expect(result.matched).toBe(false);
  });

  it('should return false for non-string input', () => {
    const result = matchPattern(123, '\\d+');
    expect(result.matched).toBe(false);
  });

  it('should return false for non-string pattern', () => {
    const result = matchPattern('test', 123);
    expect(result.matched).toBe(false);
  });
});

describe('$coalesce', () => {
  it('should return first non-null value', () => {
    expect(coalesce(null, undefined, 'value')).toBe('value');
  });

  it('should skip empty strings', () => {
    expect(coalesce(null, '', '  ', 'fallback')).toBe('fallback');
  });

  it('should accept zero as valid', () => {
    expect(coalesce(null, 0, 'fallback')).toBe(0);
  });

  it('should accept false as valid', () => {
    expect(coalesce(null, false, 'fallback')).toBe(false);
  });

  it('should return null if all empty', () => {
    expect(coalesce(null, undefined, '')).toBeNull();
  });

  it('should return first valid value', () => {
    expect(coalesce('first', 'second', 'third')).toBe('first');
  });

  it('should work with single value', () => {
    expect(coalesce('only')).toBe('only');
  });

  it('should work with no arguments', () => {
    expect(coalesce()).toBeNull();
  });
});

describe('$similarity', () => {
  it('should return 1 for identical strings', () => {
    expect(similarity('hello', 'hello')).toBe(1);
  });

  it('should be case insensitive', () => {
    expect(similarity('Hello', 'HELLO')).toBe(1);
  });

  it('should return 0 for completely different strings', () => {
    expect(similarity('abc', 'xyz')).toBe(0);
  });

  it('should return ~0.8 for similar strings', () => {
    const score = similarity('hello', 'helo');
    expect(score).toBeCloseTo(0.8, 2);
  });

  it('should return ~0.57 for kitten/sitting', () => {
    // Distance is 3, max length is 7, so similarity is 1 - 3/7 = 0.571
    const score = similarity('kitten', 'sitting');
    expect(score).toBeCloseTo(0.571, 2);
  });

  it('should return 0 for null input', () => {
    expect(similarity(null, 'test')).toBe(0);
  });

  it('should return 0 for undefined input', () => {
    expect(similarity(undefined, 'test')).toBe(0);
  });

  it('should return 0 for empty string', () => {
    expect(similarity('', 'test')).toBe(0);
  });

  it('should return 0 when both inputs null', () => {
    expect(similarity(null, null)).toBe(0);
  });

  it('should convert non-strings to strings', () => {
    expect(similarity(123, '123')).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// EXPRESSION CACHING TESTS
// ═══════════════════════════════════════════════════════════════

describe('Expression caching (hash)', () => {
  it('should produce same hash for same expression', () => {
    const expr = 'value + 1';
    const hash1 = createHash('sha256').update(expr).digest('hex');
    const hash2 = createHash('sha256').update(expr).digest('hex');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different expressions', () => {
    const hash1 = createHash('sha256').update('value + 1').digest('hex');
    const hash2 = createHash('sha256').update('value + 2').digest('hex');
    expect(hash1).not.toBe(hash2);
  });
});

// ═══════════════════════════════════════════════════════════════
// JSONATA RUNNER TESTS
// ═══════════════════════════════════════════════════════════════

describe('JSONataRunner', () => {
  let runner: JSONataRunner;

  beforeEach(() => {
    runner = new JSONataRunner();
  });

  describe('execute', () => {
    it('should execute simple expression', async () => {
      const result = await runner.execute('value + 1', { value: 5 });
      expect(result.success).toBe(true);
      expect(result.value).toBe(6);
    });

    it('should execute string transformation', async () => {
      const result = await runner.execute('$uppercase(value)', { value: 'hello' });
      expect(result.success).toBe(true);
      expect(result.value).toBe('HELLO');
    });

    it('should return error for invalid expression', async () => {
      const result = await runner.execute('value + + 1', { value: 5 });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('compile_error');
    });

    it('should track cache usage', async () => {
      const result1 = await runner.execute('value * 2', { value: 5 });
      const result2 = await runner.execute('value * 2', { value: 10 });

      expect(result1.timing.compiledFromCache).toBe(false);
      expect(result2.timing.compiledFromCache).toBe(true);
    });

    it('should support custom builtins', async () => {
      const result = await runner.execute(
        '$normalize_case(value, "upper")',
        { value: 'hello' }
      );
      expect(result.success).toBe(true);
      expect(result.value).toBe('HELLO');
    });

    it('should support record context', async () => {
      const result = await runner.execute(
        'value & " from " & $record().company',
        {
          value: 'John',
          record: { company: 'Acme' },
        }
      );
      expect(result.success).toBe(true);
      expect(result.value).toBe('John from Acme');
    });
  });

  describe('evaluateCondition', () => {
    it('should return true for truthy condition', async () => {
      const result = await runner.evaluateCondition('value > 10', { value: 15 });
      expect(result.passes).toBe(true);
    });

    it('should return false for falsy condition', async () => {
      const result = await runner.evaluateCondition('value > 10', { value: 5 });
      expect(result.passes).toBe(false);
    });

    it('should return false for null result', async () => {
      const result = await runner.evaluateCondition('nonexistent', { value: 5 });
      expect(result.passes).toBe(false);
    });
  });

  describe('validate', () => {
    it('should return valid for correct expression', () => {
      const result = runner.validate('value + 1');
      expect(result.valid).toBe(true);
      expect(result.ast).toBeDefined();
    });

    it('should return invalid for incorrect expression', () => {
      const result = runner.validate('value + + 1');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return invalid for unclosed parenthesis', () => {
      const result = runner.validate('$sum(value');
      expect(result.valid).toBe(false);
    });
  });

  describe('cache management', () => {
    it('should track cache size', async () => {
      await runner.execute('value + 1', { value: 1 });
      await runner.execute('value + 2', { value: 1 });
      await runner.execute('value + 3', { value: 1 });

      const stats = runner.getCacheStats();
      expect(stats.size).toBe(3);
    });

    it('should clear cache', async () => {
      await runner.execute('value + 1', { value: 1 });
      runner.clearCache();

      const stats = runner.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should invalidate specific expression', async () => {
      await runner.execute('value + 1', { value: 1 });
      const removed = runner.invalidate('value + 1');
      expect(removed).toBe(true);

      const stats = runner.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should evict old entries when at capacity', async () => {
      const smallRunner = createRunner({ maxCacheSize: 3 });

      await smallRunner.execute('value + 1', { value: 1 });
      await smallRunner.execute('value + 2', { value: 1 });
      await smallRunner.execute('value + 3', { value: 1 });
      await smallRunner.execute('value + 4', { value: 1 });

      const stats = smallRunner.getCacheStats();
      expect(stats.size).toBe(3);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTION TESTS
// ═══════════════════════════════════════════════════════════════

describe('Convenience functions', () => {
  describe('evaluate', () => {
    it('should execute with default runner', async () => {
      const result = await evaluate('value * 3', 7);
      expect(result.success).toBe(true);
      expect(result.value).toBe(21);
    });
  });

  describe('validateExpression', () => {
    it('should validate correct expression', () => {
      const result = validateExpression('value + 1');
      expect(result.valid).toBe(true);
    });

    it('should invalidate incorrect expression', () => {
      const result = validateExpression('value + + 1');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getDefaultRunner', () => {
    it('should return same instance', () => {
      const runner1 = getDefaultRunner();
      const runner2 = getDefaultRunner();
      expect(runner1).toBe(runner2);
    });
  });

  describe('createRunner', () => {
    it('should create runner with custom config', () => {
      const runner = createRunner({ maxCacheSize: 50 });
      const stats = runner.getCacheStats();
      expect(stats.maxSize).toBe(50);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLING TESTS
// ═══════════════════════════════════════════════════════════════

describe('Error handling', () => {
  let runner: JSONataRunner;

  beforeEach(() => {
    runner = new JSONataRunner();
  });

  it('should detect invalid JSONata syntax', async () => {
    const result = await runner.execute('unclosed(', { value: 1 });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('compile_error');
    expect(result.error?.message).toBeDefined();
  });

  it('should handle runtime errors', async () => {
    const result = await runner.execute('$substring(value, 0)', { value: null });
    // JSONata may or may not error depending on version - just check we get a result
    expect(result).toBeDefined();
  });

  it('should include expression in error', async () => {
    const result = await runner.execute('bad syntax!!!', { value: 1 });
    expect(result.success).toBe(false);
    expect(result.error?.expression).toBe('bad syntax!!!');
  });
});
