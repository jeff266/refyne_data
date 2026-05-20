/**
 * Aggregation Strategies for Field-First Waterfall
 *
 * Implements different strategies for combining multiple provider values
 * into a single field value for writing to HubSpot.
 */

export interface ProviderValue {
  provider: string;
  value: any;
  order: number;
}

export interface WaterfallOptions {
  currentValue: any; // Current HubSpot field value
  policy: 'fill_empty' | 'overwrite';
}

export interface AggregationResult {
  value: any;
  source: string; // Which provider or 'aggregated'
  metadata?: Record<string, any>; // Extra info for tracking
}

/**
 * Waterfall strategy: Use first non-null value respecting policy
 */
export function waterfallStrategy(
  providerValues: ProviderValue[],
  options: WaterfallOptions
): AggregationResult | null {
  // Sort by order
  const sorted = [...providerValues].sort((a, b) => a.order - b.order);

  for (const pv of sorted) {
    if (pv.value !== null && pv.value !== undefined && pv.value !== '') {
      // Check policy
      if (options.policy === 'fill_empty') {
        // Only use if current value is empty
        const currentIsEmpty =
          options.currentValue === null ||
          options.currentValue === undefined ||
          options.currentValue === '';

        if (!currentIsEmpty) {
          return {
            value: options.currentValue,
            source: 'existing',
            metadata: { reason: 'fill_empty policy: field already has value' },
          };
        }
      }

      // Use this provider's value
      return {
        value: pv.value,
        source: pv.provider,
        metadata: { order: pv.order },
      };
    }
  }

  // No non-null values found
  return null;
}

/**
 * Max strategy: Return highest numeric value
 */
export function maxStrategy(providerValues: ProviderValue[]): AggregationResult | null {
  const numericValues = providerValues
    .filter((pv) => typeof pv.value === 'number' && !isNaN(pv.value))
    .map((pv) => ({ ...pv, value: Number(pv.value) }));

  if (numericValues.length === 0) return null;

  const maxValue = Math.max(...numericValues.map((pv) => pv.value));
  const providers = numericValues
    .filter((pv) => pv.value === maxValue)
    .map((pv) => pv.provider);

  return {
    value: maxValue,
    source: 'aggregated',
    metadata: {
      strategy: 'max',
      providers,
      all_values: numericValues.map((pv) => ({ provider: pv.provider, value: pv.value })),
    },
  };
}

/**
 * Min strategy: Return lowest numeric value
 */
export function minStrategy(providerValues: ProviderValue[]): AggregationResult | null {
  const numericValues = providerValues
    .filter((pv) => typeof pv.value === 'number' && !isNaN(pv.value))
    .map((pv) => ({ ...pv, value: Number(pv.value) }));

  if (numericValues.length === 0) return null;

  const minValue = Math.min(...numericValues.map((pv) => pv.value));
  const providers = numericValues
    .filter((pv) => pv.value === minValue)
    .map((pv) => pv.provider);

  return {
    value: minValue,
    source: 'aggregated',
    metadata: {
      strategy: 'min',
      providers,
      all_values: numericValues.map((pv) => ({ provider: pv.provider, value: pv.value })),
    },
  };
}

/**
 * Average strategy: Return arithmetic mean
 */
export function averageStrategy(
  providerValues: ProviderValue[],
  fieldType: 'numeric' | 'categorical' | 'url' | 'text' | 'boolean'
): AggregationResult | null {
  const numericValues = providerValues
    .filter((pv) => typeof pv.value === 'number' && !isNaN(pv.value))
    .map((pv) => ({ ...pv, value: Number(pv.value) }));

  if (numericValues.length === 0) return null;

  const sum = numericValues.reduce((acc, pv) => acc + pv.value, 0);
  const mean = sum / numericValues.length;

  // Round based on field type
  // Employee count: round to nearest integer
  // Revenue: round to 2 decimal places
  const rounded = fieldType === 'numeric' ? Math.round(mean) : Number(mean.toFixed(2));

  return {
    value: rounded,
    source: 'aggregated',
    metadata: {
      strategy: 'average',
      providers: numericValues.map((pv) => pv.provider),
      all_values: numericValues.map((pv) => ({ provider: pv.provider, value: pv.value })),
      mean_before_rounding: mean,
    },
  };
}

/**
 * Cluster Average strategy: Drop outliers, then average
 */
export function clusterAverageStrategy(
  providerValues: ProviderValue[],
  fieldType: 'numeric' | 'categorical' | 'url' | 'text' | 'boolean'
): AggregationResult | null {
  const numericValues = providerValues
    .filter((pv) => typeof pv.value === 'number' && !isNaN(pv.value))
    .map((pv) => ({ ...pv, value: Number(pv.value) }));

  if (numericValues.length === 0) return null;

  // If only 1-2 values, fall back to simple average (can't drop outliers)
  if (numericValues.length < 3) {
    return averageStrategy(providerValues, fieldType);
  }

  const values = numericValues.map((pv) => pv.value);

  // Calculate median
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  // Calculate standard deviation
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Drop values more than 1 std dev from median
  const filtered = numericValues.filter((pv) => {
    const diff = Math.abs(pv.value - median);
    return diff <= stdDev;
  });

  const droppedOutliers = numericValues
    .filter((pv) => {
      const diff = Math.abs(pv.value - median);
      return diff > stdDev;
    })
    .map((pv) => ({ provider: pv.provider, value: pv.value }));

  // If fewer than 2 values remain after filtering, fall back to simple average
  if (filtered.length < 2) {
    return averageStrategy(providerValues, fieldType);
  }

  // Average the filtered values
  const filteredSum = filtered.reduce((acc, pv) => acc + pv.value, 0);
  const filteredMean = filteredSum / filtered.length;

  // Round based on field type
  const rounded = fieldType === 'numeric' ? Math.round(filteredMean) : Number(filteredMean.toFixed(2));

  return {
    value: rounded,
    source: 'aggregated',
    metadata: {
      strategy: 'cluster_average',
      providers: filtered.map((pv) => pv.provider),
      all_values: numericValues.map((pv) => ({ provider: pv.provider, value: pv.value })),
      outliers_dropped: droppedOutliers,
      median,
      std_dev: stdDev,
      mean_before_rounding: filteredMean,
    },
  };
}
