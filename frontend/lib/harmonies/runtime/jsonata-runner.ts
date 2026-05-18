/**
 * JSONata execution engine for Harmony transformations.
 *
 * Features:
 * - Expression compilation with caching (by hash)
 * - Execution context binding (value, source, metadata)
 * - Timeout handling for runaway expressions
 * - Error capture with expression location
 * - Custom builtin function registration
 */

import jsonata from 'jsonata';
import { createHash } from 'crypto';
import { registerBuiltins } from './builtins';

/**
 * Execution context passed to JSONata expressions.
 */
export interface ExecutionContext {
  /** The primary value being transformed */
  value: unknown;

  /** The full record for multi-field access */
  record?: Record<string, unknown>;

  /** Source provider identifier */
  source?: string;

  /** Additional metadata */
  meta?: Record<string, unknown>;
}

/**
 * Options for expression execution.
 */
export interface ExecutionOptions {
  /** Timeout in milliseconds (default: 1000ms) */
  timeout?: number;

  /** Whether to register builtin functions (default: true) */
  useBuiltins?: boolean;

  /** Additional bindings to inject */
  bindings?: Record<string, unknown>;
}

/**
 * Result of expression execution.
 */
export interface ExecutionResult<T = unknown> {
  success: boolean;
  value?: T;
  error?: ExecutionError;
  timing: {
    compiledFromCache: boolean;
    executionMs: number;
  };
}

/**
 * Error details from failed execution.
 */
export interface ExecutionError {
  message: string;
  code: ExecutionErrorCode;
  expression: string;
  location?: {
    path?: string;
    ruleId?: string;
    position?: number;
  };
  cause?: Error;
}

/**
 * Error codes for execution failures.
 */
export type ExecutionErrorCode =
  | 'compile_error'
  | 'runtime_error'
  | 'timeout_error'
  | 'type_error'
  | 'binding_error';

/**
 * Compiled expression cache entry.
 */
interface CacheEntry {
  expression: jsonata.Expression;
  hash: string;
  compiledAt: number;
  hitCount: number;
}

/**
 * Configuration for the JSONata runner.
 */
export interface RunnerConfig {
  /** Maximum number of cached expressions (default: 1000) */
  maxCacheSize?: number;

  /** Default timeout in ms (default: 1000) */
  defaultTimeout?: number;

  /** Whether to use builtins by default (default: true) */
  defaultUseBuiltins?: boolean;
}

/**
 * JSONata Runner class.
 * Manages expression compilation, caching, and execution.
 */
export class JSONataRunner {
  private cache: Map<string, CacheEntry> = new Map();
  private config: Required<RunnerConfig>;

  constructor(config: RunnerConfig = {}) {
    this.config = {
      maxCacheSize: config.maxCacheSize ?? 1000,
      defaultTimeout: config.defaultTimeout ?? 1000,
      defaultUseBuiltins: config.defaultUseBuiltins ?? true,
    };
  }

  /**
   * Execute a JSONata expression with the given context.
   *
   * @param expression - JSONata expression string
   * @param context - Execution context with value, record, source, meta
   * @param options - Execution options
   * @returns Execution result with value or error
   */
  async execute<T = unknown>(
    expression: string,
    context: ExecutionContext,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult<T>> {
    const startTime = performance.now();
    const timeout = options.timeout ?? this.config.defaultTimeout;
    const useBuiltins = options.useBuiltins ?? this.config.defaultUseBuiltins;

    // Step 1: Get or compile expression
    let compiled: jsonata.Expression;
    let fromCache = false;

    try {
      const result = this.getOrCompile(expression, useBuiltins);
      compiled = result.expression;
      fromCache = result.fromCache;
    } catch (err) {
      return {
        success: false,
        error: this.createError('compile_error', expression, err),
        timing: {
          compiledFromCache: false,
          executionMs: performance.now() - startTime,
        },
      };
    }

    // Step 2: Bind context
    try {
      this.bindContext(compiled, context, options.bindings);
    } catch (err) {
      return {
        success: false,
        error: this.createError('binding_error', expression, err),
        timing: {
          compiledFromCache: fromCache,
          executionMs: performance.now() - startTime,
        },
      };
    }

    // Step 3: Execute with timeout
    // Wrap context so expressions can access `value`, `source`, etc. as fields
    const input = {
      value: context.value,
      source: context.source,
      record: context.record,
      meta: context.meta,
    };

    try {
      const value = await this.executeWithTimeout<T>(
        compiled,
        input,
        timeout
      );

      return {
        success: true,
        value,
        timing: {
          compiledFromCache: fromCache,
          executionMs: performance.now() - startTime,
        },
      };
    } catch (err) {
      const code = this.isTimeoutError(err) ? 'timeout_error' : 'runtime_error';
      return {
        success: false,
        error: this.createError(code, expression, err),
        timing: {
          compiledFromCache: fromCache,
          executionMs: performance.now() - startTime,
        },
      };
    }
  }

  /**
   * Execute a 'when' condition - returns boolean.
   *
   * @param expression - JSONata condition expression
   * @param context - Execution context
   * @param options - Execution options
   * @returns true if condition passes, false otherwise
   */
  async evaluateCondition(
    expression: string,
    context: ExecutionContext,
    options: ExecutionOptions = {}
  ): Promise<{ passes: boolean; error?: ExecutionError }> {
    const result = await this.execute<unknown>(expression, context, options);

    if (!result.success) {
      return { passes: false, error: result.error };
    }

    // JSONata truthy evaluation
    const passes = Boolean(result.value);
    return { passes };
  }

  /**
   * Compile and validate an expression without executing.
   * Useful for validation in the spec parser.
   *
   * @param expression - JSONata expression string
   * @returns Validation result
   */
  validate(expression: string): {
    valid: boolean;
    error?: string;
    ast?: unknown;
  } {
    try {
      const compiled = jsonata(expression);
      return {
        valid: true,
        ast: compiled.ast(),
      };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitCounts: Record<string, number>;
  } {
    const hitCounts: Record<string, number> = {};
    Array.from(this.cache.entries()).forEach(([hash, entry]) => {
      hitCounts[hash.slice(0, 8)] = entry.hitCount;
    });

    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      hitCounts,
    };
  }

  /**
   * Clear the expression cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Remove a specific expression from cache.
   */
  invalidate(expression: string): boolean {
    const hash = this.hashExpression(expression);
    return this.cache.delete(hash);
  }

  // ─────────────────────────────────────────────────────────────
  // Private methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Get compiled expression from cache or compile new.
   */
  private getOrCompile(
    expression: string,
    useBuiltins: boolean
  ): { expression: jsonata.Expression; fromCache: boolean } {
    const hash = this.hashExpression(expression);
    const cached = this.cache.get(hash);

    if (cached) {
      cached.hitCount++;
      return { expression: cached.expression, fromCache: true };
    }

    // Compile new expression
    const compiled = jsonata(expression);

    // Register builtins if requested
    if (useBuiltins) {
      registerBuiltins(compiled);
    }

    // Add to cache (with eviction if needed)
    this.addToCache(hash, compiled);

    return { expression: compiled, fromCache: false };
  }

  /**
   * Add expression to cache with LRU eviction.
   */
  private addToCache(hash: string, expression: jsonata.Expression): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.config.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(hash, {
      expression,
      hash,
      compiledAt: Date.now(),
      hitCount: 0,
    });
  }

  /**
   * Bind execution context to compiled expression.
   */
  private bindContext(
    expression: jsonata.Expression,
    context: ExecutionContext,
    additionalBindings?: Record<string, unknown>
  ): void {
    // Bind the record for $record access
    if (context.record) {
      expression.registerFunction('record', () => context.record, '<:o>');
    }

    // Bind source identifier
    if (context.source) {
      expression.registerFunction('source', () => context.source, '<:s>');
    }

    // Bind metadata
    if (context.meta) {
      expression.registerFunction('meta', () => context.meta, '<:o>');
    }

    // Bind any additional values
    if (additionalBindings) {
      for (const [key, value] of Object.entries(additionalBindings)) {
        expression.registerFunction(key, () => value, '<:x>');
      }
    }
  }

  /**
   * Execute expression with timeout protection.
   */
  private async executeWithTimeout<T>(
    expression: jsonata.Expression,
    input: unknown,
    timeoutMs: number
  ): Promise<T> {
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const error = new Error(`Expression execution timed out after ${timeoutMs}ms`);
        (error as Error & { code: string }).code = 'TIMEOUT';
        reject(error);
      }, timeoutMs);
    });

    // Race the evaluation against the timeout
    const evaluationPromise = expression.evaluate(input) as Promise<T>;

    return Promise.race([evaluationPromise, timeoutPromise]);
  }

  /**
   * Create a structured error object.
   */
  private createError(
    code: ExecutionErrorCode,
    expression: string,
    err: unknown,
    location?: ExecutionError['location']
  ): ExecutionError {
    let message: string;
    let cause: Error | undefined;

    if (err instanceof Error) {
      message = err.message;
      cause = err;
    } else if (err && typeof err === 'object' && 'message' in err) {
      message = String((err as { message: unknown }).message);
    } else {
      message = String(err);
    }

    // Extract position from JSONata error if available
    let position: number | undefined;
    if (err && typeof err === 'object' && 'position' in err) {
      position = (err as { position: number }).position;
    }

    return {
      message,
      code,
      expression,
      location: location
        ? { ...location, position }
        : position !== undefined
        ? { position }
        : undefined,
      cause,
    };
  }

  /**
   * Check if error is a timeout error.
   */
  private isTimeoutError(err: unknown): boolean {
    return (
      err instanceof Error &&
      (err as Error & { code?: string }).code === 'TIMEOUT'
    );
  }

  /**
   * Generate hash for expression caching.
   */
  private hashExpression(expression: string): string {
    return createHash('sha256').update(expression).digest('hex');
  }
}

// ─────────────────────────────────────────────────────────────
// Convenience functions
// ─────────────────────────────────────────────────────────────

/** Default runner instance for simple usage */
let defaultRunner: JSONataRunner | null = null;

/**
 * Get the default runner instance.
 */
export function getDefaultRunner(): JSONataRunner {
  if (!defaultRunner) {
    defaultRunner = new JSONataRunner();
  }
  return defaultRunner;
}

/**
 * Execute an expression using the default runner.
 * Convenience function for simple use cases.
 *
 * @param expression - JSONata expression string
 * @param value - Primary value to transform
 * @param context - Optional additional context
 * @returns Execution result
 */
export async function evaluate<T = unknown>(
  expression: string,
  value: unknown,
  context?: Partial<Omit<ExecutionContext, 'value'>>
): Promise<ExecutionResult<T>> {
  return getDefaultRunner().execute<T>(expression, { value, ...context });
}

/**
 * Validate an expression using the default runner.
 * Convenience function for validation.
 *
 * @param expression - JSONata expression to validate
 * @returns Validation result
 */
export function validateExpression(expression: string): {
  valid: boolean;
  error?: string;
} {
  return getDefaultRunner().validate(expression);
}

/**
 * Create a new runner instance with custom config.
 *
 * @param config - Runner configuration
 * @returns New JSONataRunner instance
 */
export function createRunner(config?: RunnerConfig): JSONataRunner {
  return new JSONataRunner(config);
}
