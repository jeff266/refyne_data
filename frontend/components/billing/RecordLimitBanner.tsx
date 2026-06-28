'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { C, F } from '@/lib/design-tokens';
import { X } from 'lucide-react';

export function RecordLimitBanner() {
  const [bannerState, setBannerState] = useState<{
    show: boolean;
    type: 'near_limit' | 'over_limit' | 'grace_expired' | null;
    totalRecords: number | null;
    planLimit: number | null;
    currentPlan: string | null;
    gracePeriodEndsAt: string | null;
  }>({
    show: false,
    type: null,
    totalRecords: null,
    planLimit: null,
    currentPlan: null,
    gracePeriodEndsAt: null,
  });

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function checkRecordLimitStatus() {
      try {
        const res = await fetch('/api/billing/record-count');
        if (!res.ok) return;

        const data = await res.json();
        const recordCount = data.recordCount;

        if (!recordCount) return;

        // Check if dismissed today (only for near_limit)
        const dismissedKey = `record-limit-dismissed-${new Date().toDateString()}`;
        const wasDismissed = localStorage.getItem(dismissedKey) === 'true';

        if (recordCount.grace_period_expired) {
          setBannerState({
            show: true,
            type: 'grace_expired',
            totalRecords: recordCount.totalRecords,
            planLimit: recordCount.planLimit,
            currentPlan: recordCount.currentPlan,
            gracePeriodEndsAt: recordCount.gracePeriodEndsAt,
          });
        } else if (recordCount.is_over_limit) {
          setBannerState({
            show: true,
            type: 'over_limit',
            totalRecords: recordCount.totalRecords,
            planLimit: recordCount.planLimit,
            currentPlan: recordCount.currentPlan,
            gracePeriodEndsAt: recordCount.gracePeriodEndsAt,
          });
        } else if (recordCount.is_near_limit && !wasDismissed) {
          setBannerState({
            show: true,
            type: 'near_limit',
            totalRecords: recordCount.totalRecords,
            planLimit: recordCount.planLimit,
            currentPlan: recordCount.currentPlan,
            gracePeriodEndsAt: null,
          });
        }
      } catch (error) {
        console.error('Failed to check record limit status:', error);
      }
    }

    checkRecordLimitStatus();
  }, []);

  const handleDismiss = () => {
    const dismissedKey = `record-limit-dismissed-${new Date().toDateString()}`;
    localStorage.setItem(dismissedKey, 'true');
    setDismissed(true);
  };

  if (!bannerState.show || !bannerState.type || dismissed) {
    return null;
  }

  const getBannerStyle = () => {
    if (bannerState.type === 'grace_expired') {
      return {
        background: C.redDim,
        borderColor: 'rgba(239,68,68,0.3)',
        textColor: C.text,
      };
    }
    if (bannerState.type === 'over_limit') {
      return {
        background: 'rgba(249,115,22,0.1)',
        borderColor: 'rgba(249,115,22,0.3)',
        textColor: C.text,
      };
    }
    return {
      background: C.amberDim,
      borderColor: 'rgba(245,158,11,0.3)',
      textColor: C.text,
    };
  };

  const getMessage = () => {
    const planName = bannerState.currentPlan
      ? bannerState.currentPlan.charAt(0).toUpperCase() + bannerState.currentPlan.slice(1)
      : '';
    const records = bannerState.totalRecords?.toLocaleString() || '0';
    const limit = bannerState.planLimit?.toLocaleString() || '0';

    if (bannerState.type === 'grace_expired') {
      return {
        title: 'Write operations are paused.',
        message: `Your portal has exceeded its ${planName} record limit. Upgrade to resume.`,
        ctaText: 'Upgrade now',
        dismissable: false,
      };
    }
    if (bannerState.type === 'over_limit') {
      const gracePeriodEnd = bannerState.gracePeriodEndsAt
        ? new Date(bannerState.gracePeriodEndsAt).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : '';

      return {
        title: 'Your portal has exceeded its record limit.',
        message: `Write operations will pause on ${gracePeriodEnd}. Upgrade now.`,
        ctaText: 'Upgrade now',
        dismissable: false,
      };
    }
    return {
      title: `Your portal is approaching its ${planName} record limit (${records} of ${limit} records).`,
      message: 'Upgrade to avoid interruption.',
      ctaText: 'View plans',
      dismissable: true,
    };
  };

  const style = getBannerStyle();
  const message = getMessage();

  return (
    <div
      style={{
        background: style.background,
        borderBottom: `1px solid ${style.borderColor}`,
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        color: style.textColor,
      }}
    >
      <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>
        <span style={{ fontWeight: 600 }}>{message.title}</span>{' '}
        {message.message}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link
          href="/settings/billing"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: C.indigo,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {message.ctaText} →
        </Link>

        {message.dismissable && (
          <button
            onClick={handleDismiss}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              opacity: 0.6,
            }}
            aria-label="Dismiss banner"
          >
            <X size={16} color={style.textColor} />
          </button>
        )}
      </div>
    </div>
  );
}
