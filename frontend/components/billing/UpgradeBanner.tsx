'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { C } from '@/lib/design-tokens';

interface BillingStatus {
  show: boolean;
  message: string;
  urgency: 'warning' | 'critical';
}

/**
 * UpgradeBanner
 *
 * Shows upgrade prompt when:
 * - Trial expired
 * - Trial with <3 days remaining
 * - Past_due status
 *
 * Uses checkBillingLimit() from lib/billing/enforce.ts
 * Square corners, navy background, no border-radius
 */
export function UpgradeBanner() {
  const { orgId } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!orgId) return;

    async function checkStatus() {
      try {
        // Fetch entitlements from API
        const response = await fetch(`/api/billing/status?orgId=${orgId}`);

        if (!response.ok) {
          console.error('[UpgradeBanner] Failed to fetch billing status');
          return;
        }

        const data = await response.json();

        // Determine if banner should show
        const {
          subscription_tier,
          subscription_status,
          trial_days_remaining,
        } = data;

        // Don't show for internal orgs
        if (subscription_tier === 'internal') {
          setStatus(null);
          return;
        }

        // Don't show for paid tiers with active status
        if (
          (subscription_tier === 'starter' ||
            subscription_tier === 'growth' ||
            subscription_tier === 'scale') &&
          subscription_status === 'active'
        ) {
          setStatus(null);
          return;
        }

        // Critical: Trial expired
        if (subscription_tier === 'trial' && trial_days_remaining <= 0) {
          setStatus({
            show: true,
            message: 'Your trial has expired. Upgrade now to continue using Refyne.',
            urgency: 'critical',
          });
          return;
        }

        // Warning: Trial expiring soon (<3 days)
        if (subscription_tier === 'trial' && trial_days_remaining < 3) {
          const daysText = Math.ceil(trial_days_remaining);
          setStatus({
            show: true,
            message: `Your trial expires in ${daysText} ${
              daysText === 1 ? 'day' : 'days'
            }. Upgrade to keep your access.`,
            urgency: 'warning',
          });
          return;
        }

        // Critical: Payment past due
        if (subscription_status === 'past_due') {
          setStatus({
            show: true,
            message:
              'Payment failed. Please update your payment method to avoid service interruption.',
            urgency: 'critical',
          });
          return;
        }

        // No banner needed
        setStatus(null);
      } catch (error) {
        console.error('[UpgradeBanner] Error checking billing status:', error);
      }
    }

    checkStatus();
  }, [orgId]);

  // Don't render if no status or dismissed
  if (!status || !status.show || dismissed) {
    return null;
  }

  const bgColor = status.urgency === 'critical' ? '#1E3A8A' : '#3730A3'; // Navy (darker for critical)

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: bgColor,
        color: '#FFFFFF',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: C.sans,
        fontSize: 13,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 16 }}>
          {status.urgency === 'critical' ? '⚠️' : '⏰'}
        </span>
        <span>{status.message}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link
          href="/billing/upgrade"
          style={{
            backgroundColor: '#FFFFFF',
            color: bgColor,
            padding: '6px 16px',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'opacity 0.15s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Upgrade Now
        </Link>

        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#FFFFFF',
            cursor: 'pointer',
            padding: '4px 8px',
            fontSize: 18,
            opacity: 0.8,
            transition: 'opacity 0.15s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseOut={(e) => (e.currentTarget.style.opacity = '0.8')}
          aria-label="Dismiss banner"
        >
          ×
        </button>
      </div>
    </div>
  );
}
