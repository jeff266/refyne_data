'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { C, F } from '@/lib/design-tokens';
import { TrendingUp, AlertTriangle, AlertCircle } from 'lucide-react';
import { useEntitlements, shouldShowUpgradePrompts } from '@/lib/billing/use-entitlements';

interface UsageData {
  metering: {
    credits_used: number;
    credits_included: number;
    credits_remaining: number;
  };
}

export function CreditsWidget() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const { subscription_tier } = useEntitlements();

  useEffect(() => {
    fetch('/api/usage/refyne-search?period=current_month')
      .then((res) => res.json())
      .then((data) => {
        setUsage(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[CreditsWidget] Failed to fetch usage:', err);
        setLoading(false);
      });
  }, []);

  if (loading || !usage || !usage.metering) {
    return null;
  }

  const { credits_used, credits_included } = usage.metering;
  const percentage = (credits_used / credits_included) * 100;

  // Three visual states
  let bgColor: string = C.bg; // Normal (<80%)
  let textColor: string = C.text2;
  let Icon = TrendingUp;
  let iconColor: string = C.text3;

  if (percentage >= 100) {
    // Overage (>100%)
    bgColor = 'rgba(239, 68, 68, 0.1)';
    textColor = '#DC2626';
    Icon = AlertCircle;
    iconColor = '#DC2626';
  } else if (percentage >= 80) {
    // Warning (80-100%)
    bgColor = 'rgba(245, 158, 11, 0.1)';
    textColor = '#D97706';
    Icon = AlertTriangle;
    iconColor = '#D97706';
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <Link
        href="/settings/usage"
        style={{
          display: 'block',
          padding: '8px 10px',
          borderRadius: 7,
          background: bgColor,
          border: `1px solid ${C.border}`,
          textDecoration: 'none',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: C.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontFamily: F.mono,
            }}
          >
            Credits
          </div>
          <Icon size={12} color={iconColor} />
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: textColor,
            fontFamily: F.sans,
            letterSpacing: '-0.02em',
            marginBottom: 2,
          }}
        >
          {Math.round(percentage)}%
        </div>
        <div
          style={{
            fontSize: 11,
            color: C.text3,
            fontFamily: F.sans,
          }}
        >
          {credits_used.toLocaleString()} / {credits_included.toLocaleString()}
        </div>
      </Link>
      {percentage >= 100 && shouldShowUpgradePrompts(subscription_tier) && (
        <Link
          href="/settings/billing"
          style={{
            display: 'block',
            padding: '6px 10px',
            fontSize: 11,
            fontWeight: 600,
            color: C.accent,
            textDecoration: 'none',
            textAlign: 'center',
            fontFamily: F.sans,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
        >
          Add credits →
        </Link>
      )}
    </div>
  );
}
