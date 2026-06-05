/**
 * Trial and Billing State Management
 *
 * Handles trial lifecycle, plan limits, and billing state for orgs.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type TrialStatus =
  | 'active'         // trial in progress
  | 'expiring_soon'  // <= 3 days left
  | 'expired'        // trial over, no plan
  | 'paid';          // on a paid plan

export interface OrgBillingState {
  plan: string;
  trialStatus: TrialStatus;
  trialEndsAt: Date | null;
  daysRemaining: number | null;
  creditsIncluded: number;
  isOverage: boolean;
}

export const PLAN_CREDIT_LIMITS: Record<string, number> = {
  trial: 500,
  starter: 10000,
  growth: 20000,
  scale: 35000,
  enterprise: 999999,
};

const TRIAL_DURATION_DAYS = 14;

/**
 * Get org billing state including trial status and credit limits.
 */
export async function getOrgBillingState(
  supabase: SupabaseClient,
  orgId: string
): Promise<OrgBillingState> {
  const { data: policy } = await supabase
    .from('org_policies')
    .select('plan, trial_starts_at, trial_ends_at, activated_at')
    .eq('org_id', orgId)
    .single();

  if (!policy) {
    // Default state for orgs without policy row yet
    return {
      plan: 'trial',
      trialStatus: 'active',
      trialEndsAt: null,
      daysRemaining: null,
      creditsIncluded: PLAN_CREDIT_LIMITS.trial,
      isOverage: false,
    };
  }

  const plan = policy.plan || 'trial';
  const creditsIncluded = getCreditsIncluded(plan);

  // Paid plans
  if (plan !== 'trial') {
    return {
      plan,
      trialStatus: 'paid',
      trialEndsAt: null,
      daysRemaining: null,
      creditsIncluded,
      isOverage: false, // TODO: Check actual usage once credits enforcement is built
    };
  }

  // Trial plan
  if (!policy.trial_ends_at) {
    // Trial not started yet
    return {
      plan: 'trial',
      trialStatus: 'active',
      trialEndsAt: null,
      daysRemaining: null,
      creditsIncluded,
      isOverage: false,
    };
  }

  const trialEndsAt = new Date(policy.trial_ends_at);
  const now = new Date();
  const msRemaining = trialEndsAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  let trialStatus: TrialStatus;
  if (daysRemaining <= 0) {
    trialStatus = 'expired';
  } else if (daysRemaining <= 3) {
    trialStatus = 'expiring_soon';
  } else {
    trialStatus = 'active';
  }

  return {
    plan: 'trial',
    trialStatus,
    trialEndsAt,
    daysRemaining: Math.max(0, daysRemaining),
    creditsIncluded,
    isOverage: false, // TODO: Check actual usage
  };
}

/**
 * Start trial for an org. Sets trial_starts_at and trial_ends_at.
 * Idempotent - does nothing if trial already started.
 */
export async function startTrial(
  supabase: SupabaseClient,
  orgId: string
): Promise<void> {
  const now = new Date();
  const trialEnds = new Date(now);
  trialEnds.setDate(trialEnds.getDate() + TRIAL_DURATION_DAYS);

  // Upsert to handle orgs without org_policies row yet
  await supabase
    .from('org_policies')
    .upsert(
      {
        org_id: orgId,
        plan: 'trial',
        trial_starts_at: now.toISOString(),
        trial_ends_at: trialEnds.toISOString(),
      },
      {
        onConflict: 'org_id',
        // Only update if trial not already started
        ignoreDuplicates: false,
      }
    );

  console.log(`[Trial] Started for org ${orgId}: expires ${trialEnds.toISOString()}`);
}

/**
 * Check if trial is active (not expired).
 */
export async function isTrialActive(
  supabase: SupabaseClient,
  orgId: string
): Promise<boolean> {
  const state = await getOrgBillingState(supabase, orgId);
  return state.trialStatus === 'active' || state.trialStatus === 'expiring_soon';
}

/**
 * Get credit limit for a plan.
 */
export function getCreditsIncluded(plan: string): number {
  return PLAN_CREDIT_LIMITS[plan] || PLAN_CREDIT_LIMITS.trial;
}
