'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { C, F } from '@/lib/design-tokens';
import { PlanFeatures, PLAN_PRICING } from '@/lib/billing/plan-features';

interface FeatureGateProps {
  feature: keyof PlanFeatures;
  requiredPlan: 'starter' | 'growth' | 'scale' | 'prospect_solo' | 'prospect_team';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ feature, requiredPlan, children, fallback }: FeatureGateProps) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAccess() {
      try {
        const res = await fetch('/api/billing/status');
        if (!res.ok) {
          setHasAccess(false);
          return;
        }

        const data = await res.json();
        const featureValue = data.features[feature];

        // Boolean features: check if true
        // Numeric features: check if > 0
        const allowed =
          typeof featureValue === 'boolean'
            ? featureValue
            : typeof featureValue === 'number'
            ? featureValue > 0
            : false;

        setHasAccess(allowed);
      } catch (error) {
        console.error('Failed to check feature access:', error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [feature]);

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: C.text3, fontSize: 13 }}>
        Checking access...
      </div>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  // Show upgrade prompt
  if (fallback) {
    return <>{fallback}</>;
  }

  const pricing = PLAN_PRICING[requiredPlan];
  const featureDescriptions: Record<string, string> = {
    normalize:
      'Automatically clean company names, industries, and phone numbers across your CRM with canonical normalization rules.',
    dedup:
      'Detect and merge duplicate companies with a 7-signal confidence cascade. Grade A matches bulk-approve in seconds.',
    compliance:
      'Real-time CRM health score with harmony-level breakdown and trend tracking.',
    prospect:
      'Full prospecting toolkit with enrichment, search, and account intelligence.',
    always_on:
      'Get nightly digest emails with compliance changes, dedup alerts, and auto-merge Grade A pairs.',
  };

  return (
    <div
      style={{
        padding: 48,
        background: C.surface,
        border: `2px solid ${C.indigoBrd}`,
        borderRadius: 16,
        textAlign: 'center',
        maxWidth: 560,
        margin: '64px auto',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          background: C.indigoDim,
          border: `1px solid ${C.indigoBrd}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          margin: '0 auto 24px',
        }}
      >
        🔒
      </div>

      <h3
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: C.text,
          marginBottom: 12,
          letterSpacing: '-0.02em',
        }}
      >
        This feature requires the {pricing.name} plan
      </h3>

      <p
        style={{
          fontSize: 14,
          color: C.text2,
          lineHeight: 1.6,
          marginBottom: 28,
        }}
      >
        {featureDescriptions[feature] || 'Unlock this feature by upgrading your plan.'}
      </p>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link
          href={`/upgrade?feature=${feature}&plan=${requiredPlan}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '12px 28px',
            background: `linear-gradient(to bottom, ${C.indigo}, ${C.indigoDk})`,
            color: '#fff',
            borderRadius: 9,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            textDecoration: 'none',
            boxShadow: '0 0 0 1px rgba(99,102,241,0.3), 0 1px 4px rgba(0,0,0,0.4)',
          }}
        >
          Upgrade to {pricing.name}{' '}
          {pricing.monthlyPrice && `— $${pricing.monthlyPrice}/mo`}
        </Link>

        <Link
          href="/pricing"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '12px 28px',
            border: `1px solid ${C.border}`,
            color: C.text2,
            borderRadius: 9,
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            textDecoration: 'none',
          }}
        >
          See all plans
        </Link>
      </div>
    </div>
  );
}
