'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { C, F } from '@/lib/design-tokens';

export function TrialBanner() {
  const [bannerState, setBannerState] = useState<{
    show: boolean;
    type: 'trial' | 'trial_expired' | 'past_due' | null;
    daysRemaining: number | null;
  }>({
    show: false,
    type: null,
    daysRemaining: null,
  });

  useEffect(() => {
    async function checkTrialStatus() {
      try {
        const res = await fetch('/api/billing/status');
        if (!res.ok) return;

        const data = await res.json();
        const status = data.subscription_status;
        const tier = data.subscription_tier;
        const daysRemaining = data.trial_days_remaining !== null
          ? Math.floor(data.trial_days_remaining)
          : null;

        if (status === 'past_due') {
          setBannerState({ show: true, type: 'past_due', daysRemaining: null });
        } else if (tier === 'trial' && daysRemaining !== null && daysRemaining <= 0) {
          setBannerState({ show: true, type: 'trial_expired', daysRemaining: null });
        } else if (tier === 'trial' && daysRemaining !== null && daysRemaining <= 7) {
          setBannerState({ show: true, type: 'trial', daysRemaining });
        }
      } catch {
        // silent - banner is non-critical
      }
    }

    checkTrialStatus();
  }, []);

  if (!bannerState.show || !bannerState.type) {
    return null;
  }

  const getBannerStyle = () => {
    if (bannerState.type === 'past_due') {
      return { background: C.amberDim, borderColor: 'rgba(245,158,11,0.3)' };
    }
    if (bannerState.type === 'trial_expired') {
      return { background: C.redDim, borderColor: 'rgba(239,68,68,0.3)' };
    }
    return { background: C.indigoDim, borderColor: C.indigoBrd };
  };

  const style = getBannerStyle();

  const getMessage = () => {
    if (bannerState.type === 'past_due') {
      return 'Payment failed. Update your payment method to avoid interruption.';
    }
    if (bannerState.type === 'trial_expired') {
      return 'Your trial has ended. Upgrade to restore access.';
    }
    if (bannerState.daysRemaining === 0) {
      return 'Your trial ends today. Upgrade to keep access.';
    }
    return `Your trial ends in ${bannerState.daysRemaining} ${
      bannerState.daysRemaining === 1 ? 'day' : 'days'
    }. Upgrade to keep access.`;
  };

  return (
    <div
      style={{
        background: style.background,
        borderBottom: `1px solid ${style.borderColor}`,
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        fontFamily: F.sans,
      }}
    >
      <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
        {getMessage()}
      </span>
      {bannerState.type === 'past_due' ? (
        <button
          onClick={async () => {
            const res = await fetch('/api/billing/portal', { method: 'POST' });
            if (res.ok) {
              const data = await res.json();
              window.location.href = data.url;
            }
          }}
          style={{
            padding: '6px 14px',
            background: C.indigo,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Update payment
        </button>
      ) : (
        <Link
          href="/billing/upgrade"
          style={{
            padding: '6px 14px',
            background: C.indigo,
            color: '#fff',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {bannerState.type === 'trial_expired' ? 'Upgrade now' : 'See plans'}
        </Link>
      )}
    </div>
  );
}
