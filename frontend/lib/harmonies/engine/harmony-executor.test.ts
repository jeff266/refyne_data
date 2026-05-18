/**
 * Tests for HarmonyExecutor and TestRunner
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  HarmonyExecutor,
  createExecutor,
  executeHarmony,
  type ExecutionInput,
  type ExecutionOutput,
} from './harmony-executor';
import {
  runHarmonyTests,
  valuesEqual,
  formatTestResults,
  createTestCase,
  type TestResults,
} from './test-runner';
import { parseHarmony } from '../spec/parser';
import type { ValidatedHarmony, HarmonySpec } from '../spec/schema';
import { JSONataRunner, createRunner } from '../runtime/jsonata-runner';

// ─────────────────────────────────────────────────────────────
// Helper: Create a validated harmony from a spec object
// ─────────────────────────────────────────────────────────────

function createValidatedHarmony(
  spec: HarmonySpec,
  overrides?: Partial<ValidatedHarmony>
): ValidatedHarmony {
  return {
    spec,
    source: 'custom',
    compiled_at: new Date().toISOString(),
    hash: 'test-hash',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Helper: Create a minimal harmony spec for testing
// ─────────────────────────────────────────────────────────────

function createMinimalSpec(
  rules: HarmonySpec['rules'],
  overrides?: Partial<HarmonySpec>
): HarmonySpec {
  return {
    id: 'test-harmony',
    version: '1.0.0',
    name: 'Test Harmony',
    description: 'A test harmony',
    category: 'custom',
    author: 'test',
    applies_to: {
      fields: ['company.name'],
    },
    sources: [],
    rules,
    tests: [
      {
        name: 'Placeholder test',
        input: 'test',
        expected: 'test',
      },
    ],
    on_error: 'fail-silent-log',
    default_enabled: true,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Test: Rule Matching with `when` Conditions
// ─────────────────────────────────────────────────────────────

describe('HarmonyExecutor - Rule Matching', () => {
  it('should apply rule with no when condition (always matches)', async () => {
    const spec = createMinimalSpec([
      {
        id: 'always-upper',
        description: 'Always uppercase',
        transform: '$uppercase(value)',
      },
    ]);
    const harmony = createValidatedHarmony(spec);
    const executor = new HarmonyExecutor(harmony);

    const result = await executor.execute({
      value: 'hello',
      source: 'test',
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe('HELLO');
    expect(result.ruleApplied).toBe('always-upper');
  });

  it('should apply rule when `when` condition is true', async () => {
    const spec = createMinimalSpec([
      {
        id: 'uppercase-short',
        description: 'Uppercase short strings',
        when: '$length(value) < 5',
        transform: '$uppercase(value)',
      },
      {
        id: 'lowercase-long',
        description: 'Lowercase long strings',
        transform: '$lowercase(value)',
      },
    ]);
    const harmony = createValidatedHarmony(spec);
    const executor = new HarmonyExecutor(harmony);

    // Short string - first rule matches
    const shortResult = await executor.execute({
      value: 'Hi',
      source: 'test',
    });
    expect(shortResult.value).toBe('HI');
    expect(shortResult.ruleApplied).toBe('uppercase-short');

    // Long string - first rule doesn't match, second applies
    const longResult = await executor.execute({
      value: 'Hello World',
      source: 'test',
    });
    expect(longResult.value).toBe('hello world');
    expect(longResult.ruleApplied).toBe('lowercase-long');
  });

  it('should skip rule when `when` condition is false', async () => {
    const spec = createMinimalSpec([
      {
        id: 'only-numbers',
        description: 'Only transform numbers',
        when: '$type(value) = "number"',
        transform: 'value * 2',
      },
      {
        id: 'passthrough',
        description: 'Pass through everything else',
        transform: 'value',
      },
    ]);
    const harmony = createValidatedHarmony(spec);
    const executor = new HarmonyExecutor(harmony);

    const stringResult = await executor.execute({
      value: 'not a number',
      source: 'test',
    });
    expect(stringResult.value).toBe('not a number');
    expect(stringResult.ruleApplied).toBe('passthrough');

    const numberResult = await executor.execute({
      value: 5,
      source: 'test',
    });
    expect(numberResult.value).toBe(10);
    expect(numberResult.ruleApplied).toBe('only-numbers');
  });

  it('should return original value when no rule matches', async () => {
    const spec = createMinimalSpec([
      {
        id: 'never-matches',
        description: 'Never matches',
        when: 'false',
        transform: '"should not see this"',
      },
    ]);
    const harmony = createValidatedHarmony(spec);
    const executor = new HarmonyExecutor(harmony);

    const result = await executor.execute({
      value: 'original',
      source: 'test',
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe('original');
    expect(result.ruleApplied).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Test: Rule Order (First Match Wins)
// ─────────────────────────────────────────────────────────────

describe('HarmonyExecutor - Rule Order', () => {
  it('should apply first matching rule and stop (short-circuit)', async () => {
    const spec = createMinimalSpec([
      {
        id: 'first',
        description: 'First rule',
        when: 'true',
        transform: '"first"',
      },
      {
        id: 'second',
        description: 'Second rule',
        when: 'true',
        transform: '"second"',
      },
      {
        id: 'third',
        description: 'Third rule',
        transform: '"third"',
      },
    ]);
    const harmony = createValidatedHarmony(spec);
    const executor = new HarmonyExecutor(harmony);

    const result = await executor.execute({
      value: 'anything',
      source: 'test',
    });

    expect(result.value).toBe('first');
    expect(result.ruleApplied).toBe('first');
    expect(result.timing.rulesEvaluated).toBe(1);
  });

  it('should evaluate rules in order until one matches', async () => {
    const spec = createMinimalSpec([
      {
        id: 'negative',
        description: 'For negative numbers',
        when: 'value < 0',
        transform: '"negative"',
      },
      {
        id: 'zero',
        description: 'For zero',
        when: 'value = 0',
        transform: '"zero"',
      },
      {
        id: 'positive',
        description: 'For positive numbers',
        when: 'value > 0',
        transform: '"positive"',
      },
    ]);
    const harmony = createValidatedHarmony(spec);
    const executor = new HarmonyExecutor(harmony);

    const negResult = await executor.execute({ value: -5, source: 'test' });
    expect(negResult.value).toBe('negative');
    expect(negResult.timing.rulesEvaluated).toBe(1);

    const zeroResult = await executor.execute({ value: 0, source: 'test' });
    expect(zeroResult.value).toBe('zero');
    expect(zeroResult.timing.rulesEvaluated).toBe(2);

    const posResult = await executor.execute({ value: 10, source: 'test' });
    expect(posResult.value).toBe('positive');
    expect(posResult.timing.rulesEvaluated).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────
// Test: Error Policies
// ─────────────────────────────────────────────────────────────

describe('HarmonyExecutor - Error Policies', () => {
  it('should fail-loud: return error and halt on failure', async () => {
    const spec = createMinimalSpec(
      [
        {
          id: 'bad-rule',
          description: 'Rule with invalid expression',
          transform: '$nonexistent_function(value)',
        },
      ],
      { on_error: 'fail-loud' }
    );
    const harmony = createValidatedHarmony(spec);
    const executor = new HarmonyExecutor(harmony);

    const result = await executor.execute({
      value: 'test',
      source: 'test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('runtime_error');
    expect(result.ruleApplied).toBeNull();
  });

  it('should fail-silent-log: skip failing rule and continue', async () => {
    // Spy on console.warn to verify logging
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const spec = createMinimalSpec(
      [
        {
          id: 'bad-rule',
          description: 'Rule that fails',
          when: '$nonexistent(value)', // This will fail
          transform: '"bad"',
        },
        {
          id: 'good-rule',
          description: 'Fallback rule',
          transform: '"good"',
        },
      ],
      { on_error: 'fail-silent-log' }
    );
    const harmony = createValidatedHarmony(spec);
    const executor = new HarmonyExecutor(harmony);

    const result = await executor.execute({
      value: 'test',
      source: 'test',
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe('good');
    expect(result.ruleApplied).toBe('good-rule');
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('should fail-default: use rule default value on failure', async () => {
    const spec = createMinimalSpec(
      [
        {
          id: 'bad-rule-with-default',
          description: 'Rule that fails but has default',
          transform: '$nonexistent_function(value)',
          default: 'default-value',
        },
      ],
      { on_error: 'fail-default' }
    );
    const harmony = createValidatedHarmony(spec);
    const executor = new HarmonyExecutor(harmony);

    const result = await executor.execute({
      value: 'test',
      source: 'test',
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe('default-value');
    expect(result.ruleApplied).toBe('bad-rule-with-default');
  });

  it('should fail-default: continue to next rule if no default', async () => {
    const spec = createMinimalSpec(
      [
        {
          id: 'bad-rule-no-default',
          description: 'Rule that fails without default',
          transform: '$nonexistent_function(value)',
        },
        {
          id: 'fallback',
          description: 'Fallback',
          transform: '"fallback"',
        },
      ],
      { on_error: 'fail-default' }
    );
    const harmony = createValidatedHarmony(spec);
    const executor = new HarmonyExecutor(harmony);

    const result = await executor.execute({
      value: 'test',
      source: 'test',
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe('fallback');
    expect(result.ruleApplied).toBe('fallback');
  });

  it('should allow error policy override via options', async () => {
    const spec = createMinimalSpec(
      [
        {
          id: 'bad-rule',
          description: 'Rule that fails',
          transform: '$nonexistent_function(value)',
        },
      ],
      { on_error: 'fail-silent-log' } // Spec says silent
    );
    const harmony = createValidatedHarmony(spec);

    // Override to fail-loud
    const executor = new HarmonyExecutor(harmony, {
      errorPolicy: 'fail-loud',
    });

    const result = await executor.execute({
      value: 'test',
      source: 'test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────
// Test: Source Filtering
// ─────────────────────────────────────────────────────────────

describe('HarmonyExecutor - Source Filtering', () => {
  it('should execute for any source when sources list is empty', async () => {
    const spec = createMinimalSpec(
      [
        {
          id: 'uppercase',
          description: 'Uppercase',
          transform: '$uppercase(value)',
        },
      ],
      { sources: [] }
    );
    const harmony = createValidatedHarmony(spec);
    const executor = new HarmonyExecutor(harmony);

    const result = await executor.execute({
      value: 'test',
      source: 'any-source',
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe('TEST');
  });

  it('should execute only for allowed sources', async () => {
    const spec = createMinimalSpec(
      [
        {
          id: 'uppercase',
          description: 'Uppercase',
          transform: '$uppercase(value)',
        },
      ],
      { sources: ['clearbit', 'apollo'] }
    );
    const harmony = createValidatedHarmony(spec);
    const executor = new HarmonyExecutor(harmony);

    // Allowed source
    const allowedResult = await executor.execute({
      value: 'test',
      source: 'clearbit',
    });
    expect(allowedResult.value).toBe('TEST');
    expect(allowedResult.ruleApplied).toBe('uppercase');

    // Not allowed source - returns original unchanged
    const notAllowedResult = await executor.execute({
      value: 'test',
      source: 'zoominfo',
    });
    expect(notAllowedResult.value).toBe('test');
    expect(notAllowedResult.ruleApplied).toBeNull();
    expect(notAllowedResult.timing.rulesEvaluated).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Test: Record Context Access
// ─────────────────────────────────────────────────────────────

describe('HarmonyExecutor - Record Context', () => {
  it('should provide access to full record via $record()', async () => {
    const spec = createMinimalSpec([
      {
        id: 'use-record',
        description: 'Combine fields from record',
        transform: 'value & " (" & $record().domain & ")"',
      },
    ]);
    const harmony = createValidatedHarmony(spec);
    const executor = new HarmonyExecutor(harmony);

    const result = await executor.execute({
      value: 'Acme Corp',
      record: { domain: 'acme.com', industry: 'Technology' },
      source: 'test',
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe('Acme Corp (acme.com)');
  });

  it('should work without record context', async () => {
    const spec = createMinimalSpec([
      {
        id: 'no-record',
        description: 'Works without record',
        transform: '$uppercase(value)',
      },
    ]);
    const harmony = createValidatedHarmony(spec);
    const executor = new HarmonyExecutor(harmony);

    const result = await executor.execute({
      value: 'test',
      source: 'test',
      // No record provided
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe('TEST');
  });
});

// ─────────────────────────────────────────────────────────────
// Test: Test Runner
// ─────────────────────────────────────────────────────────────

describe('Test Runner', () => {
  it('should run all test cases and report results', async () => {
    const spec = createMinimalSpec(
      [
        {
          id: 'uppercase',
          description: 'Uppercase',
          transform: '$uppercase(value)',
        },
      ],
      {
        tests: [
          { name: 'Test 1', input: 'hello', expected: 'HELLO' },
          { name: 'Test 2', input: 'world', expected: 'WORLD' },
          { name: 'Test 3', input: '', expected: '' },
        ],
      }
    );
    const harmony = createValidatedHarmony(spec);

    const results = await runHarmonyTests(harmony);

    expect(results.total).toBe(3);
    expect(results.passed).toBe(3);
    expect(results.failed).toBe(0);
    expect(results.allPassed).toBe(true);
    expect(results.passRate).toBe(1);
  });

  it('should detect failed tests', async () => {
    const spec = createMinimalSpec(
      [
        {
          id: 'uppercase',
          description: 'Uppercase',
          transform: '$uppercase(value)',
        },
      ],
      {
        tests: [
          { name: 'Passing', input: 'hello', expected: 'HELLO' },
          { name: 'Failing', input: 'world', expected: 'wrong' },
        ],
      }
    );
    const harmony = createValidatedHarmony(spec);

    const results = await runHarmonyTests(harmony);

    expect(results.total).toBe(2);
    expect(results.passed).toBe(1);
    expect(results.failed).toBe(1);
    expect(results.allPassed).toBe(false);
    expect(results.passRate).toBe(0.5);

    const failedTest = results.results.find((r) => !r.passed);
    expect(failedTest?.name).toBe('Failing');
    expect(failedTest?.expected).toBe('wrong');
    expect(failedTest?.actual).toBe('WORLD');
  });

  it('should handle skipped tests', async () => {
    const spec = createMinimalSpec(
      [
        {
          id: 'uppercase',
          description: 'Uppercase',
          transform: '$uppercase(value)',
        },
      ],
      {
        tests: [
          { name: 'Passing', input: 'hello', expected: 'HELLO' },
          { name: 'Skipped', input: 'skip', expected: 'SKIP', skip: true },
        ],
      }
    );
    const harmony = createValidatedHarmony(spec);

    const results = await runHarmonyTests(harmony);

    expect(results.total).toBe(2);
    expect(results.passed).toBe(1);
    expect(results.skipped).toBe(1);
    expect(results.failed).toBe(0);
    expect(results.allPassed).toBe(true);
    expect(results.passRate).toBe(1); // 1/1 non-skipped passed
  });

  it('should handle test with context', async () => {
    const spec = createMinimalSpec(
      [
        {
          id: 'with-context',
          description: 'Uses context',
          transform: 'value & " - " & $record().suffix',
        },
      ],
      {
        tests: [
          {
            name: 'With context',
            input: 'Hello',
            expected: 'Hello - World',
            context: { suffix: 'World' },
          },
        ],
      }
    );
    const harmony = createValidatedHarmony(spec);

    const results = await runHarmonyTests(harmony);

    expect(results.allPassed).toBe(true);
    expect(results.results[0].actual).toBe('Hello - World');
  });
});

// ─────────────────────────────────────────────────────────────
// Test: valuesEqual Utility
// ─────────────────────────────────────────────────────────────

describe('valuesEqual', () => {
  it('should handle null and undefined', () => {
    expect(valuesEqual(null, null)).toBe(true);
    expect(valuesEqual(undefined, undefined)).toBe(true);
    expect(valuesEqual(null, undefined)).toBe(false);
    expect(valuesEqual(null, 'text')).toBe(false);
  });

  it('should compare strings exactly', () => {
    expect(valuesEqual('hello', 'hello')).toBe(true);
    expect(valuesEqual('hello', 'Hello')).toBe(false);
    expect(valuesEqual('', '')).toBe(true);
  });

  it('should compare numbers with tolerance', () => {
    expect(valuesEqual(1.0, 1.0)).toBe(true);
    expect(valuesEqual(1.0, 1.00001, 0.0001)).toBe(true);
    expect(valuesEqual(1.0, 1.001, 0.0001)).toBe(false);
    expect(valuesEqual(NaN, NaN)).toBe(true);
    expect(valuesEqual(Infinity, Infinity)).toBe(true);
    expect(valuesEqual(-Infinity, -Infinity)).toBe(true);
  });

  it('should compare booleans', () => {
    expect(valuesEqual(true, true)).toBe(true);
    expect(valuesEqual(false, false)).toBe(true);
    expect(valuesEqual(true, false)).toBe(false);
  });

  it('should compare arrays recursively', () => {
    expect(valuesEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(valuesEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(valuesEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(valuesEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
  });

  it('should compare objects recursively', () => {
    expect(valuesEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(valuesEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(valuesEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(valuesEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// Test: Real YAML Fixture
// ─────────────────────────────────────────────────────────────

describe('HarmonyExecutor - Real YAML Fixture', () => {
  let harmony: ValidatedHarmony;

  beforeEach(() => {
    const yamlPath = join(
      __dirname,
      '__fixtures__',
      'company-name-normalizer.yaml'
    );
    const yamlContent = readFileSync(yamlPath, 'utf-8');
    const parseResult = parseHarmony(yamlContent);

    if (!parseResult.success || !parseResult.harmony) {
      throw new Error(
        `Failed to parse fixture: ${JSON.stringify(parseResult.errors)}`
      );
    }

    harmony = parseResult.harmony;
  });

  it('should parse the fixture YAML successfully', () => {
    expect(harmony.spec.id).toBe('company-name-normalizer');
    expect(harmony.spec.rules.length).toBe(5);
    expect(harmony.spec.tests.length).toBe(6);
  });

  it('should execute the harmony rules correctly', async () => {
    const executor = new HarmonyExecutor(harmony);

    // Test null passthrough
    const nullResult = await executor.execute({
      value: null,
      source: 'test',
    });
    expect(nullResult.value).toBeNull();
    expect(nullResult.ruleApplied).toBe('null-passthrough');

    // Test Inc. stripping
    const incResult = await executor.execute({
      value: 'ACME Corporation, Inc.',
      source: 'test',
    });
    expect(incResult.value).toBe('Acme Corporation');
    expect(incResult.ruleApplied).toBe('strip-suffix-inc');

    // Test LLC stripping
    const llcResult = await executor.execute({
      value: 'TechStart LLC',
      source: 'test',
    });
    expect(llcResult.value).toBe('Techstart');
    expect(llcResult.ruleApplied).toBe('strip-suffix-llc');

    // Test default normalization
    const defaultResult = await executor.execute({
      value: '   EXAMPLE   COMPANY   ',
      source: 'test',
    });
    expect(defaultResult.value).toBe('Example Company');
    expect(defaultResult.ruleApplied).toBe('default-normalize');
  });

  it('should pass all embedded tests', async () => {
    const executor = new HarmonyExecutor(harmony);
    const results = await executor.runTests();

    // Log results for debugging if any fail
    if (!results.allPassed) {
      console.log(formatTestResults(results));
    }

    expect(results.allPassed).toBe(true);
    expect(results.passed).toBe(results.total);
  });
});

// ─────────────────────────────────────────────────────────────
// Test: Convenience Functions
// ─────────────────────────────────────────────────────────────

describe('Convenience Functions', () => {
  it('createExecutor should create an executor', async () => {
    const spec = createMinimalSpec([
      {
        id: 'test',
        description: 'Test',
        transform: '$uppercase(value)',
      },
    ]);
    const harmony = createValidatedHarmony(spec);

    const executor = createExecutor(harmony);
    const result = await executor.execute({ value: 'hello', source: 'test' });

    expect(result.value).toBe('HELLO');
  });

  it('executeHarmony should execute in a single call', async () => {
    const spec = createMinimalSpec([
      {
        id: 'test',
        description: 'Test',
        transform: '$lowercase(value)',
      },
    ]);
    const harmony = createValidatedHarmony(spec);

    const result = await executeHarmony(harmony, {
      value: 'HELLO',
      source: 'test',
    });

    expect(result.value).toBe('hello');
  });

  it('createTestCase should create valid test case objects', () => {
    const testCase = createTestCase('input', 'expected', {
      name: 'My Test',
      context: { extra: 'data' },
    });

    expect(testCase.input).toBe('input');
    expect(testCase.expected).toBe('expected');
    expect(testCase.name).toBe('My Test');
    expect(testCase.context).toEqual({ extra: 'data' });
  });
});

// ─────────────────────────────────────────────────────────────
// Test: Timing Information
// ─────────────────────────────────────────────────────────────

describe('HarmonyExecutor - Timing', () => {
  it('should report timing information', async () => {
    const spec = createMinimalSpec([
      {
        id: 'slow-rule',
        description: 'A rule',
        when: 'false',
        transform: 'value',
      },
      {
        id: 'matching-rule',
        description: 'Matches',
        transform: 'value',
      },
    ]);
    const harmony = createValidatedHarmony(spec);
    const executor = new HarmonyExecutor(harmony);

    const result = await executor.execute({
      value: 'test',
      source: 'test',
    });

    expect(result.timing).toBeDefined();
    expect(typeof result.timing.totalMs).toBe('number');
    expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.rulesEvaluated).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────
// Test: Builtin Functions
// ─────────────────────────────────────────────────────────────

describe('HarmonyExecutor - Builtin Functions', () => {
  it('should have access to builtin functions', async () => {
    const spec = createMinimalSpec([
      {
        id: 'use-builtins',
        description: 'Uses builtin functions',
        transform: '$clean_whitespace($normalize_case(value, "title"))',
      },
    ]);
    const harmony = createValidatedHarmony(spec);
    const executor = new HarmonyExecutor(harmony);

    const result = await executor.execute({
      value: '   hELLo   wORLd   ',
      source: 'test',
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe('Hello World');
  });

  it('should work with $parse_number builtin', async () => {
    const spec = createMinimalSpec([
      {
        id: 'parse-num',
        description: 'Parse number',
        transform: '$parse_number(value)',
      },
    ]);
    const harmony = createValidatedHarmony(spec);
    const executor = new HarmonyExecutor(harmony);

    const result = await executor.execute({
      value: '$1.5M',
      source: 'test',
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe(1500000);
  });

  it('should work with $extract_domain builtin', async () => {
    const spec = createMinimalSpec([
      {
        id: 'extract-domain',
        description: 'Extract domain',
        transform: '$extract_domain(value)',
      },
    ]);
    const harmony = createValidatedHarmony(spec);
    const executor = new HarmonyExecutor(harmony);

    const result = await executor.execute({
      value: 'https://www.example.com/path?query=1',
      source: 'test',
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe('example.com');
  });
});
