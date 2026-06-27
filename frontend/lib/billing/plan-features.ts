/**
 * Plan Features Configuration
 *
 * Defines entitlements and limits for each pricing plan.
 */

export type Plan =
  | 'trialing'
  | 'trial_expired'
  | 'prospect_solo'
  | 'prospect_team'
  | 'starter'
  | 'growth'
  | 'scale'
  | 'enterprise';

export interface PlanFeatures {
  normalize: boolean;
  dedup: boolean;
  compliance: boolean;
  prospect: boolean;
  enrich_byok: boolean;
  enrich_credits: number; // Serper + GraphIQ credits per month
  always_on: boolean; // included in plan (not add-on)
  always_on_addon: boolean; // available as add-on
  max_portals: number;
  max_operators: number; // total non-viewer seats
  max_admins: number;
  max_records: number; // HubSpot record count limit
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  trialing: {
    normalize: true,
    dedup: true, // up to 500 pairs reviewed
    compliance: true,
    prospect: true,
    enrich_byok: true,
    enrich_credits: 50,
    always_on: true, // one digest during trial
    always_on_addon: false,
    max_portals: 1,
    max_operators: 3,
    max_admins: 1,
    max_records: 25_000, // trial uses starter limits
  },
  trial_expired: {
    normalize: false,
    dedup: false,
    compliance: true, // score stays visible — the hook
    prospect: false,
    enrich_byok: false,
    enrich_credits: 0,
    always_on: false,
    always_on_addon: false,
    max_portals: 1,
    max_operators: 0,
    max_admins: 1,
    max_records: 0, // read-only after trial expiration
  },
  prospect_solo: {
    normalize: false,
    dedup: false,
    compliance: false,
    prospect: true,
    enrich_byok: true,
    enrich_credits: 50,
    always_on: false,
    always_on_addon: false,
    max_portals: 1,
    max_operators: 1,
    max_admins: 1,
    max_records: Infinity, // prospect plans not record-limited
  },
  prospect_team: {
    normalize: false,
    dedup: false,
    compliance: false,
    prospect: true,
    enrich_byok: true,
    enrich_credits: 200,
    always_on: false,
    always_on_addon: false,
    max_portals: 1,
    max_operators: 5,
    max_admins: 2,
    max_records: Infinity, // prospect plans not record-limited
  },
  starter: {
    normalize: true,
    dedup: true,
    compliance: true,
    prospect: true,
    enrich_byok: true,
    enrich_credits: 100,
    always_on: false,
    always_on_addon: true, // available at +$79/mo
    max_portals: 1,
    max_operators: 3,
    max_admins: 1,
    max_records: 25_000, // up to 25,000 records
  },
  growth: {
    normalize: true,
    dedup: true,
    compliance: true,
    prospect: true,
    enrich_byok: true,
    enrich_credits: 500,
    always_on: false,
    always_on_addon: true,
    max_portals: 3,
    max_operators: 10,
    max_admins: 2,
    max_records: 75_000, // up to 75,000 records
  },
  scale: {
    normalize: true,
    dedup: true,
    compliance: true,
    prospect: true,
    enrich_byok: true,
    enrich_credits: 2000,
    always_on: true, // included
    always_on_addon: false,
    max_portals: 10,
    max_operators: 9999,
    max_admins: 5,
    max_records: 200_000, // up to 200,000 records
  },
  enterprise: {
    normalize: true,
    dedup: true,
    compliance: true,
    prospect: true,
    enrich_byok: true,
    enrich_credits: 9999,
    always_on: true,
    always_on_addon: false,
    max_portals: 9999,
    max_operators: 9999,
    max_admins: 9999,
    max_records: Infinity, // 200,000+ records, no enforced limit
  },
};

export function getPlanFeatures(plan: Plan, alwaysOnAddon: boolean): PlanFeatures {
  const features = PLAN_FEATURES[plan];
  return {
    ...features,
    always_on: features.always_on || (features.always_on_addon && alwaysOnAddon),
  };
}

export function canAccess(
  plan: Plan,
  alwaysOnAddon: boolean,
  feature: keyof PlanFeatures
): boolean {
  const features = getPlanFeatures(plan, alwaysOnAddon);
  const value = features[feature];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  return false;
}

/**
 * Get the next plan with more seats.
 * Used for upgrade suggestions when seat limit is reached.
 */
export function getNextPlanWithMoreSeats(currentPlan: Plan): Plan | null {
  const upgradePath: Record<Plan, Plan | null> = {
    trialing: 'starter',
    trial_expired: 'starter',
    prospect_solo: 'prospect_team',
    prospect_team: 'growth',
    starter: 'growth',
    growth: 'scale',
    scale: 'enterprise',
    enterprise: null,
  };
  return upgradePath[currentPlan];
}

/**
 * Get plan pricing information.
 */
export interface PlanPricing {
  monthlyPrice: number | null;
  annualPrice: number | null;
  name: string;
  description: string;
}

export const PLAN_PRICING: Record<Exclude<Plan, 'trialing' | 'trial_expired'>, PlanPricing> = {
  prospect_solo: {
    monthlyPrice: 49,
    annualPrice: null,
    name: 'Prospect Solo',
    description: 'Individual prospecting toolkit',
  },
  prospect_team: {
    monthlyPrice: 99,
    annualPrice: null,
    name: 'Prospect Team',
    description: 'Team prospecting with more credits',
  },
  starter: {
    monthlyPrice: 149,
    annualPrice: 119,
    name: 'Starter',
    description: 'Full CRM data hygiene suite',
  },
  growth: {
    monthlyPrice: 249,
    annualPrice: 199,
    name: 'Growth',
    description: 'Expanded capacity and seats',
  },
  scale: {
    monthlyPrice: 399,
    annualPrice: 319,
    name: 'Scale',
    description: 'Enterprise features included',
  },
  enterprise: {
    monthlyPrice: null,
    annualPrice: null,
    name: 'Enterprise',
    description: 'Custom limits and pricing',
  },
};

// IMPORTANT: Stripe price objects must be updated in the Stripe dashboard
// to match these amounts. Stripe does not allow editing existing price objects --
// archive old prices and create new ones for $149, $249, $399. Update
// STRIPE_PRICE_ID_STARTER, STRIPE_PRICE_ID_GROWTH, STRIPE_PRICE_ID_SCALE
// env vars after creating new prices.

/**
 * Get record limit for a plan.
 *
 * @param plan - Plan to get limit for
 * @returns Maximum HubSpot record count allowed for this plan
 *
 * @example
 * getRecordLimit('starter') // 25_000
 * getRecordLimit('enterprise') // Infinity
 *
 * TODO: Wire this to enforcement logic. Currently defined but not enforced.
 * Enforcement will require:
 * 1. Fetching HubSpot record count from connections table or live API
 * 2. Comparing against this limit during onboarding/upgrade flows
 * 3. Blocking new connections if record count exceeds plan limit
 */
export function getRecordLimit(plan: Plan): number {
  return PLAN_FEATURES[plan].max_records;
}
