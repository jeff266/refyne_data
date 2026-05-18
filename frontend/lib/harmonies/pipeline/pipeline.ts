/**
 * FieldPipeline - The core composition engine for normalize-before-resolve
 *
 * This is Phase 5 of the Harmonies engine: Pipeline Composition & Resolver.
 *
 * CRITICAL INVARIANT: NORMALIZE-BEFORE-RESOLVE
 * =============================================
 * The pipeline MUST normalize each provider's data BEFORE resolution.
 * This ordering is non-negotiable because:
 *
 * 1. Consensus strategy cannot detect matches without normalization:
 *    - "ACME CORPORATION" and "Acme Corp" look different before normalization
 *    - After title case normalization, both become comparable
 *
 * 2. Conservative strategy cannot compare values without normalization:
 *    - "$15M" (string) vs 15000000 (number) cannot be compared
 *    - After parse_number normalization, both become 15000000
 *
 * The flow MUST be:
 *   Provider A raw -> Normalize -> NormalizedCandidate A
 *   Provider B raw -> Normalize -> NormalizedCandidate B
 *   Provider C raw -> Normalize -> NormalizedCandidate C
 *                         |
 *              Resolver receives normalized candidates
 *                         |
 *                   ResolvedField<T>
 */

import {
  resolveField,
  type CandidateValue,
  type ResolvedField,
} from '../canonical/provenance';
import { Normalizer } from './normalizer';
import type {
  PipelineConfig,
  PipelineResult,
  PipelineTiming,
  RawCandidate,
  NormalizedCandidate,
  PipelineOptions,
} from './types';

/**
 * FieldPipeline - Process multiple provider results for a single field.
 *
 * The pipeline:
 * 1. Normalizes each candidate (in parallel) using configured Harmonies
 * 2. Converts normalized candidates to resolver-compatible format
 * 3. Resolves across normalized candidates using the configured strategy
 * 4. Returns the resolved field with full provenance tracking
 */
export class FieldPipeline {
  private config: PipelineConfig;
  private normalizer: Normalizer;
  private options: Required<PipelineOptions>;

  constructor(config: PipelineConfig, options: PipelineOptions = {}) {
    this.config = config;
    this.normalizer = new Normalizer(config.harmonies, {
      timeout: options.normalizeTimeout ?? 1000,
    });
    this.options = {
      continueOnError: options.continueOnError ?? true,
      normalizeTimeout: options.normalizeTimeout ?? 1000,
    };
  }

  /**
   * Process multiple provider results for a single field.
   *
   * CRITICAL: This method MUST normalize before resolving.
   * The ordering guarantee is enforced by the implementation:
   * 1. All normalization completes (await normalizeAll)
   * 2. THEN resolution runs on normalized results
   *
   * @param field - The canonical field name being processed
   * @param candidates - Raw candidates from providers
   * @returns PipelineResult with resolved value and provenance
   */
  async process<T = unknown>(
    field: string,
    candidates: RawCandidate[]
  ): Promise<PipelineResult<T>> {
    const totalStart = performance.now();
    let normalizeMs = 0;
    let resolveMs = 0;

    // ═══════════════════════════════════════════════════════════
    // STEP 1: NORMALIZE (must complete before resolve)
    // ═══════════════════════════════════════════════════════════
    const normalizeStart = performance.now();

    const normalizationResults = await this.normalizer.normalizeAll<T>(
      candidates,
      { continueOnError: this.options.continueOnError }
    );

    // Extract successful normalized candidates
    const normalizedCandidates: NormalizedCandidate<T>[] = [];
    for (const result of normalizationResults) {
      if (result.success && result.candidate) {
        normalizedCandidates.push(result.candidate);
      }
    }

    normalizeMs = performance.now() - normalizeStart;

    // ═══════════════════════════════════════════════════════════
    // STEP 2: RESOLVE (only after normalization is complete)
    // ═══════════════════════════════════════════════════════════
    const resolveStart = performance.now();

    // Convert NormalizedCandidate to CandidateValue for the resolver
    // The resolver uses 'provider' field, we have 'source' field
    const resolverCandidates: CandidateValue<T>[] = normalizedCandidates.map(
      (nc) => ({
        provider: nc.source,
        value: nc.value,
        retrieved_at: nc.retrieved_at,
        raw_value: nc.raw_value,
      })
    );

    // Resolve using the existing resolveField function
    const resolved = resolveField<T>(
      resolverCandidates,
      this.config.resolutionStrategy,
      {
        priorityOrder: this.config.priorityOrder,
        similarityThreshold: this.config.similarityThreshold,
      }
    );

    // If resolution succeeded, attach harmony info from the winning candidate
    if (resolved) {
      // Find the winning normalized candidate to get the harmony info
      const winningNormalized = normalizedCandidates.find(
        (nc) => nc.source === resolved.source
      );
      if (winningNormalized?.harmony_applied) {
        resolved.harmony = winningNormalized.harmony_applied;
      }
    }

    resolveMs = performance.now() - resolveStart;

    // ═══════════════════════════════════════════════════════════
    // STEP 3: BUILD RESULT
    // ═══════════════════════════════════════════════════════════
    const timing: PipelineTiming = {
      normalizeMs,
      resolveMs,
      totalMs: performance.now() - totalStart,
    };

    return {
      field,
      resolved,
      candidates: normalizedCandidates,
      timing,
    };
  }

  /**
   * Get the pipeline configuration.
   */
  getConfig(): PipelineConfig {
    return this.config;
  }

  /**
   * Get the normalizer used by this pipeline.
   */
  getNormalizer(): Normalizer {
    return this.normalizer;
  }
}

/**
 * Create a FieldPipeline with the given configuration.
 * Factory function for convenience.
 *
 * @param config - Pipeline configuration
 * @param options - Optional execution options
 * @returns FieldPipeline instance
 */
export function createPipeline(
  config: PipelineConfig,
  options?: PipelineOptions
): FieldPipeline {
  return new FieldPipeline(config, options);
}

/**
 * Process a field through the pipeline in a single call.
 * Convenience function for one-off processing.
 *
 * @param field - The canonical field name
 * @param candidates - Raw candidates from providers
 * @param config - Pipeline configuration
 * @param options - Optional execution options
 * @returns PipelineResult
 */
export async function processField<T = unknown>(
  field: string,
  candidates: RawCandidate[],
  config: PipelineConfig,
  options?: PipelineOptions
): Promise<PipelineResult<T>> {
  const pipeline = createPipeline(config, options);
  return pipeline.process<T>(field, candidates);
}
