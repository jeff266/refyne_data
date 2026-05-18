/**
 * Vitest tests for the Pipeline module.
 *
 * Tests the normalize-before-resolve pipeline, including:
 * - Normalizer functionality
 * - Pipeline composition
 * - CRITICAL: Ordering regression tests that FAIL if resolve runs before normalize
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Normalizer,
  createNormalizer,
  normalizeCandidate,
} from './normalizer';
import {
  FieldPipeline,
  createPipeline,
  processField,
} from './pipeline';
import type {
  RawCandidate,
  NormalizedCandidate,
  PipelineConfig,
} from './types';
import type { ValidatedHarmony } from '../spec/schema';

// ═══════════════════════════════════════════════════════════════
// TEST FIXTURES: Sample Harmonies
// ═══════════════════════════════════════════════════════════════

/**
 * A harmony that normalizes company names to title case.
 * "ACME CORPORATION" -> "Acme Corporation"
 * "acme corp" -> "Acme Corp"
 */
const companyNameHarmony: ValidatedHarmony = {
  spec: {
    id: 'company-name-normalizer',
    version: '1.0.0',
    name: 'Company Name Normalizer',
    description: 'Normalizes company names to title case',
    category: 'business-entities',
    author: 'test',
    applies_to: { fields: ['company.name'] },
    sources: [],
    rules: [
      {
        id: 'title-case',
        description: 'Convert to title case',
        transform: '$normalize_case(value, "title")',
      },
    ],
    tests: [
      { input: 'ACME CORP', expected: 'Acme Corp' },
      { input: 'acme corporation', expected: 'Acme Corporation' },
    ],
    on_error: 'fail-silent-log',
    default_enabled: true,
  },
  source: 'library',
  compiled_at: new Date().toISOString(),
  hash: 'test-hash-1',
};

/**
 * A harmony that parses revenue strings to numbers.
 * "$15M" -> 15000000
 * "1.5B" -> 1500000000
 */
const revenueParserHarmony: ValidatedHarmony = {
  spec: {
    id: 'revenue-parser',
    version: '1.0.0',
    name: 'Revenue Parser',
    description: 'Parses revenue strings to numeric values',
    category: 'firmographics',
    author: 'test',
    applies_to: { fields: ['company.annual_revenue'] },
    sources: [],
    rules: [
      {
        id: 'parse-revenue',
        description: 'Parse revenue string to number',
        when: '$type(value) = "string"',
        transform: '$parse_number(value)',
      },
      {
        id: 'passthrough',
        description: 'Pass through if already a number',
        transform: 'value',
      },
    ],
    tests: [
      { input: '$15M', expected: 15000000 },
      { input: 15000000, expected: 15000000 },
    ],
    on_error: 'fail-silent-log',
    default_enabled: true,
  },
  source: 'library',
  compiled_at: new Date().toISOString(),
  hash: 'test-hash-2',
};

/**
 * A harmony that cleans whitespace.
 */
const whitespaceHarmony: ValidatedHarmony = {
  spec: {
    id: 'whitespace-cleaner',
    version: '1.0.0',
    name: 'Whitespace Cleaner',
    description: 'Cleans up whitespace in strings',
    category: 'business-entities',
    author: 'test',
    applies_to: { fields: ['company.name'] },
    sources: [],
    rules: [
      {
        id: 'clean',
        description: 'Clean whitespace',
        transform: '$clean_whitespace(value)',
      },
    ],
    tests: [
      { input: '  Acme  Corp  ', expected: 'Acme Corp' },
    ],
    on_error: 'fail-silent-log',
    default_enabled: true,
  },
  source: 'library',
  compiled_at: new Date().toISOString(),
  hash: 'test-hash-3',
};

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function createRawCandidate(
  source: string,
  value: unknown,
  options: { retrieved_at?: string; record?: Record<string, unknown> } = {}
): RawCandidate {
  return {
    value,
    source,
    retrieved_at: options.retrieved_at ?? new Date().toISOString(),
    record: options.record,
  };
}

// ═══════════════════════════════════════════════════════════════
// NORMALIZER TESTS
// ═══════════════════════════════════════════════════════════════

describe('Normalizer', () => {
  describe('basic functionality', () => {
    it('should normalize a single candidate', async () => {
      const normalizer = new Normalizer([companyNameHarmony]);
      const candidate = createRawCandidate('clearbit', 'ACME CORPORATION');

      const result = await normalizer.normalize(candidate);

      expect(result.success).toBe(true);
      expect(result.candidate?.value).toBe('Acme Corporation');
      expect(result.candidate?.raw_value).toBe('ACME CORPORATION');
      expect(result.candidate?.source).toBe('clearbit');
      expect(result.candidate?.harmony_applied).toBe('company-name-normalizer@1.0.0');
    });

    it('should preserve raw_value for provenance', async () => {
      const normalizer = new Normalizer([revenueParserHarmony]);
      const candidate = createRawCandidate('zoominfo', '$15M');

      const result = await normalizer.normalize(candidate);

      expect(result.candidate?.value).toBe(15000000);
      expect(result.candidate?.raw_value).toBe('$15M');
    });

    it('should apply multiple harmonies in sequence', async () => {
      const normalizer = new Normalizer([whitespaceHarmony, companyNameHarmony]);
      const candidate = createRawCandidate('apollo', '  ACME  CORP  ');

      const result = await normalizer.normalize(candidate);

      // First whitespace is cleaned, then title case is applied
      expect(result.candidate?.value).toBe('Acme Corp');
    });

    it('should pass through value if no harmony matches', async () => {
      const normalizer = new Normalizer([]);
      const candidate = createRawCandidate('provider', 'unchanged value');

      const result = await normalizer.normalize(candidate);

      expect(result.candidate?.value).toBe('unchanged value');
      expect(result.candidate?.harmony_applied).toBeNull();
    });

    it('should handle null values', async () => {
      const normalizer = new Normalizer([companyNameHarmony]);
      const candidate = createRawCandidate('provider', null);

      const result = await normalizer.normalize(candidate);

      expect(result.success).toBe(true);
      expect(result.candidate?.value).toBeNull();
    });
  });

  describe('normalizeAll', () => {
    it('should normalize multiple candidates in parallel', async () => {
      const normalizer = new Normalizer([companyNameHarmony]);
      const candidates = [
        createRawCandidate('clearbit', 'ACME CORP'),
        createRawCandidate('zoominfo', 'acme corporation'),
        createRawCandidate('apollo', 'Acme Corp'),
      ];

      const results = await normalizer.normalizeAll(candidates);

      expect(results).toHaveLength(3);
      expect(results[0].candidate?.value).toBe('Acme Corp');
      expect(results[1].candidate?.value).toBe('Acme Corporation');
      expect(results[2].candidate?.value).toBe('Acme Corp');
    });
  });
});

describe('createNormalizer factory', () => {
  it('should create a normalizer with given harmonies', () => {
    const normalizer = createNormalizer([companyNameHarmony]);
    expect(normalizer.getHarmonies()).toHaveLength(1);
  });
});

describe('normalizeCandidate convenience function', () => {
  it('should normalize a single candidate', async () => {
    const candidate = createRawCandidate('clearbit', 'ACME CORP');
    const result = await normalizeCandidate(candidate, [companyNameHarmony]);

    expect(result.candidate?.value).toBe('Acme Corp');
  });
});

// ═══════════════════════════════════════════════════════════════
// FIELD PIPELINE TESTS
// ═══════════════════════════════════════════════════════════════

describe('FieldPipeline', () => {
  describe('basic functionality', () => {
    it('should process candidates through normalize then resolve', async () => {
      const config: PipelineConfig = {
        harmonies: [companyNameHarmony],
        resolutionStrategy: 'priority',
        priorityOrder: ['clearbit', 'zoominfo'],
      };
      const pipeline = new FieldPipeline(config);

      const candidates = [
        createRawCandidate('zoominfo', 'ZOOMINFO VALUE'),
        createRawCandidate('clearbit', 'CLEARBIT VALUE'),
      ];

      const result = await pipeline.process('company.name', candidates);

      // Priority strategy should pick clearbit (first in priority order)
      expect(result.resolved?.value).toBe('Clearbit Value');
      expect(result.resolved?.source).toBe('clearbit');
      expect(result.resolved?.harmony).toBe('company-name-normalizer@1.0.0');
      expect(result.field).toBe('company.name');
    });

    it('should include timing information', async () => {
      const config: PipelineConfig = {
        harmonies: [],
        resolutionStrategy: 'priority',
      };
      const pipeline = new FieldPipeline(config);

      const result = await pipeline.process('field', [
        createRawCandidate('p1', 'value'),
      ]);

      expect(result.timing.normalizeMs).toBeGreaterThanOrEqual(0);
      expect(result.timing.resolveMs).toBeGreaterThanOrEqual(0);
      expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
    });

    it('should return null resolved when all candidates are null', async () => {
      const config: PipelineConfig = {
        harmonies: [],
        resolutionStrategy: 'priority',
      };
      const pipeline = new FieldPipeline(config);

      const result = await pipeline.process('field', [
        createRawCandidate('p1', null),
        createRawCandidate('p2', null),
      ]);

      expect(result.resolved).toBeNull();
    });

    it('should include all normalized candidates in result', async () => {
      const config: PipelineConfig = {
        harmonies: [companyNameHarmony],
        resolutionStrategy: 'consensus',
      };
      const pipeline = new FieldPipeline(config);

      const candidates = [
        createRawCandidate('clearbit', 'ACME CORP'),
        createRawCandidate('zoominfo', 'acme corp'),
        createRawCandidate('apollo', 'ACME CORP'),
      ];

      const result = await pipeline.process('company.name', candidates);

      expect(result.candidates).toHaveLength(3);
      // All should be normalized to title case
      expect(result.candidates.every(c =>
        c.value === 'Acme Corp'
      )).toBe(true);
    });
  });

  describe('resolution strategies', () => {
    it('should use priority strategy correctly', async () => {
      const config: PipelineConfig = {
        harmonies: [],
        resolutionStrategy: 'priority',
        priorityOrder: ['apollo', 'clearbit', 'zoominfo'],
      };
      const pipeline = new FieldPipeline(config);

      const result = await pipeline.process('field', [
        createRawCandidate('clearbit', 'Clearbit'),
        createRawCandidate('apollo', 'Apollo'),
        createRawCandidate('zoominfo', 'Zoominfo'),
      ]);

      expect(result.resolved?.value).toBe('Apollo');
      expect(result.resolved?.strategy).toBe('priority');
    });

    it('should use recency strategy correctly', async () => {
      const config: PipelineConfig = {
        harmonies: [],
        resolutionStrategy: 'recency',
      };
      const pipeline = new FieldPipeline(config);

      const result = await pipeline.process('field', [
        createRawCandidate('old', 'Old Value', { retrieved_at: '2024-01-01T00:00:00.000Z' }),
        createRawCandidate('new', 'New Value', { retrieved_at: '2024-06-01T00:00:00.000Z' }),
      ]);

      expect(result.resolved?.value).toBe('New Value');
      expect(result.resolved?.strategy).toBe('recency');
    });

    it('should use conservative strategy correctly', async () => {
      const config: PipelineConfig = {
        harmonies: [revenueParserHarmony],
        resolutionStrategy: 'conservative',
      };
      const pipeline = new FieldPipeline(config);

      const result = await pipeline.process('company.annual_revenue', [
        createRawCandidate('clearbit', '$50M'),
        createRawCandidate('zoominfo', '$35M'),  // Lower = conservative
        createRawCandidate('apollo', '$75M'),
      ]);

      expect(result.resolved?.value).toBe(35000000);
      expect(result.resolved?.strategy).toBe('conservative');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// CRITICAL: NORMALIZE-BEFORE-RESOLVE ORDERING TESTS
// ═══════════════════════════════════════════════════════════════
//
// These tests are designed to FAIL if the pipeline ordering is changed
// to resolve-then-normalize. They verify the core invariant of the
// pipeline: normalization MUST happen before resolution.
//
// ═══════════════════════════════════════════════════════════════

describe('Normalize-before-resolve ordering', () => {
  /**
   * CRITICAL TEST: Consensus should match after normalization
   *
   * Scenario:
   * - Provider A returns "ACME CORPORATION"
   * - Provider B returns "Acme Corp"
   * - Provider C returns "ACME CORP"
   *
   * After title case normalization:
   * - Provider A: "Acme Corporation"
   * - Provider B: "Acme Corp"
   * - Provider C: "Acme Corp"
   *
   * Consensus (2 out of 3): "Acme Corp" wins
   *
   * WITHOUT normalization first:
   * - "ACME CORPORATION", "Acme Corp", "ACME CORP" are all different
   * - No consensus, would pick first or random
   * - Test would FAIL
   */
  it('consensus should match after normalization (ACME CORPORATION vs Acme Corp)', async () => {
    const config: PipelineConfig = {
      harmonies: [companyNameHarmony], // Normalizes to title case
      resolutionStrategy: 'consensus',
    };
    const pipeline = new FieldPipeline(config);

    // These look different before normalization
    const candidates = [
      createRawCandidate('provider1', 'ACME CORPORATION'),  // -> "Acme Corporation"
      createRawCandidate('provider2', 'Acme Corp'),          // -> "Acme Corp"
      createRawCandidate('provider3', 'ACME CORP'),          // -> "Acme Corp"
    ];

    const result = await pipeline.process('company.name', candidates);

    // After normalization, provider2 and provider3 both have "Acme Corp"
    // Consensus (2 vs 1) should pick "Acme Corp"
    expect(result.resolved?.value).toBe('Acme Corp');

    // Verify that normalization happened
    const normalizedValues = result.candidates.map(c => c.value);
    expect(normalizedValues).toContain('Acme Corporation');
    expect(normalizedValues.filter(v => v === 'Acme Corp')).toHaveLength(2);

    // Verify raw values were preserved
    const rawValues = result.candidates.map(c => c.raw_value);
    expect(rawValues).toContain('ACME CORPORATION');
    expect(rawValues).toContain('Acme Corp');
    expect(rawValues).toContain('ACME CORP');
  });

  /**
   * CRITICAL TEST: Conservative should compare after normalization
   *
   * Scenario:
   * - Provider A returns "$15M" (string)
   * - Provider B returns 15000000 (number)
   * - Provider C returns "$20M" (string)
   *
   * After parse_number normalization:
   * - Provider A: 15000000
   * - Provider B: 15000000
   * - Provider C: 20000000
   *
   * Conservative (lowest): 15000000 wins
   *
   * WITHOUT normalization first:
   * - "$15M" vs 15000000 vs "$20M" cannot be compared properly
   * - For strings, conservative picks shortest which would be "$15M"
   * - That's wrong because "$15M" is NOT the numeric value we want
   * - Test would FAIL
   */
  it('conservative should compare after normalization ($15M vs 15000000)', async () => {
    const config: PipelineConfig = {
      harmonies: [revenueParserHarmony], // Parses "$15M" to 15000000
      resolutionStrategy: 'conservative',
    };
    const pipeline = new FieldPipeline(config);

    // Mixed formats before normalization
    const candidates = [
      createRawCandidate('provider1', '$15M'),      // -> 15000000
      createRawCandidate('provider2', 15000000),    // -> 15000000 (already number)
      createRawCandidate('provider3', '$20M'),      // -> 20000000
    ];

    const result = await pipeline.process('company.annual_revenue', candidates);

    // After normalization, conservative picks lowest number
    expect(result.resolved?.value).toBe(15000000);
    expect(typeof result.resolved?.value).toBe('number');

    // The value should be numeric, not the string "$15M"
    // This assertion would fail if resolve ran before normalize
    // because conservative on strings would pick shortest string
    expect(result.resolved?.value).not.toBe('$15M');

    // Verify all candidates were normalized to numbers
    const normalizedValues = result.candidates.map(c => c.value);
    expect(normalizedValues.every(v => typeof v === 'number')).toBe(true);
    expect(normalizedValues).toContain(15000000);
    expect(normalizedValues).toContain(20000000);

    // Verify raw values were preserved for provenance
    expect(result.candidates.find(c => c.raw_value === '$15M')).toBeDefined();
    expect(result.candidates.find(c => c.raw_value === 15000000)).toBeDefined();
    expect(result.candidates.find(c => c.raw_value === '$20M')).toBeDefined();
  });

  /**
   * Additional ordering test: Recency should pick most recent AFTER normalization
   *
   * This ensures that even for recency strategy, the value returned is normalized.
   */
  it('recency should return normalized value from most recent provider', async () => {
    const config: PipelineConfig = {
      harmonies: [companyNameHarmony],
      resolutionStrategy: 'recency',
    };
    const pipeline = new FieldPipeline(config);

    const candidates = [
      createRawCandidate('old', 'OLD COMPANY', { retrieved_at: '2024-01-01T00:00:00.000Z' }),
      createRawCandidate('new', 'NEW COMPANY', { retrieved_at: '2024-06-01T00:00:00.000Z' }),
    ];

    const result = await pipeline.process('company.name', candidates);

    // Should pick the newest (provider 'new')
    expect(result.resolved?.source).toBe('new');
    // But the VALUE should be normalized (title case)
    expect(result.resolved?.value).toBe('New Company');
    // NOT the raw value
    expect(result.resolved?.value).not.toBe('NEW COMPANY');
  });

  /**
   * Verify that without normalization, consensus fails to match.
   * This is a control test to prove the ordering tests are valid.
   */
  it('without normalization, consensus cannot match different cases', async () => {
    const config: PipelineConfig = {
      harmonies: [], // NO harmonies = no normalization
      resolutionStrategy: 'consensus',
    };
    const pipeline = new FieldPipeline(config);

    // Same values as the first ordering test
    const candidates = [
      createRawCandidate('provider1', 'ACME CORPORATION'),
      createRawCandidate('provider2', 'Acme Corp'),
      createRawCandidate('provider3', 'ACME CORP'),
    ];

    const result = await pipeline.process('company.name', candidates);

    // Without normalization, all values are different
    // So there's no consensus (all have count 1)
    // The resolver will pick first encountered value
    const value = result.resolved?.value;

    // The value will be one of the raw values (not normalized)
    expect(['ACME CORPORATION', 'Acme Corp', 'ACME CORP']).toContain(value);

    // Specifically, it won't be "Acme Corp" by consensus because
    // all three values are considered different without normalization
    // (This is the control - proving normalization is required for proper consensus)
  });

  /**
   * Verify that without normalization, conservative compares strings not numbers.
   * This is a control test to prove the ordering tests are valid.
   */
  it('without normalization, conservative compares strings incorrectly', async () => {
    const config: PipelineConfig = {
      harmonies: [], // NO harmonies = no normalization
      resolutionStrategy: 'conservative',
    };
    const pipeline = new FieldPipeline(config);

    // Same values as the second ordering test
    const candidates = [
      createRawCandidate('provider1', '$15M'),
      createRawCandidate('provider2', '$20M'),
    ];

    const result = await pipeline.process('company.annual_revenue', candidates);

    // Without normalization, conservative picks shortest string
    // "$15M" (4 chars) vs "$20M" (4 chars) - same length, picks first
    // The value is still a string, NOT a number
    expect(typeof result.resolved?.value).toBe('string');

    // This is WRONG for revenue comparison but proves normalization is needed
  });
});

// ═══════════════════════════════════════════════════════════════
// FACTORY FUNCTION TESTS
// ═══════════════════════════════════════════════════════════════

describe('createPipeline factory', () => {
  it('should create a pipeline with given config', () => {
    const config: PipelineConfig = {
      harmonies: [companyNameHarmony],
      resolutionStrategy: 'priority',
    };
    const pipeline = createPipeline(config);

    expect(pipeline.getConfig()).toEqual(config);
  });

  it('should accept optional options', () => {
    const config: PipelineConfig = {
      harmonies: [],
      resolutionStrategy: 'priority',
    };
    const pipeline = createPipeline(config, { continueOnError: false });

    expect(pipeline).toBeDefined();
  });
});

describe('processField convenience function', () => {
  it('should process a field in a single call', async () => {
    const config: PipelineConfig = {
      harmonies: [companyNameHarmony],
      resolutionStrategy: 'priority',
      priorityOrder: ['clearbit'],
    };

    const result = await processField(
      'company.name',
      [createRawCandidate('clearbit', 'ACME CORP')],
      config
    );

    expect(result.resolved?.value).toBe('Acme Corp');
    expect(result.field).toBe('company.name');
  });
});

// ═══════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════

describe('Edge cases', () => {
  it('should handle empty candidates array', async () => {
    const config: PipelineConfig = {
      harmonies: [],
      resolutionStrategy: 'priority',
    };
    const pipeline = new FieldPipeline(config);

    const result = await pipeline.process('field', []);

    expect(result.resolved).toBeNull();
    expect(result.candidates).toHaveLength(0);
  });

  it('should handle single candidate', async () => {
    const config: PipelineConfig = {
      harmonies: [companyNameHarmony],
      resolutionStrategy: 'priority',
    };
    const pipeline = new FieldPipeline(config);

    const result = await pipeline.process('company.name', [
      createRawCandidate('only', 'ONLY COMPANY'),
    ]);

    expect(result.resolved?.value).toBe('Only Company');
    expect(result.candidates).toHaveLength(1);
  });

  it('should skip null values but include other candidates', async () => {
    const config: PipelineConfig = {
      harmonies: [],
      resolutionStrategy: 'priority',
      priorityOrder: ['first', 'second'],
    };
    const pipeline = new FieldPipeline(config);

    const result = await pipeline.process('field', [
      createRawCandidate('first', null),
      createRawCandidate('second', 'valid'),
    ]);

    expect(result.resolved?.value).toBe('valid');
    expect(result.resolved?.source).toBe('second');
  });

  it('should preserve harmony info on winning candidate', async () => {
    const config: PipelineConfig = {
      harmonies: [companyNameHarmony],
      resolutionStrategy: 'priority',
      priorityOrder: ['clearbit'],
    };
    const pipeline = new FieldPipeline(config);

    const result = await pipeline.process('company.name', [
      createRawCandidate('clearbit', 'ACME'),
    ]);

    expect(result.resolved?.harmony).toBe('company-name-normalizer@1.0.0');
  });

  it('should handle candidate where harmony does not apply', async () => {
    // This harmony only applies to strings with $type check
    const config: PipelineConfig = {
      harmonies: [revenueParserHarmony],
      resolutionStrategy: 'priority',
    };
    const pipeline = new FieldPipeline(config);

    // Already a number, harmony passes through
    const result = await pipeline.process('company.annual_revenue', [
      createRawCandidate('provider', 50000000),
    ]);

    expect(result.resolved?.value).toBe(50000000);
  });
});
