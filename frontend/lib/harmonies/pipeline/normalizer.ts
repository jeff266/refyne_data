/**
 * Normalizer - Transform raw provider data through Harmonies
 *
 * This module takes raw provider data and applies Harmony transformations
 * to produce NormalizedCandidate objects ready for resolution.
 *
 * CRITICAL: The normalizer MUST run BEFORE the resolver.
 * The pipeline flow is:
 *   Raw Provider Data -> Normalizer -> NormalizedCandidate -> Resolver
 *
 * Without normalization first:
 * - Consensus cannot detect "ACME CORPORATION" = "Acme Corp"
 * - Conservative cannot compare "$15M" vs 15000000
 */

import type { ValidatedHarmony } from '../spec/schema';
import {
  HarmonyExecutor,
  type ExecutionInput,
} from '../engine/harmony-executor';
import type {
  RawCandidate,
  NormalizedCandidate,
  NormalizationResult,
  PipelineError,
} from './types';

/**
 * Options for the Normalizer.
 */
export interface NormalizerOptions {
  /** Timeout for harmony execution (ms). Default: 1000 */
  timeout?: number;
}

/**
 * Normalizer class - applies Harmonies to raw provider data.
 *
 * Usage:
 *   const normalizer = new Normalizer(harmonies);
 *   const normalized = await normalizer.normalize(rawCandidate);
 */
export class Normalizer {
  private harmonies: ValidatedHarmony[];
  private executors: HarmonyExecutor[];
  private timeout: number;

  constructor(harmonies: ValidatedHarmony[], options: NormalizerOptions = {}) {
    this.harmonies = harmonies;
    this.timeout = options.timeout ?? 1000;

    // Pre-create executors for each harmony
    this.executors = harmonies.map(
      (harmony) => new HarmonyExecutor(harmony, { ruleTimeout: this.timeout })
    );
  }

  /**
   * Normalize a single raw candidate by applying all harmonies in sequence.
   *
   * @param candidate - Raw candidate from a provider
   * @returns NormalizationResult with the normalized candidate or error
   */
  async normalize<T = unknown>(
    candidate: RawCandidate
  ): Promise<NormalizationResult<T>> {
    const { value: rawValue, source, retrieved_at, record } = candidate;

    // Start with the raw value
    let currentValue: unknown = rawValue;
    let appliedHarmony: string | null = null;

    // Apply each harmony in sequence
    for (let i = 0; i < this.executors.length; i++) {
      const executor = this.executors[i];
      const harmony = this.harmonies[i];

      try {
        const input: ExecutionInput = {
          value: currentValue,
          record,
          source,
        };

        const result = await executor.execute(input);

        if (!result.success) {
          // Harmony execution failed
          // Check error policy - for fail-loud, return error
          if (harmony.spec.on_error === 'fail-loud') {
            return {
              success: false,
              error: {
                stage: 'normalize',
                source,
                message: result.error?.message ?? 'Harmony execution failed',
                cause: result.error?.cause,
              },
            };
          }
          // For other policies, continue with current value
          continue;
        }

        // If a rule was applied, track which harmony transformed the value
        if (result.ruleApplied !== null) {
          currentValue = result.value;
          appliedHarmony = `${harmony.spec.id}@${harmony.spec.version}`;
        }
      } catch (err) {
        // Unexpected error during normalization
        return {
          success: false,
          error: {
            stage: 'normalize',
            source,
            message: err instanceof Error ? err.message : String(err),
            cause: err instanceof Error ? err : undefined,
          },
        };
      }
    }

    // Build the normalized candidate
    const normalizedCandidate: NormalizedCandidate<T> = {
      value: currentValue as T,
      raw_value: rawValue,
      source,
      retrieved_at,
      harmony_applied: appliedHarmony,
    };

    return {
      success: true,
      candidate: normalizedCandidate,
    };
  }

  /**
   * Normalize multiple candidates in parallel.
   *
   * @param candidates - Array of raw candidates
   * @param options - Options for handling errors
   * @returns Array of normalization results
   */
  async normalizeAll<T = unknown>(
    candidates: RawCandidate[],
    options: { continueOnError?: boolean } = {}
  ): Promise<NormalizationResult<T>[]> {
    const { continueOnError = true } = options;

    // Normalize all candidates in parallel
    const results = await Promise.all(
      candidates.map((candidate) => this.normalize<T>(candidate))
    );

    // If not continuing on error, throw on first failure
    if (!continueOnError) {
      const firstError = results.find((r) => !r.success);
      if (firstError && firstError.error) {
        throw new Error(
          `Normalization failed for ${firstError.error.source}: ${firstError.error.message}`
        );
      }
    }

    return results;
  }

  /**
   * Get the harmonies this normalizer applies.
   */
  getHarmonies(): ValidatedHarmony[] {
    return this.harmonies;
  }
}

/**
 * Create a normalizer for the given harmonies.
 * Factory function for convenience.
 *
 * @param harmonies - Validated harmonies to apply
 * @param options - Optional normalizer configuration
 * @returns Normalizer instance
 */
export function createNormalizer(
  harmonies: ValidatedHarmony[],
  options?: NormalizerOptions
): Normalizer {
  return new Normalizer(harmonies, options);
}

/**
 * Normalize a single candidate with the given harmonies.
 * Convenience function for one-off normalization.
 *
 * @param candidate - Raw candidate to normalize
 * @param harmonies - Harmonies to apply
 * @param options - Optional configuration
 * @returns Normalization result
 */
export async function normalizeCandidate<T = unknown>(
  candidate: RawCandidate,
  harmonies: ValidatedHarmony[],
  options?: NormalizerOptions
): Promise<NormalizationResult<T>> {
  const normalizer = createNormalizer(harmonies, options);
  return normalizer.normalize<T>(candidate);
}
