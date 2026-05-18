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
