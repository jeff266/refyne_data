/**
 * Engine module for Harmony execution.
 *
 * This module provides the execution layer for running Harmony rules
 * against input data, including the executor class, test runner,
 * and convenience functions.
 */

// Harmony Executor exports
export {
  // Classes
  HarmonyExecutor,

  // Types
  type ExecutionInput,
  type ExecutionOutput,
  type HarmonyExecutorOptions,

  // Factory functions
  createExecutor,
  executeHarmony,
} from './harmony-executor';

// Test Runner exports
export {
  // Types
  type TestCaseResult,
  type TestResults,
  type TestRunnerOptions,

  // Functions
  runHarmonyTests,
  valuesEqual,
  formatTestResults,
  createTestCase,
} from './test-runner';
