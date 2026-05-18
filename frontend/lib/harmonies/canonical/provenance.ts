import { z } from 'zod';

/**
 * Resolution strategies for when multiple providers return the same field.
 * - priority: Use ordered provider list, first non-null wins
 * - recency: Most recently retrieved value wins
 * - consensus: Most common value wins (requires similarity threshold)
 * - conservative: Safest/lowest value wins (e.g., for revenue estimates)
 */
export const ResolutionStrategySchema = z.enum([
  'priority',
  'recency',
  'consensus',
  'conservative',
]);
export type ResolutionStrategy = z.infer<typeof ResolutionStrategySchema>;

/**
 * A candidate value from a single provider, before resolution.
 */
export const CandidateValueSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    provider: z.string(),
    value: valueSchema,
    retrieved_at: z.string().datetime(),
    raw_value: z.unknown().optional(), // Original value before any transformation
  });

export type CandidateValue<T> = {
  provider: string;
  value: T;
  retrieved_at: string;
  raw_value?: unknown;
};

/**
 * A resolved field with full provenance tracking.
 * This is the core data structure for the Harmonies engine.
 *
 * Every normalized field is wrapped in this structure so we can:
 * - Know which provider the winning value came from
 * - See all candidate values that were considered
 * - Trace which Harmony transformed the value
 * - Understand why this value was chosen (resolution strategy)
 */
export const ResolvedFieldSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    // The winning value after resolution
    value: valueSchema,

    // Which provider this value came from
    source: z.string(),

    // When the source provider returned this value
    retrieved_at: z.string().datetime(),

    // Which Harmony transformed this value (format: "harmony-id@version")
    // null if value is raw/untransformed
    harmony: z.string().nullable(),

    // How this value was chosen from candidates
    strategy: ResolutionStrategySchema,

    // All values that were considered, including the winner
    candidates: z.array(CandidateValueSchema(valueSchema)),

    // Optional confidence score (0-1) for v2
    confidence: z.number().min(0).max(1).optional(),
  });

export type ResolvedField<T> = {
  value: T;
  source: string;
  retrieved_at: string;
  harmony: string | null;
  strategy: ResolutionStrategy;
  candidates: CandidateValue<T>[];
  confidence?: number;
};

/**
 * Create a ResolvedField from a single provider value (no resolution needed yet).
 * Used when we have data from only one provider.
 */
export function createResolvedField<T>(
  value: T,
  provider: string,
  retrievedAt: Date | string = new Date(),
  options: {
    harmony?: string;
    rawValue?: unknown;
    confidence?: number;
  } = {}
): ResolvedField<T> {
  const timestamp = typeof retrievedAt === 'string'
    ? retrievedAt
    : retrievedAt.toISOString();

  return {
    value,
    source: provider,
    retrieved_at: timestamp,
    harmony: options.harmony ?? null,
    strategy: 'priority', // Default when only one candidate
    candidates: [
      {
        provider,
        value,
        retrieved_at: timestamp,
        raw_value: options.rawValue,
      },
    ],
    confidence: options.confidence,
  };
}

/**
 * Mark a ResolvedField as having been transformed by a Harmony.
 * Returns a new ResolvedField with updated harmony reference.
 */
export function markTransformed<T>(
  field: ResolvedField<T>,
  harmonyId: string,
  harmonyVersion: string,
  newValue: T
): ResolvedField<T> {
  return {
    ...field,
    value: newValue,
    harmony: `${harmonyId}@${harmonyVersion}`,
  };
}

/**
 * Merge multiple candidate values and resolve to a winner.
 * This is the core resolution logic used by the pipeline.
 */
export function resolveField<T>(
  candidates: CandidateValue<T>[],
  strategy: ResolutionStrategy,
  options: {
    priorityOrder?: string[]; // For 'priority' strategy
    similarityThreshold?: number; // For 'consensus' strategy
  } = {}
): ResolvedField<T> | null {
  if (candidates.length === 0) {
    return null;
  }

  // Filter out null/undefined values
  const validCandidates = candidates.filter(
    (c) => c.value !== null && c.value !== undefined
  );

  if (validCandidates.length === 0) {
    return null;
  }

  let winner: CandidateValue<T>;

  switch (strategy) {
    case 'priority': {
      const order = options.priorityOrder ?? [];
      // Sort by priority order, unknown providers go last
      const sorted = [...validCandidates].sort((a, b) => {
        const aIdx = order.indexOf(a.provider);
        const bIdx = order.indexOf(b.provider);
        const aOrder = aIdx === -1 ? Infinity : aIdx;
        const bOrder = bIdx === -1 ? Infinity : bIdx;
        return aOrder - bOrder;
      });
      winner = sorted[0];
      break;
    }

    case 'recency': {
      // Most recent timestamp wins
      const sorted = [...validCandidates].sort(
        (a, b) => new Date(b.retrieved_at).getTime() - new Date(a.retrieved_at).getTime()
      );
      winner = sorted[0];
      break;
    }

    case 'consensus': {
      // Most common value wins
      // Note: This is a simple equality check. For fuzzy matching,
      // we'd need a similarity function passed in.
      const valueCounts = new Map<string, { count: number; candidate: CandidateValue<T> }>();

      for (const candidate of validCandidates) {
        const key = JSON.stringify(candidate.value);
        const existing = valueCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          valueCounts.set(key, { count: 1, candidate });
        }
      }

      let maxCount = 0;
      let maxCandidate = validCandidates[0];

      for (const entry of Array.from(valueCounts.values())) {
        if (entry.count > maxCount) {
          maxCount = entry.count;
          maxCandidate = entry.candidate;
        }
      }

      winner = maxCandidate;
      break;
    }

    case 'conservative': {
      // For numbers: lowest value wins (safer for estimates)
      // For strings: shortest value wins (less likely to have extra data)
      // For others: first valid value
      const firstValue = validCandidates[0].value;

      if (typeof firstValue === 'number') {
        const sorted = [...validCandidates].sort(
          (a, b) => (a.value as number) - (b.value as number)
        );
        winner = sorted[0];
      } else if (typeof firstValue === 'string') {
        const sorted = [...validCandidates].sort(
          (a, b) => (a.value as string).length - (b.value as string).length
        );
        winner = sorted[0];
      } else {
        winner = validCandidates[0];
      }
      break;
    }

    default:
      winner = validCandidates[0];
  }

  return {
    value: winner.value,
    source: winner.provider,
    retrieved_at: winner.retrieved_at,
    harmony: null,
    strategy,
    candidates,
  };
}

/**
 * Type helper to extract the value type from a ResolvedField.
 */
export type UnwrapResolved<T> = T extends ResolvedField<infer U> ? U : never;

/**
 * Unwrap a ResolvedField to get just the value.
 * Useful when you need the raw value without provenance.
 */
export function unwrap<T>(field: ResolvedField<T> | null | undefined): T | null {
  return field?.value ?? null;
}
