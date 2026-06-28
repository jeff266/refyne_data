/**
 * Get Org Plan
 *
 * Returns the effective billing plan for an organization, respecting
 * plan_override first, then subscription_tier from org_billing.
 */

import { supabaseAdmin } from '@/lib/db/admin-client';
import type { Plan } from './plan-features';

/**
 * Get the effective plan for an organization.
 * Respects plan_override first, then falls back to subscription_tier.
 *
 * Maps database values to Plan type:
 * - 'trial' -> 'trialing'
 * - 'internal' | 'exempt' -> 'enterprise' (no limits)
 *
 * @param orgId - Organization ID
 * @returns Plan tier or null if org not found
 */
export async function getOrgPlan(orgId: string): Promise<Plan | null> {
  const { data, error } = await supabaseAdmin
    .from('org_billing')
    .select('plan_override, subscription_tier')
    .eq('org_id', orgId)
    .single();

  if (error) {
    console.error('[GetOrgPlan] Failed to fetch org billing:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  // Get effective plan (plan_override takes precedence)
  const effectivePlan = data.plan_override || data.subscription_tier;

  // Map database values to Plan type
  switch (effectivePlan) {
    case 'trial':
      return 'trialing';
    case 'internal':
    case 'exempt':
      return 'enterprise'; // Exempt orgs get enterprise limits (unlimited)
    default:
      return effectivePlan as Plan;
  }
}
