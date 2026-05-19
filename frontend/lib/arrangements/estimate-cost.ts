/**
 * Cost Estimation for Arrangements
 *
 * Estimates credit cost for arrangement runs based on provider pricing.
 */

/**
 * Credit cost per field per provider.
 * Based on typical enrichment provider pricing.
 */
const PROVIDER_FIELD_COSTS: Record<string, Record<string, number>> = {
  apollo: {
    domain: 1,
    employee_count: 1,
    industry: 1,
    founded_year: 1,
    revenue: 2,
    phone: 2,
    technologies: 3,
    funding_stage: 2,
    linkedin_url: 1,
    location: 1,
  },
  zoominfo: {
    domain: 2,
    employee_count: 2,
    industry: 2,
    revenue: 3,
    phone: 3,
    technologies: 4,
    linkedin_url: 2,
    location: 2,
  },
  clearbit: {
    domain: 1,
    employee_count: 1,
    industry: 1,
    revenue: 2,
    technologies: 3,
    linkedin_url: 1,
    location: 1,
  },
  // Default costs for unknown providers
  default: {
    domain: 1,
    employee_count: 1,
    industry: 1,
    revenue: 2,
    phone: 2,
    technologies: 3,
    linkedin_url: 1,
    location: 1,
  },
};

/**
 * Base cost per provider call (overhead).
 */
const PROVIDER_BASE_COST = 1;

export interface EnrichmentStep {
  provider: string;
  fields: string[];
  order: number;
}

export interface CostEstimate {
  total_credits: number;
  per_record_credits: number;
  breakdown: Array<{
    provider: string;
    fields: string[];
    credits_per_record: number;
    total_credits: number;
  }>;
}

/**
 * Estimate the cost of running an arrangement.
 *
 * @param steps - Array of enrichment steps
 * @param recordCount - Number of records to process
 * @returns Cost estimate breakdown
 */
export function estimateRunCost(
  steps: EnrichmentStep[],
  recordCount: number
): CostEstimate {
  const breakdown: CostEstimate['breakdown'] = [];
  let totalPerRecord = 0;

  for (const step of steps) {
    const providerCosts = PROVIDER_FIELD_COSTS[step.provider] || PROVIDER_FIELD_COSTS.default;

    // Calculate cost for this step
    let stepCost = PROVIDER_BASE_COST; // Base cost per API call

    for (const field of step.fields) {
      const fieldCost = providerCosts[field] || providerCosts.domain || 1;
      stepCost += fieldCost;
    }

    totalPerRecord += stepCost;

    breakdown.push({
      provider: step.provider,
      fields: step.fields,
      credits_per_record: stepCost,
      total_credits: stepCost * recordCount,
    });
  }

  return {
    total_credits: totalPerRecord * recordCount,
    per_record_credits: totalPerRecord,
    breakdown,
  };
}

/**
 * Get the credit cost for a single field from a provider.
 *
 * @param provider - Provider name
 * @param field - Field name
 * @returns Credit cost
 */
export function getFieldCost(provider: string, field: string): number {
  const providerCosts = PROVIDER_FIELD_COSTS[provider] || PROVIDER_FIELD_COSTS.default;
  return providerCosts[field] || 1;
}

/**
 * Check if user has sufficient credits for a run.
 *
 * @param availableCredits - User's available credits
 * @param estimatedCost - Estimated cost of the run
 * @returns True if user has sufficient credits
 */
export function hasSufficientCredits(
  availableCredits: number,
  estimatedCost: number
): boolean {
  return availableCredits >= estimatedCost;
}

/**
 * Format credits as a readable string.
 *
 * @param credits - Number of credits
 * @returns Formatted string (e.g., "1,234 credits")
 */
export function formatCredits(credits: number): string {
  return `${credits.toLocaleString()} credit${credits === 1 ? '' : 's'}`;
}
