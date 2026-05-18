/**
 * Normalization Settings Types - Phase 9
 *
 * Type definitions for configuring normalization behavior.
 */

import type { ResolutionStrategy } from '../harmonies/canonical/provenance';

/**
 * Normalization mode determines when normalization occurs.
 * - implicit: Auto-normalize on every enrichment_pull (returns CanonicalEntity)
 * - explicit: Only normalize when explicitly requested via enrichment_normalize
 */
export type NormalizationMode = 'implicit' | 'explicit';

/**
 * Complete normalization settings configuration.
 */
export interface NormalizationSettings {
  /** Mode: implicit (auto) or explicit (manual) */
  mode: NormalizationMode;

  /** Default resolution strategy when resolving multi-provider data */
  defaultResolutionStrategy: ResolutionStrategy;

  /** Provider priority order for 'priority' strategy */
  providerPriority: string[];

  /**
   * Enabled Harmony IDs.
   * Empty array means ALL Harmonies are enabled.
   * Non-empty array means ONLY listed Harmonies are enabled.
   */
  enabledHarmonies: string[];

  /** Advanced settings */
  advanced: {
    /** Timeout for normalization operations in milliseconds */
    normalizeTimeout: number;
    /** Continue processing if one candidate fails normalization */
    continueOnError: boolean;
    /** Similarity threshold for consensus strategy (0-1) */
    consensusThreshold: number;
  };
}

/**
 * Default settings for new installations.
 */
export const DEFAULT_NORMALIZATION_SETTINGS: NormalizationSettings = {
  mode: 'implicit',
  defaultResolutionStrategy: 'priority',
  providerPriority: ['zoominfo', 'apollo', 'serper', 'clay', 'graphiq', 'yelp'],
  enabledHarmonies: [], // Empty = all enabled
  advanced: {
    normalizeTimeout: 1000,
    continueOnError: true,
    consensusThreshold: 0.8,
  },
};

/**
 * LocalStorage key for persisting settings.
 */
export const NORMALIZATION_SETTINGS_KEY = 'enrichment-switcher:normalization-settings';

/**
 * Resolution strategy metadata for UI display.
 */
export const RESOLUTION_STRATEGY_INFO: Record<
  ResolutionStrategy,
  { label: string; description: string; icon: string }
> = {
  priority: {
    label: 'Priority',
    description: 'First provider with data wins (configurable order)',
    icon: 'ListOrdered',
  },
  recency: {
    label: 'Recency',
    description: 'Most recently retrieved value wins',
    icon: 'Clock',
  },
  consensus: {
    label: 'Consensus',
    description: 'Most common value across providers wins',
    icon: 'Users',
  },
  conservative: {
    label: 'Conservative',
    description: 'Safest/lowest value wins (e.g., for estimates)',
    icon: 'Shield',
  },
};

/**
 * Provider metadata for UI display.
 */
export const PROVIDER_INFO: Record<
  string,
  { name: string; description: string }
> = {
  zoominfo: { name: 'ZoomInfo', description: 'Enterprise B2B intelligence' },
  apollo: { name: 'Apollo', description: 'B2B contact and company data' },
  serper: { name: 'Serper', description: 'Google Maps local business data' },
  clay: { name: 'Clay', description: 'AI-powered enrichment' },
  graphiq: { name: 'GraphIQ', description: 'Knowledge graph enrichment' },
  yelp: { name: 'Yelp', description: 'Local business data' },
};
