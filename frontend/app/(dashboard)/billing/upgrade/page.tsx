'use client';

import { useEffect, useState } from 'react';
import { C, F } from '@/lib/design-tokens';

interface PriceInfo {
  stripe_price_id: string;
  amount_cents: number;
}

interface Prices {
  starter: { monthly?: PriceInfo; annual?: PriceInfo };
  growth: { monthly?: PriceInfo; annual?: PriceInfo };
  scale: { monthly?: PriceInfo; annual?: PriceInfo };
}

interface BillingStatus {
  subscription_tier: string;
  subscription_status: string;
}

interface PlanCard {
  tier: 'starter' | 'growth' | 'scale';
  name: string;
  features: string[];
  mostPopular?: boolean;
}

const PLAN_CARDS: PlanCard[] = [
  {
    tier: 'starter',
    name: 'Starter',
    features: [
      'Up to 10,000 companies',
      'Normalize, Dedup, and Enrich',
      '10,000 enrich credits/month',
      'Job segmentation',
      'Email support',
    ],
  },
  {
    tier: 'growth',
    name: 'Growth',
    features: [
      'Up to 50,000 companies',
      'Everything in Starter',
      '20,000 enrich credits/month',
      'Priority support',
      'Nightly dedup scans',
    ],
    mostPopular: true,
  },
  {
    tier: 'scale',
    name: 'Scale',
    features: [
      'Unlimited companies',
      'Everything in Growth',
      '35,000 enrich credits/month',
      'Dedicated onboarding',
      'SLA support',
    ],
  },
];

export default function UpgradePage() {
  const [prices, setPrices] = useState<Prices | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [pricesRes, statusRes] = await Promise.all([
        fetch('/api/billing/prices'),
        fetch('/api/billing/status'),
      ]);

      if (pricesRes.ok) {
        setPrices(await pricesRes.json());
      }
      if (statusRes.ok) {
        setBilling(await statusRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPlan(tier: string) {
    setCheckingOut(tier);

    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, billing_period: billingPeriod }),
      });

      if (res.ok) {
        const data = await res.json();
        window.location.href = data.checkout_url;
      } else {
        const error = await res.json();
        alert(`Failed to start checkout: ${error.error}`);
        setCheckingOut(null);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
      setCheckingOut(null);
    }
  }

  async function handleDowngrade(tier: string) {
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Portal error:', error);
    }
  }

  function getButtonState(tier: string): { label: string; action: () => void; disabled?: boolean } {
    const currentTier = billing?.subscription_tier || 'trial';

    if (currentTier === tier) {
      return { label: 'Current plan', action: () => {}, disabled: true };
    }

    // Determine if this is an upgrade or downgrade
    const tierOrder = ['trial', 'starter', 'growth', 'scale'];
    const currentIndex = tierOrder.indexOf(currentTier);
    const targetIndex = tierOrder.indexOf(tier);

    if (targetIndex > currentIndex) {
      // Upgrade
      return { label: 'Get started', action: () => handleSelectPlan(tier) };
    } else {
      // Downgrade
      return { label: 'Downgrade', action: () => handleDowngrade(tier) };
    }
  }

  function formatPrice(amountCents: number, period: 'monthly' | 'annual'): string {
    const monthly = Math.floor(amountCents / 100);
    if (period === 'monthly') {
      return `$${monthly}/mo`;
    } else {
      return `$${monthly}/mo billed annually`;
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: C.text3 }}>
        Loading pricing...
      </div>
    );
  }

  return (
    <div style={{ padding: 48, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h1 style={{
          fontSize: 36,
          fontFamily: F.sans,
          color: C.indigo,
          marginBottom: 24,
        }}>
          Choose a plan
        </h1>

        {/* Monthly / Annual Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, alignItems: 'center' }}>
          <button
            onClick={() => setBillingPeriod('monthly')}
            style={{
              padding: '10px 20px',
              background: billingPeriod === 'monthly' ? C.indigo : 'transparent',
              color: billingPeriod === 'monthly' ? C.text : C.text2,
              border: `1px solid ${C.border}`,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('annual')}
            style={{
              padding: '10px 20px',
              background: billingPeriod === 'annual' ? C.indigo : 'transparent',
              color: billingPeriod === 'annual' ? C.text : C.text2,
              border: `1px solid ${C.border}`,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Annual <span style={{ fontSize: 12, opacity: 0.8 }}>(save 20%)</span>
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {PLAN_CARDS.map((plan) => {
          const priceInfo = prices?.[plan.tier]?.[billingPeriod];
          const buttonState = getButtonState(plan.tier);

          return (
            <div
              key={plan.tier}
              style={{
                background: C.surface,
                border: `2px solid ${plan.mostPopular ? C.indigo : C.border}`,
                padding: 32,
                position: 'relative',
              }}
            >
              {/* Most Popular Badge */}
              {plan.mostPopular && (
                <div
                  style={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '4px 16px',
                    background: C.indigo,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Most popular
                </div>
              )}

              {/* Plan Name */}
              <h2 style={{
                fontSize: 24,
                fontFamily: F.sans,
                color: C.indigo,
                marginBottom: 16,
              }}>
                {plan.name}
              </h2>

              {/* Price */}
              <div style={{ marginBottom: 24 }}>
                {priceInfo ? (
                  <div style={{ fontSize: 32, fontWeight: 600, color: C.text }}>
                    {formatPrice(priceInfo.amount_cents, billingPeriod)}
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: C.text3 }}>
                    Pricing not available
                  </div>
                )}
              </div>

              {/* Features */}
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: 32 }}>
                {plan.features.map((feature, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 14,
                      color: C.text2,
                      marginBottom: 12,
                      paddingLeft: 20,
                      position: 'relative',
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 8,
                      height: 8,
                      background: C.indigo,
                    }} />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                onClick={buttonState.action}
                disabled={buttonState.disabled || checkingOut === plan.tier}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  background: buttonState.disabled ? C.border : C.indigo,
                  color: buttonState.disabled ? C.text3 : '#fff',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: buttonState.disabled ? 'not-allowed' : 'pointer',
                  opacity: checkingOut === plan.tier ? 0.6 : 1,
                }}
              >
                {checkingOut === plan.tier ? 'Starting checkout...' : buttonState.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
