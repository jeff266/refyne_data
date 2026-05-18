/**
 * Prospecting Credit Limits
 *
 * Enforces per-user and per-role prospecting credit limits.
 */

import { supabase } from '@/lib/db/supabase';

export interface CreditCheck {
  allowed: boolean;
  unlimited?: boolean;
  used?: number;
  limit?: number;
  resetAt?: Date;
}

/**
 * Check if user has prospecting credits available.
 *
 * Checks limits in order of specificity:
 * 1. User-specific limit (user:userId)
 * 2. Role-specific limit (role:org:admin, role:org:operator, role:org:viewer)
 * 3. No limit (unlimited)
 *
 * @param orgId - Organization ID
 * @param userId - User ID
 * @param role - User's role
 * @returns Credit check result
 */
export async function checkProspectingCredits(
  orgId: string,
  userId: string,
  role: string
): Promise<CreditCheck> {
  if (!supabase) {
    return { allowed: true, unlimited: true };
  }

  // Find most specific limit (user > role > none)
  const { data: limits, error: limitError } = await supabase
    .from('prospecting_limits')
    .select('*')
    .eq('org_id', orgId)
    .in('applies_to', [`user:${userId}`, `role:${role}`])
    .order('applies_to', { ascending: false }) // user: comes after role: alphabetically
    .limit(1);

  if (limitError) {
    console.error('Error fetching prospecting limits:', limitError);
    return { allowed: true, unlimited: true }; // Fail open
  }

  // No limit found = unlimited
  if (!limits || limits.length === 0) {
    return { allowed: true, unlimited: true };
  }

  const limit = limits[0];
  const periodStart = getPeriodStart(limit.period);

  // Get usage in current period
  const { data: usage, error: usageError } = await supabase
    .from('prospecting_usage')
    .select('credits_used')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .gte('created_at', periodStart.toISOString());

  if (usageError) {
    console.error('Error fetching prospecting usage:', usageError);
    return { allowed: true, unlimited: true }; // Fail open
  }

  const used = usage?.reduce((sum, row) => sum + row.credits_used, 0) || 0;

  return {
    allowed: used < limit.credits_per_period,
    used,
    limit: limit.credits_per_period,
    resetAt: getPeriodEnd(limit.period),
  };
}

/**
 * Deduct prospecting credit from user's balance.
 *
 * @param orgId - Organization ID
 * @param userId - User ID
 * @param action - Action type (search, enrich_record, csv_row, prospect_push)
 * @param metadata - Optional metadata about the action
 */
export async function deductCredit(
  orgId: string,
  userId: string,
  action: 'search' | 'enrich_record' | 'csv_row' | 'prospect_push',
  metadata?: any
): Promise<void> {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from('prospecting_usage').insert({
    org_id: orgId,
    user_id: userId,
    action,
    credits_used: 1,
    metadata: metadata || null,
  });

  if (error) {
    console.error('Error deducting prospecting credit:', error);
  }
}

/**
 * Get the start of the current period.
 */
function getPeriodStart(period: 'day' | 'week' | 'month'): Date {
  const now = new Date();

  if (period === 'day') {
    now.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    // Start of week (Sunday)
    now.setDate(now.getDate() - now.getDay());
    now.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    // Start of month
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
  }

  return now;
}

/**
 * Get the end of the current period (when credits reset).
 */
function getPeriodEnd(period: 'day' | 'week' | 'month'): Date {
  const start = getPeriodStart(period);

  if (period === 'day') {
    start.setDate(start.getDate() + 1);
  } else if (period === 'week') {
    start.setDate(start.getDate() + 7);
  } else if (period === 'month') {
    start.setMonth(start.getMonth() + 1);
  }

  return start;
}

/**
 * Get usage summary for current period.
 *
 * @param orgId - Organization ID
 * @param userId - User ID
 * @param period - Period to check (defaults to 'month')
 * @returns Usage summary
 */
export async function getUsageSummary(
  orgId: string,
  userId: string,
  period: 'day' | 'week' | 'month' = 'month'
) {
  if (!supabase) {
    return { total: 0, byAction: {} };
  }

  const periodStart = getPeriodStart(period);

  const { data: usage, error } = await supabase
    .from('prospecting_usage')
    .select('action, credits_used')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .gte('created_at', periodStart.toISOString());

  if (error || !usage) {
    return { total: 0, byAction: {} };
  }

  const total = usage.reduce((sum, row) => sum + row.credits_used, 0);
  const byAction = usage.reduce((acc, row) => {
    acc[row.action] = (acc[row.action] || 0) + row.credits_used;
    return acc;
  }, {} as Record<string, number>);

  return { total, byAction };
}
