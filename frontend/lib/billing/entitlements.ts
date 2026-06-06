/**
 * Billing Entitlements
 *
 * Single-query entitlement checking using org_entitlements VIEW.
 * No Redis caching - direct PostgreSQL reads are fast enough (<5ms).
 *
 * Architecture decisions from review:
 * - Use PostgreSQL VIEW for single-query performance
 * - No Redis (adds complexity, stale data risk)
 * - Atomic operations via RPC (no race conditions)
 */

import { supabaseAdmin } from '@/lib/db/admin-client';

export interface OrgEntitlements {
  org_id: string;
  subscription_tier: 'trial' | 'pro' | 'enterprise' | 'internal';
  subscription_status: 'active' | 'past_due' | 'cancelled' | 'paused';

  // Trial limits
  trial_merge_limit: number | null;
  trial_normalize_limit: number | null;
  trial_enrich_limit: number | null;

  // Trial usage
  trial_merges_used: number;
  trial_normalize_writes_used: number;
  trial_enrich_credits_used: number;

  // Trial remaining
  trial_merges_remaining: number | null;
  trial_normalize_remaining: number | null;
  trial_enrich_remaining: number | null;

  // Trial dates
  trial_start_date: string;
  trial_end_date: string;
  trial_days_remaining: number;

  // Paid plan credits
  pro_monthly_enrich_credits: number | null;
  enterprise_monthly_enrich_credits: number | null;

  // Current period usage (last 30 days)
  merges_last_30d: number;
  normalize_writes_last_30d: number;
  enrich_credits_last_30d: number;

  // Period dates
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;

  created_at: string;
  updated_at: string;
}

/**
 * Get entitlements for an organization
 * Single query against org_entitlements VIEW (combines org_billing + usage aggregation)
 *
 * @param orgId - Organization ID
 * @returns Entitlements object or null if org not found
 */
export async function getEntitlements(orgId: string): Promise<OrgEntitlements | null> {
  const { data, error } = await supabaseAdmin
    .from('org_entitlements')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (error) {
    console.error('[Billing] Failed to fetch entitlements:', error);
    return null;
  }

  return data;
}

/**
 * Check if an organization can perform a specific action
 *
 * @param orgId - Organization ID
 * @param action - Action to check: 'merge' | 'normalize_write' | 'enrich_credit'
 * @param quantity - Number of units to consume (default 1)
 * @returns true if allowed, false if limit exceeded or error
 */
export async function canPerformAction(
  orgId: string,
  action: 'merge' | 'normalize_write' | 'enrich_credit',
  quantity: number = 1
): Promise<boolean> {
  const entitlements = await getEntitlements(orgId);

  if (!entitlements) {
    console.error('[Billing] Entitlements not found for org:', orgId);
    return false;
  }

  // Internal orgs bypass all limits
  if (entitlements.subscription_tier === 'internal') {
    return true;
  }

  // Paid tiers: different logic per action
  if (entitlements.subscription_tier === 'pro' || entitlements.subscription_tier === 'enterprise') {
    switch (action) {
      case 'merge':
      case 'normalize_write':
        // Unlimited for paid tiers
        return true;

      case 'enrich_credit':
        // Check monthly allocation (if set)
        const monthlyLimit =
          entitlements.subscription_tier === 'pro'
            ? entitlements.pro_monthly_enrich_credits
            : entitlements.enterprise_monthly_enrich_credits;

        if (monthlyLimit === null) {
          // No limit set - allow
          return true;
        }

        // Check current period usage
        return entitlements.enrich_credits_last_30d + quantity <= monthlyLimit;
    }
  }

  // Trial tier: check limits
  if (entitlements.subscription_tier === 'trial') {
    // Check trial expiration
    if (entitlements.trial_days_remaining <= 0) {
      return false;
    }

    switch (action) {
      case 'merge':
        return (entitlements.trial_merges_remaining ?? 0) >= quantity;

      case 'normalize_write':
        return (entitlements.trial_normalize_remaining ?? 0) >= quantity;

      case 'enrich_credit':
        return (entitlements.trial_enrich_remaining ?? 0) >= quantity;
    }
  }

  // Unknown tier or status
  return false;
}

/**
 * Get user-friendly limit status message
 *
 * @param orgId - Organization ID
 * @param action - Action to check
 * @returns Status message or null if no limits
 */
export async function getLimitStatus(
  orgId: string,
  action: 'merge' | 'normalize_write' | 'enrich_credit'
): Promise<string | null> {
  const entitlements = await getEntitlements(orgId);

  if (!entitlements) {
    return 'Unable to check limits';
  }

  // Internal orgs have no limits
  if (entitlements.subscription_tier === 'internal') {
    return null;
  }

  // Paid tiers
  if (entitlements.subscription_tier === 'pro' || entitlements.subscription_tier === 'enterprise') {
    if (action === 'enrich_credit') {
      const monthlyLimit =
        entitlements.subscription_tier === 'pro'
          ? entitlements.pro_monthly_enrich_credits
          : entitlements.enterprise_monthly_enrich_credits;

      if (monthlyLimit === null) {
        return null; // No limit
      }

      const used = entitlements.enrich_credits_last_30d;
      const remaining = monthlyLimit - used;

      if (remaining <= 0) {
        return `Monthly enrichment limit reached (${monthlyLimit} credits). Resets on period end.`;
      }

      return `${remaining} enrichment credits remaining this period (${used}/${monthlyLimit} used)`;
    }

    // Merges and normalize writes are unlimited
    return null;
  }

  // Trial tier
  if (entitlements.subscription_tier === 'trial') {
    if (entitlements.trial_days_remaining <= 0) {
      return 'Trial expired. Upgrade to continue using Refyne.';
    }

    switch (action) {
      case 'merge':
        const mergesRemaining = entitlements.trial_merges_remaining ?? 0;
        if (mergesRemaining <= 0) {
          return `Trial merge limit reached (${entitlements.trial_merge_limit}). Upgrade to continue.`;
        }
        return `${mergesRemaining} trial merges remaining (${entitlements.trial_merges_used}/${entitlements.trial_merge_limit} used)`;

      case 'normalize_write':
        const normalizesRemaining = entitlements.trial_normalize_remaining ?? 0;
        if (normalizesRemaining <= 0) {
          return `Trial normalization limit reached (${entitlements.trial_normalize_limit}). Upgrade to continue.`;
        }
        return `${normalizesRemaining} trial normalizations remaining (${entitlements.trial_normalize_writes_used}/${entitlements.trial_normalize_limit} used)`;

      case 'enrich_credit':
        const enrichRemaining = entitlements.trial_enrich_remaining ?? 0;
        if (enrichRemaining <= 0) {
          return `Trial enrichment limit reached (${entitlements.trial_enrich_limit}). Upgrade to continue.`;
        }
        return `${enrichRemaining} trial enrichment credits remaining (${entitlements.trial_enrich_credits_used}/${entitlements.trial_enrich_limit} used)`;
    }
  }

  return 'Unknown subscription status';
}
