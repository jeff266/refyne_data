/**
 * Normalization Settings Utilities - Phase 9
 *
 * Non-React utility functions for settings access.
 */

import type { NormalizationSettings } from './normalization-types';
import {
  DEFAULT_NORMALIZATION_SETTINGS,
  NORMALIZATION_SETTINGS_KEY,
} from './normalization-types';

/**
 * Standalone function to get current settings (for non-React code).
 * Returns defaults if not in browser or if no settings saved.
 */
export function getNormalizationSettings(): NormalizationSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_NORMALIZATION_SETTINGS;
  }
  try {
    const stored = localStorage.getItem(NORMALIZATION_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<NormalizationSettings>;
      return {
        ...DEFAULT_NORMALIZATION_SETTINGS,
        ...parsed,
        advanced: {
          ...DEFAULT_NORMALIZATION_SETTINGS.advanced,
          ...parsed.advanced,
        },
      };
    }
  } catch {
    // Ignore errors
  }
  return DEFAULT_NORMALIZATION_SETTINGS;
}

/**
 * Save settings to localStorage.
 */
export function saveNormalizationSettings(settings: NormalizationSettings): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(NORMALIZATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save normalization settings:', err);
  }
}

/**
 * Clear settings from localStorage (reset to defaults).
 */
export function clearNormalizationSettings(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(NORMALIZATION_SETTINGS_KEY);
  } catch (err) {
    console.error('Failed to clear normalization settings:', err);
  }
}
