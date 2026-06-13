'use client';

import { useEffect, useState } from 'react';

interface ClientEntitlements {
  subscription_tier: 'trial' | 'starter' | 'growth' | 'scale' | 'internal' | 'exempt';
  subscription_status: 'active' | 'past_due' | 'cancelled' | 'paused';
  trial_days_remaining: number | null;
  loading: boolean;
}

/**
 * Client-side hook to access billing entitlements
 * Automatically fetches from /api/billing/status
 *
 * Usage:
 * ```tsx
 * const { tier, status, loading } = useEntitlements();
 *
 * // Don't show upgrade prompts for exempt/internal orgs
 * if (tier === 'exempt' || tier === 'internal') {
 *   return <Button>Merge</Button>;
 * }
 *
 * // Show upgrade link for trial orgs
 * if (tier === 'trial') {
 *   return (
 *     <div>
 *       <Button disabled>Merge</Button>
 *       <UpgradeLink reason="merge records" targetPlan="Growth" />
 *     </div>
 *   );
 * }
 * ```
 */
export function useEntitlements(): ClientEntitlements {
  const [entitlements, setEntitlements] = useState<ClientEntitlements>({
    subscription_tier: 'trial',
    subscription_status: 'active',
    trial_days_remaining: null,
    loading: true,
  });

  useEffect(() => {
    fetch('/api/billing/status')
      .then((res) => res.json())
      .then((data) => {
        setEntitlements({
          subscription_tier: data.tier || 'trial',
          subscription_status: data.status || 'active',
          trial_days_remaining: data.daysRemaining ?? null,
          loading: false,
        });
      })
      .catch((err) => {
        console.error('[useEntitlements] Failed to fetch:', err);
        setEntitlements((prev) => ({ ...prev, loading: false }));
      });
  }, []);

  return entitlements;
}

/**
 * Helper to check if upgrade prompts should be shown
 * @param tier - Subscription tier from useEntitlements
 * @returns true if upgrade prompts should be shown
 */
export function shouldShowUpgradePrompts(
  tier: ClientEntitlements['subscription_tier']
): boolean {
  return tier !== 'exempt' && tier !== 'internal';
}
