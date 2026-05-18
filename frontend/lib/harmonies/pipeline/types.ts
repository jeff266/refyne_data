/**
 * Pipeline Composition & Resolver Types
 *
 * Phase 5 of the Harmonies normalization engine.
 * Defines the types for the normalize-before-resolve pipeline.
 */

import type { ValidatedHarmony } from '../spec/schema';
import type { ResolutionStrategy, ResolvedField } from '../canonical/provenance';

/**
 * A candidate value AFTER normalization has been applied.
 * This is the output of the normalizer and input to the resolver.
 *
 * IMPORTANT: The pipeline MUST normalize each provider's data BEFORE resolution.
 * The resolver receives NormalizedCandidate<T> objects, not raw provider data.
 */
export interface NormalizedCandidate<T> {
  /** Post-normalization value (transformed by harmony) */
  value: T;

  /** Original value from the provider before any transformation */
  raw_value: unknown;

  /** Provider ID (e.g., 'clearbit', 'apollo', 'zoominfo') */
  source: string;

  /** ISO timestamp when the provider returned this value */
  retrieved_at: string;

  /**
   * ID of the harmony that transformed this value.
   * Format: "harmony-id@version" or null if no transformation was applied.
   */
  harmony_applied: string | null;
}

/**
 * Raw candidate input from a provider before normalization.
 */
export interface RawCandidate {
  /** The raw value from the provider */
  value: unknown;

  /** Provider ID */
  source: string;

  /** ISO timestamp when retrieved */
  retrieved_at: string;

  /** Optional: full record context for multi-field harmonies */
  record?: Record<string, unknown>;
}

/**
 * Configuration for a field processing pipeline.
 */
export interface PipelineConfig {
  /**
   * Harmonies to apply during normalization.
   * Applied in order to each provider's raw data.
   */
  harmonies: ValidatedHarmony[];

  /**
   * Strategy for resolving across normalized candidates.
   * Applied AFTER normalization, not before.
   */
  resolutionStrategy: ResolutionStrategy;

  /**
   * Provider priority order for 'priority' strategy.
   * First provider in list with a non-null value wins.
   */
  priorityOrder?: string[];

  /**
   * Similarity threshold for 'consensus' strategy.
   * Values above this threshold are considered equivalent.
   * Default: 1.0 (exact match only)
   */
  similarityThreshold?: number;
}

/**
 * Timing breakdown for pipeline execution.
 */
export interface PipelineTiming {
  /** Time spent normalizing all candidates (ms) */
  normalizeMs: number;

  /** Time spent resolving across normalized candidates (ms) */
  resolveMs: number;

  /** Total pipeline execution time (ms) */
  totalMs: number;
}

/**
 * Result of processing a field through the pipeline.
 */
export interface PipelineResult<T = unknown> {
  /** The canonical field name that was processed */
  field: string;

  /** The resolved field with provenance tracking */
  resolved: ResolvedField<T> | null;

  /** All normalized candidates that were considered */
  candidates: NormalizedCandidate<T>[];

  /** Timing breakdown */
  timing: PipelineTiming;
}

/**
 * Error that occurred during pipeline processing.
 */
export interface PipelineError {
  /** Which stage the error occurred in */
  stage: 'normalize' | 'resolve';

  /** The source provider (if applicable) */
  source?: string;

  /** Error message */
  message: string;

  /** Underlying error */
  cause?: Error;
}

/**
 * Result of normalizing a single candidate.
 */
export interface NormalizationResult<T = unknown> {
  success: boolean;
  candidate?: NormalizedCandidate<T>;
  error?: PipelineError;
}

/**
 * Options for pipeline execution.
 */
export interface PipelineOptions {
  /**
   * Whether to continue processing if one candidate fails normalization.
   * Default: true (skip failed candidates, continue with rest)
   */
  continueOnError?: boolean;

  /**
   * Timeout for each normalization operation (ms).
   * Default: 1000ms
   */
  normalizeTimeout?: number;
}
