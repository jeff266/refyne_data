'use client';

import { useEffect, useState } from 'react';
import { C, F } from '@/lib/design-tokens';
import { useRole } from '@/hooks/useRole';
import { AdminOnlyNotice } from '@/components/auth/AdminOnlyNotice';

interface BillingEntitlements {
  subscription_tier: string;
  subscription_status: string;
  trial_days_remaining: number | null;
  trial_merges_used: number;
  trial_merges_remaining: number;
  trial_merge_limit: number;
  trial_normalize_writes_used: number;
  trial_normalize_remaining: number;
  trial_normalize_limit: number;
  trial_enrich_credits_used: number;
  trial_enrich_remaining: number;
  trial_enrich_limit: number;
  current_period_start: string | null;
  current_period_end: string | null;
  merges_last_30d: number;
  normalize_writes_last_30d: number;
  enrich_credits_last_30d: number;
  pro_monthly_enrich_credits: number | null;
  enterprise_monthly_enrich_credits: number | null;
  events: BillingEvent[];
}

interface BillingEvent {
  event_type: string;
  metadata: Record<string, any>;
  created_at: string;
}

interface PriceInfo {
  stripe_price_id: string;
  amount_cents: number;
}

interface Prices {
  starter: { monthly?: PriceInfo; annual?: PriceInfo };
  growth: { monthly?: PriceInfo; annual?: PriceInfo };
  scale: { monthly?: PriceInfo; annual?: PriceInfo };
}

export function BillingTab() {
  const { isAdmin } = useRole();
  const [billing, setBilling] = useState<BillingEntitlements | null>(null);
  const [prices, setPrices] = useState<Prices | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBillingData();
  }, []);

  async function fetchBillingData() {
    try {
      const [statusRes, pricesRes] = await Promise.all([
        fetch('/api/billing/status'),
        fetch('/api/billing/prices'),
      ]);

      if (statusRes.ok) {
        setBilling(await statusRes.json());
      }
      if (pricesRes.ok) {
        setPrices(await pricesRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleManageSubscription() {
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.url;
      } else {
        const error = await res.json();
        if (error.error === 'no_subscription') {
          alert('No subscription found. Please upgrade first.');
        }
      }
    } catch (error) {
      console.error('Failed to open portal:', error);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32, color: C.text3, fontSize: 13 }}>
        Loading billing information...
      </div>
    );
  }

  if (!billing) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ fontSize: 13, color: C.red }}>
          Failed to load billing information. Please try again.
        </p>
      </div>
    );
  }

  const isTrial = billing.subscription_tier === 'trial';
  const isActive = billing.subscription_status === 'active';
  const isPastDue = billing.subscription_status === 'past_due';
  const isCancelled = billing.subscription_status === 'cancelled';
  const hasStripeCustomer = billing.current_period_end !== null; // Proxy for stripe_customer_id

  // Get tier pricing
  const tierPricing = prices?.[billing.subscription_tier as keyof Prices]?.monthly;
  const priceDisplay = tierPricing
    ? `$${(tierPricing.amount_cents / 100).toFixed(0)} / month`
    : 'Free trial';

  // Status badge colors
  const getStatusBadge = () => {
    if (isActive && !isTrial) return { bg: C.indigo + '20', text: C.indigo, label: 'Active' };
    if (isPastDue) return { bg: C.amber + '20', text: C.amber, label: 'Payment due' };
    if (isCancelled) return { bg: C.red + '20', text: C.red, label: 'Cancelled' };
    if (isTrial) return { bg: 'transparent', text: C.text, label: 'Trial', border: `1px solid ${C.text}` };
    return { bg: C.text3 + '20', text: C.text3, label: billing.subscription_status };
  };

  const statusBadge = getStatusBadge();

  // Progress bar color based on percentage
  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return C.red;
    if (percentage >= 80) return C.amber;
    return C.indigo;
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Event type labels
  const getEventLabel = (event: BillingEvent) => {
    const labels: Record<string, string> = {
      trial_started: 'Trial started',
      subscription_created: `Subscribed to ${event.metadata?.tier || ''} plan`,
      subscription_updated: `Plan updated to ${event.metadata?.tier || ''}`,
      subscription_cancelled: 'Subscription cancelled',
      payment_failed: 'Payment failed - retrying',
      payment_succeeded: 'Payment succeeded',
      usage_limit_exceeded: `Usage limit reached (${event.metadata?.action || ''})`,
    };
    return labels[event.event_type] || event.event_type;
  };

  // Relative timestamp
  const getRelativeTime = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      {/* Section A: Current Plan */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {/* Left: Plan info */}
          <div>
            <h2 style={{
              fontSize: 24,
              fontFamily: F.sans,
              color: C.text,
              marginBottom: 8,
              textTransform: 'capitalize',
            }}>
              {billing.subscription_tier}
            </h2>
            <div style={{ fontSize: 16, color: C.text2, marginBottom: 12 }}>
              {priceDisplay}
            </div>
            <div
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                background: statusBadge.bg,
                border: statusBadge.border || 'none',
                color: statusBadge.text,
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 12,
              }}
            >
              {statusBadge.label}
            </div>
            {billing.current_period_start && billing.current_period_end && !isTrial && (
              <div style={{ fontSize: 13, color: C.text3 }}>
                Current period: {formatDate(billing.current_period_start)} - {formatDate(billing.current_period_end)}
              </div>
            )}
            {isCancelled && billing.current_period_end && (
              <div style={{ fontSize: 13, color: C.red }}>
                Access ends: {formatDate(billing.current_period_end)}
              </div>
            )}
          </div>

          {/* Right: Action button */}
          <div>
            {isAdmin ? (
              <>
                {hasStripeCustomer && (
                  <button
                    onClick={handleManageSubscription}
                    style={{
                      padding: '10px 20px',
                      background: C.text,
                      color: C.surface,
                      border: 'none',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Manage subscription
                  </button>
                )}
                {isTrial && (
                  <a
                    href="/billing/upgrade"
                    style={{
                      display: 'inline-block',
                      padding: '10px 20px',
                      background: C.indigo,
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 500,
                      textDecoration: 'none',
                    }}
                  >
                    Upgrade now
                  </a>
                )}
                {isPastDue && (
                  <button
                    onClick={handleManageSubscription}
                    style={{
                      padding: '10px 20px',
                      background: C.amber,
                      color: '#fff',
                      border: 'none',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Update payment
                  </button>
                )}
              </>
            ) : (
              <AdminOnlyNotice action="manage billing" />
            )}
          </div>
        </div>
      </div>

      {/* Section B: Usage This Period */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 20 }}>
          Usage this period
        </h3>

        {/* Merges */}
        <div style={{ marginBottom: 16 }}>
          {isTrial ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 14, color: C.text2 }}>Merges</span>
                <span style={{ fontSize: 14, color: C.text, fontFamily: F.mono }}>
                  {billing.trial_merges_used} / {billing.trial_merge_limit}
                </span>
              </div>
              <div style={{ height: 8, background: C.border, position: 'relative' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (billing.trial_merges_used / billing.trial_merge_limit) * 100)}%`,
                    background: getProgressColor((billing.trial_merges_used / billing.trial_merge_limit) * 100),
                  }}
                />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: C.text2 }}>
              Merges: <span style={{ color: C.text, fontFamily: F.mono }}>{billing.merges_last_30d.toLocaleString()}</span> this period
            </div>
          )}
        </div>

        {/* Normalize Writes */}
        <div style={{ marginBottom: 16 }}>
          {isTrial ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 14, color: C.text2 }}>Normalize writes</span>
                <span style={{ fontSize: 14, color: C.text, fontFamily: F.mono }}>
                  {billing.trial_normalize_writes_used} / {billing.trial_normalize_limit}
                </span>
              </div>
              <div style={{ height: 8, background: C.border, position: 'relative' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (billing.trial_normalize_writes_used / billing.trial_normalize_limit) * 100)}%`,
                    background: getProgressColor((billing.trial_normalize_writes_used / billing.trial_normalize_limit) * 100),
                  }}
                />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: C.text2 }}>
              Normalize writes: <span style={{ color: C.text, fontFamily: F.mono }}>{billing.normalize_writes_last_30d.toLocaleString()}</span> this period
            </div>
          )}
        </div>

        {/* Enrich Credits */}
        <div style={{ marginBottom: 16 }}>
          {isTrial ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 14, color: C.text2 }}>Enrich credits</span>
                <span style={{ fontSize: 14, color: C.text, fontFamily: F.mono }}>
                  {billing.trial_enrich_credits_used} / {billing.trial_enrich_limit}
                </span>
              </div>
              <div style={{ height: 8, background: C.border, position: 'relative' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (billing.trial_enrich_credits_used / billing.trial_enrich_limit) * 100)}%`,
                    background: getProgressColor((billing.trial_enrich_credits_used / billing.trial_enrich_limit) * 100),
                  }}
                />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: C.text2 }}>
              Enrich credits: <span style={{ color: C.text, fontFamily: F.mono }}>{billing.enrich_credits_last_30d.toLocaleString()}</span> this period
            </div>
          )}
        </div>

        {/* Trial days remaining */}
        {isTrial && billing.trial_days_remaining !== null && (
          <div style={{
            fontSize: 14,
            color: billing.trial_days_remaining <= 3 ? C.amber : C.text3,
            marginTop: 12,
          }}>
            {billing.trial_days_remaining <= 0
              ? 'Your trial has ended'
              : `${Math.ceil(billing.trial_days_remaining)} days remaining in your trial`
            }
          </div>
        )}
      </div>

      {/* Section C: Billing Events */}
      {billing.events && billing.events.length > 0 && (
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 16 }}>
            Recent billing activity
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {billing.events.map((event, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    background: C.indigo,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, fontSize: 14, color: C.text }}>
                  {getEventLabel(event)}
                </div>
                <div style={{ fontSize: 13, color: C.text3 }}>
                  {getRelativeTime(event.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section D: Danger Zone */}
      {(isActive || isPastDue) && hasStripeCustomer && (
        <div style={{ padding: 24 }}>
          <a
            onClick={handleManageSubscription}
            style={{
              fontSize: 13,
              color: C.text3,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Cancel subscription →
          </a>
        </div>
      )}
    </div>
  );
}
