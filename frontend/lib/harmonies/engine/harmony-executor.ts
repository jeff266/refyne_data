/**
 * Harmony Executor - Single Harmony Execution Engine
 *
 * Executes a validated Harmony's rules against input data,
 * handling rule matching, error policies, and transformation.
 */

import {
  type ValidatedHarmony,
  type HarmonyRule,
  type HarmonyTestCase,
  type ErrorPolicy,
} from '../spec/schema';
import {
  JSONataRunner,
  type ExecutionContext,
  type ExecutionError,
  createRunner,
} from '../runtime/jsonata-runner';
import { runHarmonyTests, type TestResults } from './test-runner';

/**
 * Input for harmony execution.
 */
export interface ExecutionInput {
  /** The field value to transform */
  value: unknown;
  /** Full record for multi-field access via $record() */
  record?: Record<string, unknown>;
  /** Provider ID (e.g., 'clearbit', 'apollo') */
  source: string;
}

/**
 * Output from harmony execution.
 */
export interface ExecutionOutput {
  /** Whether execution completed successfully */
  success: boolean;
  /** Transformed value (or original if no rule matched/error with use-original policy) */
  value: unknown;
  /** ID of the rule that matched and was applied, null if no rule matched */
  ruleApplied: string | null;
  /** Error details if execution failed */
  error?: ExecutionError;
  /** Execution timing information */
  timing: {
    /** Total execution time in milliseconds */
    totalMs: number;
    /** Number of rules evaluated before match/completion */
    rulesEvaluated: number;
  };
}

/**
 * Options for the HarmonyExecutor.
 */
export interface HarmonyExecutorOptions {
  /** Custom JSONata runner (uses default if not provided) */
  runner?: JSONataRunner;
  /** Override the harmony's error policy */
  errorPolicy?: ErrorPolicy;
  /** Timeout for individual rule evaluation in ms (default: 1000) */
  ruleTimeout?: number;
}

/**
 * HarmonyExecutor - executes a single harmony against input data.
 *
 * Rules are evaluated in order until one matches. A rule matches when:
 * 1. It has no `when` condition, OR
 * 2. Its `when` condition evaluates to true
 *
 * Once a rule matches, its transform is executed and the result is returned.
 * If no rule matches, the original value is returned unchanged.
 */
export class HarmonyExecutor {
  private harmony: ValidatedHarmony;
  private runner: JSONataRunner;
  private errorPolicy: ErrorPolicy;
  private ruleTimeout: number;

  constructor(harmony: ValidatedHarmony, options: HarmonyExecutorOptions = {}) {
    this.harmony = harmony;
    this.runner = options.runner ?? createRunner();
    this.errorPolicy = options.errorPolicy ?? harmony.spec.on_error;
    this.ruleTimeout = options.ruleTimeout ?? 1000;
  }

  /**
   * Execute the harmony's rules against the input.
   *
   * @param input - The input containing value, record, and source
   * @returns ExecutionOutput with transformed value or error
   */
  async execute(input: ExecutionInput): Promise<ExecutionOutput> {
    const startTime = performance.now();
    let rulesEvaluated = 0;

    const context: ExecutionContext = {
      value: input.value,
      record: input.record,
      source: input.source,
    };

    // Check if source is allowed (if sources are specified)
    if (this.harmony.spec.sources.length > 0) {
      if (!this.harmony.spec.sources.includes(input.source)) {
        // Source not in allowed list - return original unchanged
        return {
          success: true,
          value: input.value,
          ruleApplied: null,
          timing: {
            totalMs: performance.now() - startTime,
            rulesEvaluated: 0,
          },
        };
      }
    }

    // Evaluate rules in order
    for (const rule of this.harmony.spec.rules) {
      rulesEvaluated++;

      try {
        // Check 'when' condition if present
        if (rule.when) {
          const conditionResult = await this.runner.evaluateCondition(
            rule.when,
            context,
            { timeout: this.ruleTimeout }
          );

          if (conditionResult.error) {
            // Condition evaluation failed
            const output = this.handleError(
              conditionResult.error,
              input.value,
              rule,
              startTime,
              rulesEvaluated
            );
            if (output) return output;
            // If handleError returns undefined, continue to next rule
            continue;
          }

          if (!conditionResult.passes) {
            // Condition didn't match, try next rule
            continue;
          }
        }

        // Rule matches (either no 'when' or 'when' evaluated to true)
        // Execute the transform
        const transformResult = await this.runner.execute(
          rule.transform,
          context,
          { timeout: this.ruleTimeout }
        );

        if (!transformResult.success) {
          // Transform execution failed
          const output = this.handleError(
            transformResult.error!,
            input.value,
            rule,
            startTime,
            rulesEvaluated
          );
          if (output) return output;
          // If handleError returns undefined, continue to next rule
          continue;
        }

        // Success! Return the transformed value
        return {
          success: true,
          value: transformResult.value,
          ruleApplied: rule.id,
          timing: {
            totalMs: performance.now() - startTime,
            rulesEvaluated,
          },
        };
      } catch (err) {
        // Unexpected error
        const error: ExecutionError = {
          message: err instanceof Error ? err.message : String(err),
          code: 'runtime_error',
          expression: rule.transform,
          location: { ruleId: rule.id },
          cause: err instanceof Error ? err : undefined,
        };

        const output = this.handleError(
          error,
          input.value,
          rule,
          startTime,
          rulesEvaluated
        );
        if (output) return output;
      }
    }

    // No rule matched - return original value unchanged
    return {
      success: true,
      value: input.value,
      ruleApplied: null,
      timing: {
        totalMs: performance.now() - startTime,
        rulesEvaluated,
      },
    };
  }

  /**
   * Run the harmony's embedded test cases.
   *
   * @returns TestResults with pass/fail for each test
   */
  async runTests(): Promise<TestResults> {
    return runHarmonyTests(this.harmony, this.runner);
  }

  /**
   * Get the harmony spec being executed.
   */
  getHarmony(): ValidatedHarmony {
    return this.harmony;
  }

  /**
   * Handle an error according to the error policy.
   *
   * @returns ExecutionOutput if error should halt execution, undefined to continue
   */
  private handleError(
    error: ExecutionError,
    originalValue: unknown,
    rule: HarmonyRule,
    startTime: number,
    rulesEvaluated: number
  ): ExecutionOutput | undefined {
    const timing = {
      totalMs: performance.now() - startTime,
      rulesEvaluated,
    };

    switch (this.errorPolicy) {
      case 'fail-loud':
        // Raise error, halt execution
        return {
          success: false,
          value: originalValue,
          ruleApplied: null,
          error,
          timing,
        };

      case 'fail-silent-log':
        // Log warning and continue to next rule
        console.warn(
          `[Harmony ${this.harmony.spec.id}] Rule ${rule.id} failed:`,
          error.message
        );
        return undefined; // Continue to next rule

      case 'fail-default':
        // Use the rule's default value if available
        if (rule.default !== undefined) {
          return {
            success: true,
            value: rule.default,
            ruleApplied: rule.id,
            timing,
          };
        }
        // No default, continue to next rule
        return undefined;

      default:
        // Unknown policy, treat as fail-silent-log
        console.warn(
          `[Harmony ${this.harmony.spec.id}] Unknown error policy: ${this.errorPolicy}`
        );
        return undefined;
    }
  }
}

/**
 * Create a HarmonyExecutor for the given harmony.
 * Convenience factory function.
 *
 * @param harmony - Validated harmony to execute
 * @param options - Optional executor configuration
 * @returns HarmonyExecutor instance
 */
export function createExecutor(
  harmony: ValidatedHarmony,
  options?: HarmonyExecutorOptions
): HarmonyExecutor {
  return new HarmonyExecutor(harmony, options);
}

/**
 * Execute a harmony against input in a single call.
 * Convenience function for one-off executions.
 *
 * @param harmony - Validated harmony to execute
 * @param input - Input data to transform
 * @param options - Optional executor configuration
 * @returns ExecutionOutput with result
 */
export async function executeHarmony(
  harmony: ValidatedHarmony,
  input: ExecutionInput,
  options?: HarmonyExecutorOptions
): Promise<ExecutionOutput> {
  const executor = createExecutor(harmony, options);
  return executor.execute(input);
}
