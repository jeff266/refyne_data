/**
 * Test Runner for Harmony embedded test cases.
 *
 * Executes the test cases defined in a Harmony spec and reports
 * detailed results for each test, including pass/fail status,
 * actual vs expected values, and timing information.
 */

import {
  type ValidatedHarmony,
  type HarmonyTestCase,
} from '../spec/schema';
import {
  JSONataRunner,
  type ExecutionContext,
  createRunner,
} from '../runtime/jsonata-runner';

/**
 * Result of a single test case.
 */
export interface TestCaseResult {
  /** Test case name (or auto-generated) */
  name: string;
  /** Whether the test passed */
  passed: boolean;
  /** Whether this test was skipped */
  skipped: boolean;
  /** Input value provided */
  input: unknown;
  /** Expected output */
  expected: unknown;
  /** Actual output from execution */
  actual: unknown;
  /** Rule ID that was applied (if any) */
  ruleApplied: string | null;
  /** Error message if execution failed */
  error?: string;
  /** Execution time in milliseconds */
  executionMs: number;
}

/**
 * Aggregated test results for a harmony.
 */
export interface TestResults {
  /** Harmony ID */
  harmonyId: string;
  /** Harmony version */
  harmonyVersion: string;
  /** Total number of tests */
  total: number;
  /** Number of passed tests */
  passed: number;
  /** Number of failed tests */
  failed: number;
  /** Number of skipped tests */
  skipped: number;
  /** Overall pass rate (0-1) */
  passRate: number;
  /** Whether all non-skipped tests passed */
  allPassed: boolean;
  /** Individual test results */
  results: TestCaseResult[];
  /** Total execution time in milliseconds */
  totalExecutionMs: number;
}

/**
 * Options for test execution.
 */
export interface TestRunnerOptions {
  /** Custom JSONata runner */
  runner?: JSONataRunner;
  /** Tolerance for numeric comparisons (default: 0.0001) */
  numericTolerance?: number;
  /** Default source for test execution */
  defaultSource?: string;
  /** Timeout for each test in ms (default: 1000) */
  testTimeout?: number;
}

/**
 * Run all test cases for a harmony.
 *
 * @param harmony - Validated harmony containing test cases
 * @param runner - Optional JSONata runner (creates new if not provided)
 * @param options - Optional test runner options
 * @returns TestResults with detailed pass/fail information
 */
export async function runHarmonyTests(
  harmony: ValidatedHarmony,
  runner?: JSONataRunner,
  options: TestRunnerOptions = {}
): Promise<TestResults> {
  const startTime = performance.now();
  const jsonataRunner = runner ?? options.runner ?? createRunner();
  const numericTolerance = options.numericTolerance ?? 0.0001;
  const defaultSource = options.defaultSource ?? 'test';
  const testTimeout = options.testTimeout ?? 1000;

  const results: TestCaseResult[] = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < harmony.spec.tests.length; i++) {
    const testCase = harmony.spec.tests[i];
    const testName = testCase.name ?? `Test ${i + 1}`;

    // Handle skipped tests
    if (testCase.skip) {
      skipped++;
      results.push({
        name: testName,
        passed: false,
        skipped: true,
        input: testCase.input,
        expected: testCase.expected,
        actual: undefined,
        ruleApplied: null,
        executionMs: 0,
      });
      continue;
    }

    const testStart = performance.now();

    try {
      // Execute all rules against the test input
      const actual = await executeTestCase(
        harmony,
        testCase,
        jsonataRunner,
        defaultSource,
        testTimeout
      );

      const testPassed = valuesEqual(
        actual.value,
        testCase.expected,
        numericTolerance
      );

      if (testPassed) {
        passed++;
      } else {
        failed++;
      }

      results.push({
        name: testName,
        passed: testPassed,
        skipped: false,
        input: testCase.input,
        expected: testCase.expected,
        actual: actual.value,
        ruleApplied: actual.ruleApplied,
        executionMs: performance.now() - testStart,
      });
    } catch (err) {
      failed++;
      results.push({
        name: testName,
        passed: false,
        skipped: false,
        input: testCase.input,
        expected: testCase.expected,
        actual: undefined,
        ruleApplied: null,
        error: err instanceof Error ? err.message : String(err),
        executionMs: performance.now() - testStart,
      });
    }
  }

  const total = harmony.spec.tests.length;
  const nonSkipped = total - skipped;

  return {
    harmonyId: harmony.spec.id,
    harmonyVersion: harmony.spec.version,
    total,
    passed,
    failed,
    skipped,
    passRate: nonSkipped > 0 ? passed / nonSkipped : 1,
    allPassed: failed === 0,
    results,
    totalExecutionMs: performance.now() - startTime,
  };
}

/**
 * Execute a single test case against all harmony rules.
 */
async function executeTestCase(
  harmony: ValidatedHarmony,
  testCase: HarmonyTestCase,
  runner: JSONataRunner,
  defaultSource: string,
  timeout: number
): Promise<{ value: unknown; ruleApplied: string | null }> {
  const context: ExecutionContext = {
    value: testCase.input,
    record: testCase.context,
    source: defaultSource,
  };

  // Evaluate rules in order, same as HarmonyExecutor
  for (const rule of harmony.spec.rules) {
    // Check 'when' condition if present
    if (rule.when) {
      const conditionResult = await runner.evaluateCondition(
        rule.when,
        context,
        { timeout }
      );

      if (conditionResult.error) {
        throw new Error(
          `Condition error in rule ${rule.id}: ${conditionResult.error.message}`
        );
      }

      if (!conditionResult.passes) {
        continue; // Condition didn't match, try next rule
      }
    }

    // Rule matches - execute transform
    const transformResult = await runner.execute(
      rule.transform,
      context,
      { timeout }
    );

    if (!transformResult.success) {
      throw new Error(
        `Transform error in rule ${rule.id}: ${transformResult.error?.message}`
      );
    }

    return {
      value: transformResult.value,
      ruleApplied: rule.id,
    };
  }

  // No rule matched - return original value
  return {
    value: testCase.input,
    ruleApplied: null,
  };
}

/**
 * Compare two values for equality with tolerance for numbers.
 *
 * @param actual - Actual value from execution
 * @param expected - Expected value from test case
 * @param tolerance - Tolerance for numeric comparisons
 * @returns true if values are equal within tolerance
 */
export function valuesEqual(
  actual: unknown,
  expected: unknown,
  tolerance: number = 0.0001
): boolean {
  // Handle null/undefined
  if (actual === null && expected === null) return true;
  if (actual === undefined && expected === undefined) return true;
  if (actual === null || actual === undefined) return false;
  if (expected === null || expected === undefined) return false;

  // Handle numbers with tolerance
  if (typeof actual === 'number' && typeof expected === 'number') {
    if (Number.isNaN(actual) && Number.isNaN(expected)) return true;
    if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
      return actual === expected;
    }
    return Math.abs(actual - expected) <= tolerance;
  }

  // Handle strings
  if (typeof actual === 'string' && typeof expected === 'string') {
    return actual === expected;
  }

  // Handle booleans
  if (typeof actual === 'boolean' && typeof expected === 'boolean') {
    return actual === expected;
  }

  // Handle arrays
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return false;
    return actual.every((item, i) => valuesEqual(item, expected[i], tolerance));
  }

  // Handle objects
  if (
    typeof actual === 'object' &&
    typeof expected === 'object' &&
    actual !== null &&
    expected !== null
  ) {
    const actualKeys = Object.keys(actual as object);
    const expectedKeys = Object.keys(expected as object);

    if (actualKeys.length !== expectedKeys.length) return false;

    return actualKeys.every((key) =>
      valuesEqual(
        (actual as Record<string, unknown>)[key],
        (expected as Record<string, unknown>)[key],
        tolerance
      )
    );
  }

  // Fallback to strict equality
  return actual === expected;
}

/**
 * Format test results for console output.
 *
 * @param results - TestResults to format
 * @returns Formatted string for display
 */
export function formatTestResults(results: TestResults): string {
  const lines: string[] = [];

  // Header
  lines.push(`\nTest Results: ${results.harmonyId}@${results.harmonyVersion}`);
  lines.push('='.repeat(50));

  // Summary
  const statusIcon = results.allPassed ? '[PASS]' : '[FAIL]';
  lines.push(
    `${statusIcon} ${results.passed}/${results.total - results.skipped} passed` +
      (results.skipped > 0 ? ` (${results.skipped} skipped)` : '') +
      ` in ${results.totalExecutionMs.toFixed(2)}ms`
  );
  lines.push('');

  // Individual results
  for (const result of results.results) {
    if (result.skipped) {
      lines.push(`  [SKIP] ${result.name}`);
      continue;
    }

    const icon = result.passed ? '[PASS]' : '[FAIL]';
    lines.push(`  ${icon} ${result.name}`);

    if (!result.passed) {
      lines.push(`    Input:    ${JSON.stringify(result.input)}`);
      lines.push(`    Expected: ${JSON.stringify(result.expected)}`);
      lines.push(`    Actual:   ${JSON.stringify(result.actual)}`);
      if (result.error) {
        lines.push(`    Error:    ${result.error}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Create a test case programmatically.
 *
 * @param input - Input value
 * @param expected - Expected output
 * @param options - Optional name, context, skip flag
 * @returns HarmonyTestCase
 */
export function createTestCase(
  input: unknown,
  expected: unknown,
  options: {
    name?: string;
    context?: Record<string, unknown>;
    skip?: boolean;
  } = {}
): HarmonyTestCase {
  return {
    input,
    expected,
    name: options.name,
    context: options.context,
    skip: options.skip,
  };
}
