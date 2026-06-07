'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { C } from '@/lib/design-tokens';

interface BillingStatus {
  subscription_tier: string;
  subscription_status: string;
  trial_days_remaining: number | null;
  trial_merges_used: number;
  trial_merge_limit: number;
  trial_normalize_writes_used: number;
  trial_normalize_limit: number;
  trial_enrich_credits_used: number;
  trial_enrich_limit: number;
}

/**
 * Trial Widget
 *
 * Compact trial status widget shown in sidebar or dashboard.
 * Only displays for active trial users.
 */
export function TrialWidget() {
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBillingStatus();
  }, []);

  async function fetchBillingStatus() {
    try {
      const res = await fetch('/api/billing/status');
      if (res.ok) {
        setBilling(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch billing status:', error);
    } finally {
      setLoading(false);
    }
  }

  // Don't show widget for non-trial users
  if (loading || !billing) return null;
  if (billing.subscription_tier !== 'trial' || billing.subscription_status !== 'active') {
    return null;
  }

  const daysRemaining = billing.trial_days_remaining !== null
    ? Math.ceil(billing.trial_days_remaining)
    : 0;

  const mergesPercent = (billing.trial_merges_used / billing.trial_merge_limit) * 100;
  const normalizePercent = (billing.trial_normalize_writes_used / billing.trial_normalize_limit) * 100;
  const enrichPercent = (billing.trial_enrich_credits_used / billing.trial_enrich_limit) * 100;

  // Progress bar color based on percentage
  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return C.red;
    if (percentage >= 80) return C.amber;
    return C.indigo;
  };

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        padding: 16,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
          Trial: {daysRemaining} days remaining
        </div>
        <Link
          href="/billing/upgrade"
          style={{
            fontSize: 12,
            color: C.indigo,
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Upgrade
        </Link>
      </div>

      {/* Mini usage bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Merges */}
        <div>
          <div style={{
            fontSize: 11,
            color: C.text3,
            marginBottom: 4,
          }}>
            Merges: {billing.trial_merges_used} / {billing.trial_merge_limit}
          </div>
          <div style={{ height: 4, background: C.border }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, mergesPercent)}%`,
                background: getProgressColor(mergesPercent),
              }}
            />
          </div>
        </div>

        {/* Normalize */}
        <div>
          <div style={{
            fontSize: 11,
            color: C.text3,
            marginBottom: 4,
          }}>
            Normalize: {billing.trial_normalize_writes_used} / {billing.trial_normalize_limit}
          </div>
          <div style={{ height: 4, background: C.border }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, normalizePercent)}%`,
                background: getProgressColor(normalizePercent),
              }}
            />
          </div>
        </div>

        {/* Enrich */}
        <div>
          <div style={{
            fontSize: 11,
            color: C.text3,
            marginBottom: 4,
          }}>
            Enrich: {billing.trial_enrich_credits_used} / {billing.trial_enrich_limit}
          </div>
          <div style={{ height: 4, background: C.border }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, enrichPercent)}%`,
                background: getProgressColor(enrichPercent),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
