/**
 * Billing Enforcement
 *
 * Atomic counter consumption and usage tracking.
 * Uses PostgreSQL RPC functions to prevent race conditions.
 *
 * Architecture decisions from review:
 * - Atomic increment via increment_trial_counter() RPC
 * - Weekly partitioned usage tracking
 * - No Redis (simplicity + correctness)
 */

import { supabaseAdmin } from '@/lib/db/admin-client';
import { getEntitlements, canPerformAction } from './entitlements';

export type BillingAction = 'merge' | 'normalize_write' | 'enrich_credit';

export interface ConsumeResult {
  allowed: boolean;
  reason?: string;
  remaining?: number;
}

/**
 * Consume usage for a billing action
 *
 * For trial orgs: Atomically increments counter via RPC
 * For paid orgs: Records usage in org_usage table
 * For internal orgs: Records usage but no enforcement
 *
 * @param orgId - Organization ID
 * @param action - Action being performed
 * @param quantity - Number of units to consume (default 1)
 * @returns Result indicating if action was allowed
 */
export async function consumeUsage(
  orgId: string,
  action: BillingAction,
  quantity: number = 1
): Promise<ConsumeResult> {
  // Check if action is allowed before consuming
  const allowed = await canPerformAction(orgId, action, quantity);

  if (!allowed) {
    const entitlements = await getEntitlements(orgId);

    if (!entitlements) {
      return {
        allowed: false,
        reason: 'Unable to verify subscription',
      };
    }

    // Trial expired
    if (entitlements.subscription_tier === 'trial' && entitlements.trial_days_remaining <= 0) {
      return {
        allowed: false,
        reason: 'Trial expired',
      };
    }

    // Trial limit exceeded
    if (entitlements.subscription_tier === 'trial') {
      const remaining = getRemainingForAction(entitlements, action);
      return {
        allowed: false,
        reason: 'Trial limit exceeded',
        remaining: Math.max(0, remaining),
      };
    }

    // Paid tier monthly limit exceeded (enrich credits only)
    if (action === 'enrich_credit') {
      return {
        allowed: false,
        reason: 'Monthly credit limit exceeded',
        remaining: 0,
      };
    }

    return {
      allowed: false,
      reason: 'Unknown billing issue',
    };
  }

  // Action is allowed - consume usage
  const entitlements = await getEntitlements(orgId);

  if (!entitlements) {
    return {
      allowed: false,
      reason: 'Unable to verify subscription',
    };
  }

  // For trial orgs: Atomic counter increment via RPC
  if (entitlements.subscription_tier === 'trial') {
    const counterName = getCounterName(action);
    const { data, error } = await supabaseAdmin.rpc('increment_trial_counter', {
      p_org_id: orgId,
      p_counter_name: counterName,
      p_increment: quantity,
    });

    if (error) {
      console.error('[Billing] Failed to increment trial counter:', error);
      return {
        allowed: false,
        reason: 'Database error',
      };
    }

    // RPC returns boolean: true if increment succeeded, false if limit exceeded
    if (!data) {
      const remaining = getRemainingForAction(entitlements, action);
      return {
        allowed: false,
        reason: 'Trial limit exceeded',
        remaining: Math.max(0, remaining),
      };
    }

    const newRemaining = getRemainingForAction(entitlements, action) - quantity;
    return {
      allowed: true,
      remaining: Math.max(0, newRemaining),
    };
  }

  // For paid/internal orgs: Record usage in org_usage table
  // (No enforcement for paid tiers except enrich credits)
  await recordUsage(orgId, action, quantity);

  return {
    allowed: true,
  };
}

/**
 * Record usage in org_usage table (for paid/internal orgs)
 * Uses INSERT ... ON CONFLICT to handle concurrent writes
 *
 * @param orgId - Organization ID
 * @param action - Action performed
 * @param quantity - Number of units consumed
 */
async function recordUsage(
  orgId: string,
  action: BillingAction,
  quantity: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart(new Date());

  const columnName = getUsageColumnName(action);

  // Upsert daily usage
  const { error } = await supabaseAdmin.rpc('upsert_daily_usage', {
    p_org_id: orgId,
    p_date: today,
    p_week_start: weekStart,
    p_column_name: columnName,
    p_increment: quantity,
  });

  if (error) {
    console.error('[Billing] Failed to record usage:', error);
  }
}

/**
 * Get week start date (Monday) for a given date
 */
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when Sunday
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

/**
 * Map billing action to trial counter name
 */
function getCounterName(action: BillingAction): string {
  switch (action) {
    case 'merge':
      return 'merges';
    case 'normalize_write':
      return 'normalize_writes';
    case 'enrich_credit':
      return 'enrich_credits';
  }
}

/**
 * Map billing action to org_usage column name
 */
function getUsageColumnName(action: BillingAction): string {
  switch (action) {
    case 'merge':
      return 'merges_executed';
    case 'normalize_write':
      return 'normalize_writes';
    case 'enrich_credit':
      return 'enrich_credits_consumed';
  }
}

/**
 * Get remaining units for a trial action
 */
function getRemainingForAction(
  entitlements: any,
  action: BillingAction
): number {
  switch (action) {
    case 'merge':
      return entitlements.trial_merges_remaining ?? 0;
    case 'normalize_write':
      return entitlements.trial_normalize_remaining ?? 0;
    case 'enrich_credit':
      return entitlements.trial_enrich_remaining ?? 0;
  }
}

/**
 * Check if org can perform action (non-consuming check)
 * Use this for UI state (e.g., disable button)
 *
 * @param orgId - Organization ID
 * @param action - Action to check
 * @param quantity - Number of units needed
 * @returns true if action is allowed
 */
export async function checkBillingLimit(
  orgId: string,
  action: BillingAction,
  quantity: number = 1
): Promise<boolean> {
  return canPerformAction(orgId, action, quantity);
}

/**
 * Get usage summary for an organization
 *
 * @param orgId - Organization ID
 * @returns Usage summary object
 */
export async function getUsageSummary(orgId: string): Promise<{
  tier: string;
  status: string;
  merges: { used: number; limit: number | null; remaining: number | null };
  normalizations: { used: number; limit: number | null; remaining: number | null };
  enrichments: { used: number; limit: number | null; remaining: number | null };
  trial_days_remaining?: number;
  period_end?: string;
} | null> {
  const entitlements = await getEntitlements(orgId);

  if (!entitlements) {
    return null;
  }

  if (entitlements.subscription_tier === 'trial') {
    return {
      tier: 'trial',
      status: entitlements.subscription_status,
      merges: {
        used: entitlements.trial_merges_used,
        limit: entitlements.trial_merge_limit,
        remaining: entitlements.trial_merges_remaining,
      },
      normalizations: {
        used: entitlements.trial_normalize_writes_used,
        limit: entitlements.trial_normalize_limit,
        remaining: entitlements.trial_normalize_remaining,
      },
      enrichments: {
        used: entitlements.trial_enrich_credits_used,
        limit: entitlements.trial_enrich_limit,
        remaining: entitlements.trial_enrich_remaining,
      },
      trial_days_remaining: entitlements.trial_days_remaining,
    };
  }

  // Paid/internal tier
  const enrichLimit =
    entitlements.subscription_tier === 'pro'
      ? entitlements.pro_monthly_enrich_credits
      : entitlements.enterprise_monthly_enrich_credits;

  return {
    tier: entitlements.subscription_tier,
    status: entitlements.subscription_status,
    merges: {
      used: entitlements.merges_last_30d,
      limit: null, // Unlimited for paid
      remaining: null,
    },
    normalizations: {
      used: entitlements.normalize_writes_last_30d,
      limit: null, // Unlimited for paid
      remaining: null,
    },
    enrichments: {
      used: entitlements.enrich_credits_last_30d,
      limit: enrichLimit,
      remaining: enrichLimit ? enrichLimit - entitlements.enrich_credits_last_30d : null,
    },
    period_end: entitlements.current_period_end ?? undefined,
  };
}
