/**
 * harmony_test MCP Tool
 *
 * Tests a Harmony against sample data or runs its embedded test cases.
 */

import type {
  HarmonyTestInput,
  HarmonyTestOutput,
  HarmonyTestCaseResult,
  McpResponse,
  McpToolDefinition,
} from '../types';
import { getHarmonyById } from '../../harmonies/library';
import { HarmonyExecutor } from '../../harmonies/engine/harmony-executor';
import {
  runHarmonyTests,
  valuesEqual,
  type TestResults,
} from '../../harmonies/engine/test-runner';

/**
 * Convert TestResults to HarmonyTestOutput.
 */
function toTestOutput(results: TestResults): HarmonyTestOutput {
  return {
    harmonyId: results.harmonyId,
    harmonyVersion: results.harmonyVersion,
    total: results.total,
    passed: results.passed,
    failed: results.failed,
    skipped: results.skipped,
    passRate: results.passRate,
    allPassed: results.allPassed,
    results: results.results.map((r) => ({
      name: r.name,
      passed: r.passed,
      skipped: r.skipped,
      input: r.input,
      expected: r.expected,
      actual: r.actual,
      ruleApplied: r.ruleApplied,
      error: r.error,
      executionMs: r.executionMs,
    })),
    totalExecutionMs: results.totalExecutionMs,
  };
}

/**
 * Execute the harmony_test tool.
 */
export async function executeHarmonyTest(
  input: HarmonyTestInput
): Promise<McpResponse<HarmonyTestOutput>> {
  const startTime = performance.now();

  try {
    // Look up the Harmony by ID
    const harmony = getHarmonyById(input.harmonyId);

    if (!harmony) {
      return {
        success: false,
        error: {
          code: 'harmony_not_found',
          message: `Harmony with ID "${input.harmonyId}" not found`,
          details: { harmonyId: input.harmonyId },
        },
        timing: {
          totalMs: performance.now() - startTime,
        },
      };
    }

    // If no custom test data provided, run embedded tests
    if (!input.testData || input.testData.length === 0) {
      const results = await runHarmonyTests(harmony);
      return {
        success: true,
        data: toTestOutput(results),
        timing: {
          totalMs: performance.now() - startTime,
        },
      };
    }

    // Run custom test data
    const executor = new HarmonyExecutor(harmony);
    const source = input.source ?? 'test';
    const testResults: HarmonyTestCaseResult[] = [];

    let passed = 0;
    let failed = 0;

    for (let i = 0; i < input.testData.length; i++) {
      const testCase = input.testData[i];
      const testName = `Custom Test ${i + 1}`;
      const testStart = performance.now();

      try {
        const result = await executor.execute({
          value: testCase.input,
          record: testCase.context,
          source,
        });

        // Determine if test passed
        let testPassed = true;
        if (testCase.expected !== undefined) {
          testPassed = valuesEqual(result.value, testCase.expected);
        }
        // If no expected value provided, just check execution succeeded
        testPassed = testPassed && result.success;

        if (testPassed) {
          passed++;
        } else {
          failed++;
        }

        testResults.push({
          name: testName,
          passed: testPassed,
          skipped: false,
          input: testCase.input,
          expected: testCase.expected,
          actual: result.value,
          ruleApplied: result.ruleApplied,
          error: result.error?.message,
          executionMs: performance.now() - testStart,
        });
      } catch (err) {
        failed++;
        testResults.push({
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

    const total = input.testData.length;
    const output: HarmonyTestOutput = {
      harmonyId: harmony.spec.id,
      harmonyVersion: harmony.spec.version,
      total,
      passed,
      failed,
      skipped: 0,
      passRate: total > 0 ? passed / total : 1,
      allPassed: failed === 0,
      results: testResults,
      totalExecutionMs: performance.now() - startTime,
    };

    return {
      success: true,
      data: output,
      timing: {
        totalMs: performance.now() - startTime,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'test_error',
        message: err instanceof Error ? err.message : String(err),
      },
      timing: {
        totalMs: performance.now() - startTime,
      },
    };
  }
}

/**
 * Input schema for harmony_test tool.
 */
export const harmonyTestInputSchema = {
  type: 'object',
  properties: {
    harmonyId: {
      type: 'string',
      description: 'Harmony ID to test',
    },
    testData: {
      type: 'array',
      description: 'Custom test data to run through the Harmony',
      items: {
        type: 'object',
        properties: {
          input: {
            description: 'Input value for the test',
          },
          expected: {
            description: 'Expected output (optional)',
          },
          context: {
            type: 'object',
            description: 'Additional context for multi-field harmonies',
          },
        },
        required: ['input'],
      },
    },
    source: {
      type: 'string',
      description: 'Source provider for test execution context (default: "test")',
      default: 'test',
    },
  },
  required: ['harmonyId'],
  additionalProperties: false,
};

/**
 * harmony_test tool definition.
 */
export const harmonyTestTool: McpToolDefinition<
  HarmonyTestInput,
  HarmonyTestOutput
> = {
  name: 'harmony_test',
  description:
    'Test a Harmony against sample data or run its embedded test cases. Returns detailed pass/fail results for each test.',
  inputSchema: harmonyTestInputSchema,
  execute: executeHarmonyTest,
};
