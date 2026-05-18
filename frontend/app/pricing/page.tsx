'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { C, F } from '@/lib/design-tokens';

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);

  const plans = [
    {
      name: 'Starter',
      monthlyPrice: 149,
      annualPrice: 119,
      records: 'up to 25,000 records',
      highlighted: false,
    },
    {
      name: 'Growth',
      monthlyPrice: 249,
      annualPrice: 199,
      records: 'up to 75,000 records',
      highlighted: true,
    },
    {
      name: 'Scale',
      monthlyPrice: 399,
      annualPrice: 319,
      records: 'up to 200,000 records',
      highlighted: false,
    },
    {
      name: 'Enterprise',
      monthlyPrice: null,
      annualPrice: null,
      records: '200,000+',
      highlighted: false,
    },
  ];

  return (
    <MarketingLayout>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 32px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontSize: 42, fontWeight: 600, color: C.text, marginBottom: 12 }}>
            Simple, transparent pricing
          </h1>
          <p style={{ fontSize: 16, color: C.text2, marginBottom: 32 }}>
            Choose the plan that fits your data volume
          </p>

          {/* Billing toggle */}
          <div style={{ display: 'inline-flex', gap: 8, padding: 4, background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
            <button
              onClick={() => setIsAnnual(false)}
              style={{
                padding: '8px 20px',
                fontSize: 14,
                fontWeight: 500,
                background: !isAnnual ? C.indigo : 'transparent',
                color: !isAnnual ? 'white' : C.text2,
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              style={{
                padding: '8px 20px',
                fontSize: 14,
                fontWeight: 500,
                background: isAnnual ? C.indigo : 'transparent',
                color: isAnnual ? 'white' : C.text2,
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Annual <span style={{ color: isAnnual ? C.green : C.text3, marginLeft: 4 }}>Save 20%</span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, marginBottom: 48 }}>
          {plans.map((plan) => (
            <div
              key={plan.name}
              style={{
                background: plan.highlighted ? C.indigoDim : C.surface,
                border: `2px solid ${plan.highlighted ? C.indigo : C.border}`,
                borderRadius: 12,
                padding: 32,
                position: 'relative',
              }}
            >
              {plan.highlighted && (
                <div
                  style={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '4px 16px',
                    background: C.indigo,
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 12,
                  }}
                >
                  Most popular
                </div>
              )}

              <h3 style={{ fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                {plan.name}
              </h3>
              <p style={{ fontSize: 13, color: C.text2, marginBottom: 24 }}>
                {plan.records}
              </p>

              <div style={{ marginBottom: 24 }}>
                {plan.monthlyPrice !== null ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 36, fontWeight: 600, color: C.text }}>
                        ${isAnnual ? plan.annualPrice : plan.monthlyPrice}
                      </span>
                      <span style={{ fontSize: 14, color: C.text2 }}>/mo</span>
                    </div>
                    {isAnnual && (
                      <div style={{ fontSize: 13, color: C.text3, marginTop: 4, textDecoration: 'line-through' }}>
                        ${plan.monthlyPrice}/mo
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 24, fontWeight: 600, color: C.text }}>
                    Contact us
                  </div>
                )}
              </div>

              <Link
                href="/connections"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px 24px',
                  textAlign: 'center',
                  fontSize: 14,
                  fontWeight: 600,
                  background: plan.highlighted ? C.indigo : C.surface,
                  color: plan.highlighted ? 'white' : C.text,
                  border: `1px solid ${plan.highlighted ? C.indigo : C.border}`,
                  borderRadius: 8,
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>

        {/* Included features */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, marginBottom: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 20 }}>
            All plans include
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <Feature>Normalize</Feature>
            <Feature>Dedup</Feature>
            <Feature>Harmonies</Feature>
            <Feature>Compliance dashboard</Feature>
            <Feature>HubSpot integration</Feature>
            <Feature>Up to 3 active portals</Feature>
          </div>
        </div>

        {/* Always On add-on */}
        <div style={{ background: C.indigoDim, border: `2px solid ${C.indigo}`, borderRadius: 12, padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                Always On monitoring
              </h3>
              <p style={{ fontSize: 14, color: C.text2 }}>
                Add-on for any plan
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 32, fontWeight: 600, color: C.text }}>
                +$79<span style={{ fontSize: 16, fontWeight: 400, color: C.text2 }}>/mo</span>
              </div>
            </div>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <li style={{ fontSize: 14, color: C.text2, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: C.indigo }}>✓</span> Nightly monitoring
            </li>
            <li style={{ fontSize: 14, color: C.text2, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: C.indigo }}>✓</span> Digest email
            </li>
            <li style={{ fontSize: 14, color: C.text2, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: C.indigo }}>✓</span> Slack alerts
            </li>
            <li style={{ fontSize: 14, color: C.text2, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: C.indigo }}>✓</span> Auto-merge Grade A pairs
            </li>
          </ul>
        </div>

        {/* Note */}
        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: C.text3 }}>
          Per workspace, not per seat
        </div>
      </div>
    </MarketingLayout>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 14, color: C.text2, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: C.green }}>✓</span>
      {children}
    </div>
  );
}
