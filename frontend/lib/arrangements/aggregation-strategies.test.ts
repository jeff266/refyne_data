import { describe, it, expect } from 'vitest';
import {
  waterfallStrategy,
  maxStrategy,
  minStrategy,
  averageStrategy,
  clusterAverageStrategy,
  type ProviderValue,
} from './aggregation-strategies';

describe('Aggregation Strategies', () => {
  describe('waterfallStrategy', () => {
    it('should return first non-null value in order', () => {
      const providerValues: ProviderValue[] = [
        { provider: 'apollo', value: 'Software', order: 2 },
        { provider: 'zoominfo', value: null, order: 1 },
        { provider: 'clearbit', value: 'Tech', order: 3 },
      ];

      const result = waterfallStrategy(providerValues, {
        currentValue: null,
        policy: 'overwrite',
      });

      expect(result).not.toBeNull();
      expect(result?.source).toBe('apollo');
      expect(result?.value).toBe('Software');
    });

    it('should respect fill_empty policy when field has value', () => {
      const providerValues: ProviderValue[] = [
        { provider: 'apollo', value: 'New Value', order: 1 },
      ];

      const result = waterfallStrategy(providerValues, {
        currentValue: 'Existing Value',
        policy: 'fill_empty',
      });

      expect(result).not.toBeNull();
      expect(result?.source).toBe('existing');
      expect(result?.value).toBe('Existing Value');
    });

    it('should overwrite when policy is overwrite', () => {
      const providerValues: ProviderValue[] = [
        { provider: 'apollo', value: 'New Value', order: 1 },
      ];

      const result = waterfallStrategy(providerValues, {
        currentValue: 'Existing Value',
        policy: 'overwrite',
      });

      expect(result).not.toBeNull();
      expect(result?.source).toBe('apollo');
      expect(result?.value).toBe('New Value');
    });

    it('should return null when all values are null', () => {
      const providerValues: ProviderValue[] = [
        { provider: 'apollo', value: null, order: 1 },
        { provider: 'zoominfo', value: '', order: 2 },
      ];

      const result = waterfallStrategy(providerValues, {
        currentValue: null,
        policy: 'overwrite',
      });

      expect(result).toBeNull();
    });
  });

  describe('maxStrategy', () => {
    it('should return highest numeric value', () => {
      const providerValues: ProviderValue[] = [
        { provider: 'apollo', value: 150, order: 1 },
        { provider: 'zoominfo', value: 200, order: 2 },
        { provider: 'clearbit', value: 175, order: 3 },
      ];

      const result = maxStrategy(providerValues);

      expect(result).not.toBeNull();
      expect(result?.value).toBe(200);
      expect(result?.source).toBe('aggregated');
      expect(result?.metadata?.strategy).toBe('max');
      expect(result?.metadata?.providers).toContain('zoominfo');
    });

    it('should ignore non-numeric values', () => {
      const providerValues: ProviderValue[] = [
        { provider: 'apollo', value: 150, order: 1 },
        { provider: 'zoominfo', value: 'not a number', order: 2 },
        { provider: 'clearbit', value: 175, order: 3 },
      ];

      const result = maxStrategy(providerValues);

      expect(result).not.toBeNull();
      expect(result?.value).toBe(175);
    });

    it('should return null when no numeric values', () => {
      const providerValues: ProviderValue[] = [
        { provider: 'apollo', value: 'text', order: 1 },
        { provider: 'zoominfo', value: null, order: 2 },
      ];

      const result = maxStrategy(providerValues);

      expect(result).toBeNull();
    });
  });

  describe('minStrategy', () => {
    it('should return lowest numeric value', () => {
      const providerValues: ProviderValue[] = [
        { provider: 'apollo', value: 150, order: 1 },
        { provider: 'zoominfo', value: 100, order: 2 },
        { provider: 'clearbit', value: 175, order: 3 },
      ];

      const result = minStrategy(providerValues);

      expect(result).not.toBeNull();
      expect(result?.value).toBe(100);
      expect(result?.source).toBe('aggregated');
      expect(result?.metadata?.providers).toContain('zoominfo');
    });
  });

  describe('averageStrategy', () => {
    it('should return arithmetic mean rounded to integer for numeric type', () => {
      const providerValues: ProviderValue[] = [
        { provider: 'apollo', value: 150, order: 1 },
        { provider: 'zoominfo', value: 200, order: 2 },
        { provider: 'clearbit', value: 160, order: 3 },
      ];

      const result = averageStrategy(providerValues, 'numeric');

      expect(result).not.toBeNull();
      expect(result?.value).toBe(170); // (150 + 200 + 160) / 3 = 170
      expect(result?.source).toBe('aggregated');
    });

    it('should ignore null values', () => {
      const providerValues: ProviderValue[] = [
        { provider: 'apollo', value: 150, order: 1 },
        { provider: 'zoominfo', value: null, order: 2 },
        { provider: 'clearbit', value: 200, order: 3 },
      ];

      const result = averageStrategy(providerValues, 'numeric');

      expect(result).not.toBeNull();
      expect(result?.value).toBe(175); // (150 + 200) / 2 = 175
    });
  });

  describe('clusterAverageStrategy', () => {
    it('should drop outliers and average remaining values', () => {
      // 150, 142, 890 - median is 150, std dev will make 890 an outlier
      const providerValues: ProviderValue[] = [
        { provider: 'apollo', value: 150, order: 1 },
        { provider: 'zoominfo', value: 142, order: 2 },
        { provider: 'clearbit', value: 890, order: 3 },
      ];

      const result = clusterAverageStrategy(providerValues, 'numeric');

      expect(result).not.toBeNull();
      // Should average 150 and 142, dropping 890
      expect(result?.value).toBe(146); // (150 + 142) / 2 = 146
      expect(result?.metadata?.outliers_dropped).toBeDefined();
      expect(result?.metadata?.outliers_dropped?.length).toBe(1);
      expect(result?.metadata?.outliers_dropped?.[0].value).toBe(890);
    });

    it('should fall back to simple average with fewer than 3 values', () => {
      const providerValues: ProviderValue[] = [
        { provider: 'apollo', value: 150, order: 1 },
        { provider: 'zoominfo', value: 200, order: 2 },
      ];

      const result = clusterAverageStrategy(providerValues, 'numeric');

      expect(result).not.toBeNull();
      expect(result?.value).toBe(175); // (150 + 200) / 2 = 175
    });

    it('should fall back to simple average if filtering leaves fewer than 2 values', () => {
      // Edge case where all but one value might be filtered
      const providerValues: ProviderValue[] = [
        { provider: 'apollo', value: 100, order: 1 },
        { provider: 'zoominfo', value: 100, order: 2 },
        { provider: 'clearbit', value: 100, order: 3 },
      ];

      const result = clusterAverageStrategy(providerValues, 'numeric');

      expect(result).not.toBeNull();
      expect(result?.value).toBe(100);
    });
  });
});
