/**
 * Get Org Plan
 *
 * Returns the effective billing plan for an organization, respecting
 * plan_override first, then subscription_tier from org_billing.
 */

import { supabaseAdmin } from '@/lib/db/admin-client';

export type Plan = 'trial' | 'starter' | 'growth' | 'scale' | 'internal' | 'exempt';

/**
 * Get the effective plan for an organization.
 * Respects plan_override first, then falls back to subscription_tier.
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

  // plan_override takes precedence
  if (data.plan_override) {
    return data.plan_override as Plan;
  }

  // Fall back to subscription_tier
  return data.subscription_tier as Plan;
}
