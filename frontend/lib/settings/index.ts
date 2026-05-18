/**
 * Settings Module - Phase 9
 *
 * Exports normalization settings types, context, and utilities.
 */

// Types
export type {
  NormalizationMode,
  NormalizationSettings,
} from './normalization-types';

export {
  DEFAULT_NORMALIZATION_SETTINGS,
  NORMALIZATION_SETTINGS_KEY,
  RESOLUTION_STRATEGY_INFO,
  PROVIDER_INFO,
} from './normalization-types';

// Context
export {
  NormalizationProvider,
  useNormalizationSettings,
  getNormalizationMode,
} from './normalization-context';
