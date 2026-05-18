/**
 * Runtime module for Harmony JSONata execution.
 *
 * This module provides the execution layer for Harmony transformations,
 * including the JSONata runner with caching, timeout handling, and
 * custom builtin functions for data normalization.
 */

// JSONata Runner exports
export {
  // Classes
  JSONataRunner,

  // Types
  type ExecutionContext,
  type ExecutionOptions,
  type ExecutionResult,
  type ExecutionError,
  type ExecutionErrorCode,
  type RunnerConfig,

  // Convenience functions
  getDefaultRunner,
  evaluate,
  validateExpression,
  createRunner,
} from './jsonata-runner';

// Builtin functions exports
export {
  // Functions (for direct use or testing)
  normalizeCase,
  cleanWhitespace,
  parseNumber,
  formatPhone,
  extractDomain,
  matchPattern,
  coalesce,
  similarity,

  // Types
  type CaseStyle,
  type PhoneRegion,
  type PatternMatchResult,
  type BuiltinFunction,

  // Registry
  BUILTIN_FUNCTIONS,
  registerBuiltins,
  getBuiltinDocs,
} from './builtins';
