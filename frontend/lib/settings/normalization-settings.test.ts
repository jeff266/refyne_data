/**
 * Normalization Settings Tests - Phase 9
 *
 * Tests for settings types, context, and persistence.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  DEFAULT_NORMALIZATION_SETTINGS,
  NORMALIZATION_SETTINGS_KEY,
  RESOLUTION_STRATEGY_INFO,
  PROVIDER_INFO,
} from './normalization-types';
import type { NormalizationSettings, NormalizationMode } from './normalization-types';
import { getNormalizationSettings } from './normalization-utils';

// Mock localStorage and window
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// Mock both window and localStorage for browser environment simulation
Object.defineProperty(global, 'window', { value: {}, writable: true });
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('NormalizationSettings Types', () => {
  describe('DEFAULT_NORMALIZATION_SETTINGS', () => {
    it('should have implicit mode by default', () => {
      expect(DEFAULT_NORMALIZATION_SETTINGS.mode).toBe('implicit');
    });

    it('should have priority as default resolution strategy', () => {
      expect(DEFAULT_NORMALIZATION_SETTINGS.defaultResolutionStrategy).toBe('priority');
    });

    it('should have all 6 providers in priority order', () => {
      expect(DEFAULT_NORMALIZATION_SETTINGS.providerPriority).toHaveLength(6);
      expect(DEFAULT_NORMALIZATION_SETTINGS.providerPriority).toContain('zoominfo');
      expect(DEFAULT_NORMALIZATION_SETTINGS.providerPriority).toContain('apollo');
      expect(DEFAULT_NORMALIZATION_SETTINGS.providerPriority).toContain('serper');
      expect(DEFAULT_NORMALIZATION_SETTINGS.providerPriority).toContain('clay');
      expect(DEFAULT_NORMALIZATION_SETTINGS.providerPriority).toContain('graphiq');
      expect(DEFAULT_NORMALIZATION_SETTINGS.providerPriority).toContain('yelp');
    });

    it('should have empty enabledHarmonies (all enabled)', () => {
      expect(DEFAULT_NORMALIZATION_SETTINGS.enabledHarmonies).toEqual([]);
    });

    it('should have sensible advanced defaults', () => {
      expect(DEFAULT_NORMALIZATION_SETTINGS.advanced.normalizeTimeout).toBe(1000);
      expect(DEFAULT_NORMALIZATION_SETTINGS.advanced.continueOnError).toBe(true);
      expect(DEFAULT_NORMALIZATION_SETTINGS.advanced.consensusThreshold).toBe(0.8);
    });
  });

  describe('RESOLUTION_STRATEGY_INFO', () => {
    it('should have info for all 4 strategies', () => {
      expect(Object.keys(RESOLUTION_STRATEGY_INFO)).toHaveLength(4);
      expect(RESOLUTION_STRATEGY_INFO.priority).toBeDefined();
      expect(RESOLUTION_STRATEGY_INFO.recency).toBeDefined();
      expect(RESOLUTION_STRATEGY_INFO.consensus).toBeDefined();
      expect(RESOLUTION_STRATEGY_INFO.conservative).toBeDefined();
    });

    it('should have label and description for each strategy', () => {
      for (const strategy of Object.values(RESOLUTION_STRATEGY_INFO)) {
        expect(strategy.label).toBeTruthy();
        expect(strategy.description).toBeTruthy();
        expect(strategy.icon).toBeTruthy();
      }
    });
  });

  describe('PROVIDER_INFO', () => {
    it('should have info for all 6 providers', () => {
      expect(Object.keys(PROVIDER_INFO)).toHaveLength(6);
    });

    it('should have name and description for each provider', () => {
      for (const provider of Object.values(PROVIDER_INFO)) {
        expect(provider.name).toBeTruthy();
        expect(provider.description).toBeTruthy();
      }
    });
  });
});

describe('getNormalizationSettings', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should return defaults when no localStorage', () => {
    const settings = getNormalizationSettings();
    expect(settings).toEqual(DEFAULT_NORMALIZATION_SETTINGS);
  });

  it('should return saved settings from localStorage', () => {
    const savedSettings: NormalizationSettings = {
      ...DEFAULT_NORMALIZATION_SETTINGS,
      mode: 'explicit',
      defaultResolutionStrategy: 'recency',
    };
    localStorageMock.setItem(NORMALIZATION_SETTINGS_KEY, JSON.stringify(savedSettings));

    const settings = getNormalizationSettings();
    expect(settings.mode).toBe('explicit');
    expect(settings.defaultResolutionStrategy).toBe('recency');
  });

  it('should merge saved settings with defaults (handles new fields)', () => {
    // Simulate old settings without advanced.consensusThreshold
    const oldSettings = {
      mode: 'explicit',
      defaultResolutionStrategy: 'priority',
      providerPriority: ['apollo', 'zoominfo'],
      enabledHarmonies: [],
      advanced: {
        normalizeTimeout: 2000,
        continueOnError: false,
        // missing consensusThreshold
      },
    };
    localStorageMock.setItem(NORMALIZATION_SETTINGS_KEY, JSON.stringify(oldSettings));

    const settings = getNormalizationSettings();
    // Should have saved values
    expect(settings.mode).toBe('explicit');
    expect(settings.advanced.normalizeTimeout).toBe(2000);
    expect(settings.advanced.continueOnError).toBe(false);
    // Should have default for missing field
    expect(settings.advanced.consensusThreshold).toBe(0.8);
  });

  it('should return defaults on parse error', () => {
    localStorageMock.setItem(NORMALIZATION_SETTINGS_KEY, 'invalid json {{{');

    const settings = getNormalizationSettings();
    expect(settings).toEqual(DEFAULT_NORMALIZATION_SETTINGS);
  });
});

describe('NormalizationSettings Validation', () => {
  it('mode should be "implicit" or "explicit"', () => {
    const validModes: NormalizationMode[] = ['implicit', 'explicit'];
    expect(validModes).toContain(DEFAULT_NORMALIZATION_SETTINGS.mode);
  });

  it('providerPriority should not have duplicates', () => {
    const providers = DEFAULT_NORMALIZATION_SETTINGS.providerPriority;
    const uniqueProviders = new Set(providers);
    expect(uniqueProviders.size).toBe(providers.length);
  });

  it('normalizeTimeout should be positive', () => {
    expect(DEFAULT_NORMALIZATION_SETTINGS.advanced.normalizeTimeout).toBeGreaterThan(0);
  });

  it('consensusThreshold should be between 0 and 1', () => {
    const threshold = DEFAULT_NORMALIZATION_SETTINGS.advanced.consensusThreshold;
    expect(threshold).toBeGreaterThanOrEqual(0);
    expect(threshold).toBeLessThanOrEqual(1);
  });
});
