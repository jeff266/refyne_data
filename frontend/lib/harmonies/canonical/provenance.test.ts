/**
 * Vitest tests for the Provenance module.
 *
 * Tests the resolution strategies: priority, recency, consensus, conservative
 * and helper functions for provenance tracking.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveField,
  createResolvedField,
  markTransformed,
  unwrap,
  type CandidateValue,
  type ResolvedField,
  type ResolutionStrategy,
} from './provenance';

// ═══════════════════════════════════════════════════════════════
// HELPER: createCandidate
// ═══════════════════════════════════════════════════════════════

/**
 * Helper function to create a CandidateValue for testing.
 */
function createCandidate<T>(
  provider: string,
  value: T,
  options: {
    retrieved_at?: string;
    raw_value?: unknown;
  } = {}
): CandidateValue<T> {
  return {
    provider,
    value,
    retrieved_at: options.retrieved_at ?? new Date().toISOString(),
    raw_value: options.raw_value,
  };
}

// ═══════════════════════════════════════════════════════════════
// createCandidate TESTS
// ═══════════════════════════════════════════════════════════════

describe('createCandidate helper', () => {
  it('should create candidate with required fields', () => {
    const candidate = createCandidate('clearbit', 'Acme Corp');
    expect(candidate.provider).toBe('clearbit');
    expect(candidate.value).toBe('Acme Corp');
    expect(candidate.retrieved_at).toBeDefined();
  });

  it('should allow custom retrieved_at', () => {
    const timestamp = '2024-01-15T10:00:00.000Z';
    const candidate = createCandidate('zoominfo', 500000, { retrieved_at: timestamp });
    expect(candidate.retrieved_at).toBe(timestamp);
  });

  it('should allow raw_value tracking', () => {
    const candidate = createCandidate('apollo', 1000000, {
      raw_value: '$1M',
    });
    expect(candidate.raw_value).toBe('$1M');
  });

  it('should work with null values', () => {
    const candidate = createCandidate('provider', null);
    expect(candidate.value).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// createResolvedField TESTS
// ═══════════════════════════════════════════════════════════════

describe('createResolvedField', () => {
  it('should create resolved field with minimum params', () => {
    const field = createResolvedField('Acme Corp', 'clearbit');
    expect(field.value).toBe('Acme Corp');
    expect(field.source).toBe('clearbit');
    expect(field.harmony).toBeNull();
    expect(field.strategy).toBe('priority');
    expect(field.candidates).toHaveLength(1);
  });

  it('should accept string date', () => {
    const timestamp = '2024-01-15T10:00:00.000Z';
    const field = createResolvedField('value', 'provider', timestamp);
    expect(field.retrieved_at).toBe(timestamp);
  });

  it('should accept Date object', () => {
    const date = new Date('2024-01-15T10:00:00.000Z');
    const field = createResolvedField('value', 'provider', date);
    expect(field.retrieved_at).toBe('2024-01-15T10:00:00.000Z');
  });

  it('should accept harmony reference', () => {
    const field = createResolvedField('value', 'provider', new Date(), {
      harmony: 'company-name-normalizer@1.0.0',
    });
    expect(field.harmony).toBe('company-name-normalizer@1.0.0');
  });

  it('should accept raw_value', () => {
    const field = createResolvedField(1500000, 'provider', new Date(), {
      rawValue: '$1.5M',
    });
    expect(field.candidates[0].raw_value).toBe('$1.5M');
  });

  it('should accept confidence score', () => {
    const field = createResolvedField('value', 'provider', new Date(), {
      confidence: 0.95,
    });
    expect(field.confidence).toBe(0.95);
  });
});

// ═══════════════════════════════════════════════════════════════
// markTransformed TESTS
// ═══════════════════════════════════════════════════════════════

describe('markTransformed', () => {
  it('should add harmony reference', () => {
    const original = createResolvedField('ACME CORP', 'clearbit');
    const transformed = markTransformed(original, 'company-name', '1.0.0', 'Acme Corp');

    expect(transformed.harmony).toBe('company-name@1.0.0');
    expect(transformed.value).toBe('Acme Corp');
    expect(transformed.source).toBe('clearbit'); // Preserved
  });

  it('should not mutate original', () => {
    const original = createResolvedField('ACME CORP', 'clearbit');
    markTransformed(original, 'test', '1.0.0', 'Acme Corp');

    expect(original.harmony).toBeNull();
    expect(original.value).toBe('ACME CORP');
  });
});

// ═══════════════════════════════════════════════════════════════
// unwrap TESTS
// ═══════════════════════════════════════════════════════════════

describe('unwrap', () => {
  it('should extract value from resolved field', () => {
    const field = createResolvedField('Acme Corp', 'provider');
    expect(unwrap(field)).toBe('Acme Corp');
  });

  it('should return null for null input', () => {
    expect(unwrap(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(unwrap(undefined)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// resolveField TESTS - PRIORITY STRATEGY
// ═══════════════════════════════════════════════════════════════

describe('resolveField - priority strategy', () => {
  it('should pick first provider in priority order', () => {
    const candidates = [
      createCandidate('zoominfo', 'Zoominfo Value'),
      createCandidate('clearbit', 'Clearbit Value'),
      createCandidate('apollo', 'Apollo Value'),
    ];

    const result = resolveField(candidates, 'priority', {
      priorityOrder: ['clearbit', 'zoominfo', 'apollo'],
    });

    expect(result?.value).toBe('Clearbit Value');
    expect(result?.source).toBe('clearbit');
    expect(result?.strategy).toBe('priority');
  });

  it('should skip null values', () => {
    const candidates = [
      createCandidate('clearbit', null),
      createCandidate('zoominfo', 'Zoominfo Value'),
    ];

    const result = resolveField(candidates, 'priority', {
      priorityOrder: ['clearbit', 'zoominfo'],
    });

    expect(result?.value).toBe('Zoominfo Value');
    expect(result?.source).toBe('zoominfo');
  });

  it('should skip undefined values', () => {
    const candidates = [
      createCandidate('clearbit', undefined),
      createCandidate('apollo', 'Apollo Value'),
    ];

    const result = resolveField(candidates, 'priority', {
      priorityOrder: ['clearbit', 'apollo'],
    });

    expect(result?.value).toBe('Apollo Value');
  });

  it('should put unknown providers last', () => {
    const candidates = [
      createCandidate('unknown-provider', 'Unknown Value'),
      createCandidate('clearbit', 'Clearbit Value'),
    ];

    const result = resolveField(candidates, 'priority', {
      priorityOrder: ['clearbit'],
    });

    expect(result?.value).toBe('Clearbit Value');
  });

  it('should use first candidate if no priority order', () => {
    const candidates = [
      createCandidate('first', 'First Value'),
      createCandidate('second', 'Second Value'),
    ];

    const result = resolveField(candidates, 'priority');
    expect(result?.value).toBe('First Value');
  });

  it('should include all candidates in result', () => {
    const candidates = [
      createCandidate('clearbit', 'Clearbit Value'),
      createCandidate('zoominfo', 'Zoominfo Value'),
    ];

    const result = resolveField(candidates, 'priority');
    expect(result?.candidates).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// resolveField TESTS - RECENCY STRATEGY
// ═══════════════════════════════════════════════════════════════

describe('resolveField - recency strategy', () => {
  it('should pick most recent value', () => {
    const candidates = [
      createCandidate('old', 'Old Value', { retrieved_at: '2024-01-01T00:00:00.000Z' }),
      createCandidate('new', 'New Value', { retrieved_at: '2024-06-01T00:00:00.000Z' }),
      createCandidate('mid', 'Mid Value', { retrieved_at: '2024-03-01T00:00:00.000Z' }),
    ];

    const result = resolveField(candidates, 'recency');

    expect(result?.value).toBe('New Value');
    expect(result?.source).toBe('new');
    expect(result?.strategy).toBe('recency');
  });

  it('should handle same timestamps', () => {
    const sameTime = '2024-01-15T10:00:00.000Z';
    const candidates = [
      createCandidate('first', 'First Value', { retrieved_at: sameTime }),
      createCandidate('second', 'Second Value', { retrieved_at: sameTime }),
    ];

    const result = resolveField(candidates, 'recency');
    expect(result?.value).toBeDefined();
  });

  it('should skip null values', () => {
    const candidates = [
      createCandidate('newest', null, { retrieved_at: '2024-12-01T00:00:00.000Z' }),
      createCandidate('older', 'Older Value', { retrieved_at: '2024-01-01T00:00:00.000Z' }),
    ];

    const result = resolveField(candidates, 'recency');
    expect(result?.value).toBe('Older Value');
  });
});

// ═══════════════════════════════════════════════════════════════
// resolveField TESTS - CONSENSUS STRATEGY
// ═══════════════════════════════════════════════════════════════

describe('resolveField - consensus strategy', () => {
  it('should pick most common value', () => {
    const candidates = [
      createCandidate('provider1', 'Acme Corp'),
      createCandidate('provider2', 'Acme Corp'),
      createCandidate('provider3', 'ACME Corporation'),
    ];

    const result = resolveField(candidates, 'consensus');

    expect(result?.value).toBe('Acme Corp');
    expect(result?.strategy).toBe('consensus');
  });

  it('should detect matching values from different providers', () => {
    // Critical test: Two providers returning "Acme Corp" should be detected
    const candidates = [
      createCandidate('clearbit', 'Acme Corp'),
      createCandidate('zoominfo', 'Acme Corp'),
      createCandidate('apollo', 'Acme Corporation'),
    ];

    const result = resolveField(candidates, 'consensus');
    expect(result?.value).toBe('Acme Corp');
  });

  it('should handle tie by returning first encountered', () => {
    const candidates = [
      createCandidate('provider1', 'Value A'),
      createCandidate('provider2', 'Value B'),
    ];

    const result = resolveField(candidates, 'consensus');
    // When tied, should return one of them
    expect(['Value A', 'Value B']).toContain(result?.value);
  });

  it('should handle three-way consensus', () => {
    const candidates = [
      createCandidate('p1', 100),
      createCandidate('p2', 100),
      createCandidate('p3', 100),
      createCandidate('p4', 200),
    ];

    const result = resolveField(candidates, 'consensus');
    expect(result?.value).toBe(100);
  });

  it('should use JSON stringify for object comparison', () => {
    const candidates = [
      createCandidate('p1', { name: 'Acme' }),
      createCandidate('p2', { name: 'Acme' }),
      createCandidate('p3', { name: 'Beta' }),
    ];

    const result = resolveField(candidates, 'consensus');
    expect(result?.value).toEqual({ name: 'Acme' });
  });
});

// ═══════════════════════════════════════════════════════════════
// resolveField TESTS - CONSERVATIVE STRATEGY
// ═══════════════════════════════════════════════════════════════

describe('resolveField - conservative strategy', () => {
  describe('for numbers', () => {
    it('should pick lower value', () => {
      const candidates = [
        createCandidate('provider1', 1500000),
        createCandidate('provider2', 1000000),
        createCandidate('provider3', 2000000),
      ];

      const result = resolveField(candidates, 'conservative');

      expect(result?.value).toBe(1000000);
      expect(result?.source).toBe('provider2');
      expect(result?.strategy).toBe('conservative');
    });

    it('should pick lower value for revenue estimates', () => {
      const candidates = [
        createCandidate('clearbit', 50000000),  // $50M
        createCandidate('zoominfo', 35000000),  // $35M (conservative)
        createCandidate('apollo', 75000000),    // $75M
      ];

      const result = resolveField(candidates, 'conservative');
      expect(result?.value).toBe(35000000);
    });

    it('should handle negative numbers', () => {
      const candidates = [
        createCandidate('p1', -10),
        createCandidate('p2', 5),
        createCandidate('p3', -20),
      ];

      const result = resolveField(candidates, 'conservative');
      expect(result?.value).toBe(-20); // Lowest
    });

    it('should handle zero', () => {
      const candidates = [
        createCandidate('p1', 0),
        createCandidate('p2', 100),
      ];

      const result = resolveField(candidates, 'conservative');
      expect(result?.value).toBe(0);
    });
  });

  describe('for strings', () => {
    it('should pick shorter string', () => {
      const candidates = [
        createCandidate('provider1', 'Acme Corporation'),
        createCandidate('provider2', 'Acme'),
        createCandidate('provider3', 'Acme Corp Inc.'),
      ];

      const result = resolveField(candidates, 'conservative');

      expect(result?.value).toBe('Acme');
      expect(result?.source).toBe('provider2');
    });

    it('should pick shorter company name (less likely to have extra data)', () => {
      const candidates = [
        createCandidate('clearbit', 'Acme Corp'),
        createCandidate('zoominfo', 'Acme Corporation Incorporated'),
        createCandidate('apollo', 'Acme'),
      ];

      const result = resolveField(candidates, 'conservative');
      expect(result?.value).toBe('Acme');
    });

    it('should handle equal length strings', () => {
      const candidates = [
        createCandidate('p1', 'ABC'),
        createCandidate('p2', 'XYZ'),
      ];

      const result = resolveField(candidates, 'conservative');
      expect(result?.value).toHaveLength(3);
    });

    it('should handle empty strings as shortest', () => {
      const candidates = [
        createCandidate('p1', ''),
        createCandidate('p2', 'Some Value'),
      ];

      // Note: empty strings are filtered by null/undefined check? No, they're not null
      const result = resolveField(candidates, 'conservative');
      expect(result?.value).toBe('');
    });
  });

  describe('for other types', () => {
    it('should return first valid value for booleans', () => {
      const candidates = [
        createCandidate('p1', true),
        createCandidate('p2', false),
      ];

      const result = resolveField(candidates, 'conservative');
      expect(result?.value).toBe(true);
    });

    it('should return first valid value for objects', () => {
      const candidates = [
        createCandidate('p1', { key: 'value1' }),
        createCandidate('p2', { key: 'value2' }),
      ];

      const result = resolveField(candidates, 'conservative');
      expect(result?.value).toEqual({ key: 'value1' });
    });

    it('should return first valid value for arrays', () => {
      const candidates = [
        createCandidate('p1', [1, 2, 3]),
        createCandidate('p2', [1]),
      ];

      const result = resolveField(candidates, 'conservative');
      expect(result?.value).toEqual([1, 2, 3]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════

describe('resolveField - edge cases', () => {
  it('should return null for empty candidates array', () => {
    const result = resolveField([], 'priority');
    expect(result).toBeNull();
  });

  it('should return null when all candidates have null values', () => {
    const candidates = [
      createCandidate('p1', null),
      createCandidate('p2', null),
    ];

    const result = resolveField(candidates, 'priority');
    expect(result).toBeNull();
  });

  it('should return null when all candidates have undefined values', () => {
    const candidates = [
      createCandidate('p1', undefined),
      createCandidate('p2', undefined),
    ];

    const result = resolveField(candidates, 'priority');
    expect(result).toBeNull();
  });

  it('should work with single candidate', () => {
    const candidates = [createCandidate('only', 'Only Value')];

    const result = resolveField(candidates, 'priority');
    expect(result?.value).toBe('Only Value');
  });

  it('should handle single candidate with null value', () => {
    const candidates = [createCandidate('only', null)];

    const result = resolveField(candidates, 'priority');
    expect(result).toBeNull();
  });

  it('should preserve all original candidates in result', () => {
    const nullCandidate = createCandidate('null-provider', null);
    const validCandidate = createCandidate('valid-provider', 'Valid');

    const result = resolveField([nullCandidate, validCandidate], 'priority');

    // Result should contain the original candidates array
    expect(result?.candidates).toHaveLength(2);
  });

  it('should handle mixed null and undefined values', () => {
    const candidates = [
      createCandidate('p1', null),
      createCandidate('p2', undefined),
      createCandidate('p3', 'Valid'),
    ];

    const result = resolveField(candidates, 'priority');
    expect(result?.value).toBe('Valid');
  });

  it('should handle zero as valid number', () => {
    const candidates = [
      createCandidate('p1', null),
      createCandidate('p2', 0),
    ];

    const result = resolveField(candidates, 'priority');
    expect(result?.value).toBe(0);
  });

  it('should handle empty string as valid (not null)', () => {
    const candidates = [
      createCandidate('p1', null),
      createCandidate('p2', ''),
    ];

    const result = resolveField(candidates, 'priority');
    expect(result?.value).toBe('');
  });

  it('should handle false as valid boolean', () => {
    const candidates = [
      createCandidate('p1', null),
      createCandidate('p2', false),
    ];

    const result = resolveField(candidates, 'priority');
    expect(result?.value).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// STRATEGY TYPE SAFETY
// ═══════════════════════════════════════════════════════════════

describe('resolveField - default behavior', () => {
  it('should handle unknown strategy by using first valid', () => {
    const candidates = [
      createCandidate('p1', 'First'),
      createCandidate('p2', 'Second'),
    ];

    // TypeScript would prevent this, but testing runtime behavior
    const result = resolveField(candidates, 'unknown-strategy' as ResolutionStrategy);
    expect(result?.value).toBe('First');
  });
});
