/**
 * Pipeline module exports
 *
 * Phase 5: Pipeline Composition & Resolver
 *
 * This module provides the normalize-before-resolve pipeline for
 * processing enrichment data from multiple providers.
 */

// Types
export type {
  NormalizedCandidate,
  RawCandidate,
  PipelineConfig,
  PipelineResult,
  PipelineTiming,
  PipelineError,
  NormalizationResult,
  PipelineOptions,
} from './types';

// Normalizer
export {
  Normalizer,
  createNormalizer,
  normalizeCandidate,
  type NormalizerOptions,
} from './normalizer';

// Pipeline
export {
  FieldPipeline,
  createPipeline,
  processField,
} from './pipeline';
