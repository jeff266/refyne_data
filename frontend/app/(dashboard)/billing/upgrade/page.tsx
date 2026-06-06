'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { C } from '@/lib/design-tokens';

const STEEL = '#2E6BA8';
const STEEL_DIM = 'rgba(46,107,168,0.12)';
const STEEL_BRD = 'rgba(46,107,168,0.3)';
const HEADING_FONT = "'Lora', Georgia, serif";
const BODY_FONT = "'Jost', system-ui, sans-serif";

interface PriceEntry { stripe_price_id: string; amount_cents: number }
interface Prices { starter?: { monthly?: PriceEntry; annual?: PriceEntry }; growth?: { monthly?: PriceEntry; annual?: PriceEntry }; scale?: { monthly?: PriceEntry; annual?: PriceEntry } }

const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    'Up to 10,000 companies',
    'Normalize, Dedup, and Enrich',
    '10,000 enrich credits/month',
    'Job segmentation',
    'Email support',
  ],
  growth: [
    'Up to 50,000 companies',
    'Everything in Starter',
    '20,000 enrich credits/month',
    'Priority support',
    'Nightly dedup scans',
  ],
  scale: [
    'Unlimited companies',
    'Everything in Growth',
    '35,000 enrich credits/month',
    'Dedicated onboarding',
    'SLA support',
  ],
};

function formatDollars(cents: number, period: 'monthly' | 'annual'): string {
  const monthly = period === 'annual' ? cents / 12 / 100 : cents / 100;
  return `$${Math.round(monthly).toLocaleString()}/mo`;
}

function formatAnnualNote(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()} billed annually`;
}

export default function UpgradePage() {
  const router = useRouter();
  const [prices, setPrices] = useState<Prices>({});
  const [currentTier, setCurrentTier] = useState<string>('trial');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/billing/prices').then(r => r.ok ? r.json() : {}),
      fetch('/api/billing/status').then(r => r.ok ? r.json() : null),
    ]).then(([priceData, statusData]) => {
      setPrices(priceData);
      if (statusData) setCurrentTier(statusData.subscription_tier);
    }).finally(() => setLoading(false));
  }, []);

  async function handleGetStarted(tier: string) {
    setCheckoutLoading(tier);
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, billing_period: billingPeriod }),
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.checkout_url;
      }
    } catch {
      // silent fail - user can retry
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleDowngrade() {
    const res = await fetch('/api/billing/portal', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      window.location.href = data.url;
    }
  }

  const plans: Array<{ id: string; name: string; popular: boolean }> = [
    { id: 'starter', name: 'Starter', popular: false },
    { id: 'growth', name: 'Growth', popular: true },
    { id: 'scale', name: 'Scale', popular: false },
  ];

  const tierOrder = { trial: 0, starter: 1, growth: 2, scale: 3 };

  function ctaLabel(planId: string): string {
    if (planId === currentTier) return 'Current plan';
    const currentOrder = tierOrder[currentTier as keyof typeof tierOrder] ?? 0;
    const planOrder = tierOrder[planId as keyof typeof tierOrder] ?? 0;
    return planOrder > currentOrder ? 'Get started' : 'Downgrade';
  }

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: C.text3, fontFamily: BODY_FONT }}>
        Loading plans...
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 48px', fontFamily: BODY_FONT, maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <h1 style={{ fontFamily: HEADING_FONT, fontSize: 32, fontWeight: 600, color: C.text, marginBottom: 16 }}>
          Choose a plan
        </h1>

        {/* Monthly / Annual toggle */}
        <div style={{ display: 'inline-flex', border: `1px solid ${C.border2}`, borderRadius: 0 }}>
          {(['monthly', 'annual'] as const).map(p => (
            <button
              key={p}
              onClick={() => setBillingPeriod(p)}
              style={{
                padding: '8px 20px',
                background: billingPeriod === p ? STEEL : 'transparent',
                color: billingPeriod === p ? '#fff' : C.text2,
                border: 'none',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: BODY_FONT,
                borderRadius: 0,
              }}
            >
              {p === 'annual' ? 'Annual (save 20%)' : 'Monthly'}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
        {plans.map((plan, idx) => {
          const priceEntry = prices[plan.id as keyof Prices]?.[billingPeriod];
          const isCurrentPlan = plan.id === currentTier;
          const label = ctaLabel(plan.id);
          const isUpgrade = label === 'Get started';
          const isDowngrade = label === 'Downgrade';

          return (
            <div
              key={plan.id}
              style={{
                background: plan.popular ? STEEL_DIM : C.surface,
                border: `1px solid ${plan.popular ? STEEL_BRD : C.border}`,
                borderLeft: idx > 0 ? 'none' : undefined,
                padding: 28,
                position: 'relative',
                borderRadius: 0,
              }}
            >
              {plan.popular && (
                <div
                  style={{
                    position: 'absolute',
                    top: -1,
                    right: 20,
                    background: STEEL,
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '3px 10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontFamily: BODY_FONT,
                  }}
                >
                  Most popular
                </div>
              )}

              <div style={{ fontFamily: HEADING_FONT, fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                {plan.name}
              </div>

              {priceEntry ? (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: C.text, fontFamily: HEADING_FONT }}>
                    {formatDollars(priceEntry.amount_cents, billingPeriod)}
                  </div>
                  {billingPeriod === 'annual' && (
                    <div style={{ fontSize: 11, color: C.text3, fontFamily: BODY_FONT, marginTop: 2 }}>
                      {formatAnnualNote(priceEntry.amount_cents)}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginBottom: 20, fontSize: 14, color: C.text3, fontFamily: BODY_FONT }}>
                  Contact us
                </div>
              )}

              {/* Feature list */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0' }}>
                {(PLAN_FEATURES[plan.id] ?? []).map(f => (
                  <li
                    key={f}
                    style={{
                      fontSize: 13,
                      color: C.text2,
                      padding: '4px 0',
                      fontFamily: BODY_FONT,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <span style={{ color: STEEL, flexShrink: 0 }}>+</span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {isCurrentPlan ? (
                <div
                  style={{
                    padding: '9px 0',
                    textAlign: 'center',
                    fontSize: 13,
                    color: C.text3,
                    border: `1px solid ${C.border}`,
                    fontFamily: BODY_FONT,
                    borderRadius: 0,
                  }}
                >
                  Current plan
                </div>
              ) : isUpgrade ? (
                <button
                  onClick={() => handleGetStarted(plan.id)}
                  disabled={!!checkoutLoading}
                  style={{
                    width: '100%',
                    padding: '9px 0',
                    background: plan.popular ? STEEL : C.hover,
                    color: plan.popular ? '#fff' : C.text,
                    border: `1px solid ${plan.popular ? STEEL : C.border2}`,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: checkoutLoading ? 'wait' : 'pointer',
                    fontFamily: BODY_FONT,
                    borderRadius: 0,
                  }}
                >
                  {checkoutLoading === plan.id ? 'Redirecting...' : 'Get started'}
                </button>
              ) : (
                <button
                  onClick={handleDowngrade}
                  style={{
                    width: '100%',
                    padding: '9px 0',
                    background: 'transparent',
                    color: C.text3,
                    border: `1px solid ${C.border}`,
                    fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: BODY_FONT,
                    borderRadius: 0,
                  }}
                >
                  Downgrade
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
