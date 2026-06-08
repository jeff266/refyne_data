/**
 * Name Cleaner Tests
 *
 * Tests for lib/import/name-cleaner.ts
 * 9 tests covering credential removal, full name splitting, company normalization
 */

import { describe, it, expect } from 'vitest';
import {
  cleanLastName,
  splitFullName,
  normalizeCompanyName,
  extractEmailDomain,
} from '../../lib/import/name-cleaner';

describe('cleanLastName', () => {
  it('should remove MBA credential', () => {
    expect(cleanLastName('Sanderson, MBA')).toBe('Sanderson');
  });

  it('should remove CDMP® credential', () => {
    expect(cleanLastName('Ullah - CDMP® PCM®')).toBe('Ullah');
  });

  it('should preserve hyphenated names', () => {
    expect(cleanLastName('Virdee-Chapman')).toBe('Virdee-Chapman');
  });
});

describe('splitFullName', () => {
  it('should split first and last name', () => {
    expect(splitFullName('Aaron Perreira')).toEqual({
      first: 'Aaron',
      last: 'Perreira',
    });
  });

  it('should handle names with credentials', () => {
    expect(splitFullName('Aaron Sanderson, MBA')).toEqual({
      first: 'Aaron',
      last: 'Sanderson',
    });
  });

  it('should handle single name', () => {
    expect(splitFullName('John')).toEqual({ first: 'John', last: '' });
  });
});

describe('normalizeCompanyName', () => {
  it('should remove Inc suffix', () => {
    expect(normalizeCompanyName('Refine Labs Inc')).toBe('refine labs');
  });

  it('should remove punctuation', () => {
    expect(normalizeCompanyName('Apple, Inc.')).toBe('apple');
  });
});

describe('extractEmailDomain', () => {
  it('should extract domain without TLD', () => {
    expect(extractEmailDomain('aaron@refinelabs.com')).toBe('refinelabs');
  });
});
