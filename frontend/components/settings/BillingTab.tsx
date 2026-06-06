'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { C } from '@/lib/design-tokens';

// Billing-specific color tokens
const STEEL = '#2E6BA8';
const STEEL_DIM = 'rgba(46,107,168,0.12)';
const STEEL_BRD = 'rgba(46,107,168,0.3)';
const HEADING_FONT = "'Lora', Georgia, serif";
const BODY_FONT = "'Jost', system-ui, sans-serif";

interface BillingEvent {
  id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface BillingStatus {
  subscription_tier: string;
  subscription_status: string;
  stripe_customer_id: string | null;
  trial_days_remaining: number | null;
  trial_merges_used: number;
  trial_normalize_writes_used: number;
  trial_enrich_credits_used: number;
  trial_merge_limit: number | null;
  trial_normalize_limit: number | null;
  trial_enrich_limit: number | null;
  merges_last_30d: number;
  normalize_writes_last_30d: number;
  enrich_credits_last_30d: number;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  events: BillingEvent[];
}

function progressBarColor(pct: number): string {
  if (pct >= 100) return C.red;
  if (pct >= 80) return C.amber;
  return STEEL;
}

function planLabel(tier: string): string {
  const labels: Record<string, string> = {
    trial: 'Trial',
    starter: 'Starter',
    growth: 'Growth',
    scale: 'Scale',
    internal: 'Internal',
  };
  return labels[tier] ?? tier;
}

function statusBadge(status: string): { bg: string; border: string; color: string; text: string } {
  switch (status) {
    case 'active':
      return { bg: STEEL_DIM, border: STEEL_BRD, color: STEEL, text: 'Active' };
    case 'past_due':
      return { bg: C.amberDim, border: C.amberBrd, color: C.amber, text: 'Payment due' };
    case 'cancelled':
      return { bg: C.redDim, border: C.redBrd, color: C.red, text: 'Cancelled' };
    case 'paused':
      return { bg: C.amberDim, border: C.amberBrd, color: C.amber, text: 'Paused' };
    default:
      return { bg: STEEL_DIM, border: STEEL_BRD, color: STEEL, text: 'Trial' };
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

function eventLabel(event: BillingEvent): string {
  const tier = (event.metadata?.tier as string) ?? '';
  const action = (event.metadata?.action as string) ?? '';
  const labels: Record<string, string> = {
    trial_started: 'Trial started',
    subscription_created: `Subscribed to ${tier} plan`,
    subscription_updated: `Plan updated to ${tier}`,
    subscription_cancelled: 'Subscription cancelled',
    payment_failed: 'Payment failed - retrying',
    payment_succeeded: 'Payment succeeded',
    usage_limit_exceeded: `Usage limit reached (${action})`,
    checkout_session_created: 'Checkout started',
  };
  return labels[event.event_type] ?? event.event_type.replace(/_/g, ' ');
}

function eventDotColor(type: string): string {
  if (type === 'payment_failed' || type === 'subscription_cancelled') return C.red;
  if (type === 'payment_succeeded' || type === 'subscription_created') return C.green;
  if (type === 'usage_limit_exceeded') return C.amber;
  return C.text3;
}

function UsageRow({
  label,
  used,
  limit,
  isTrial,
}: {
  label: string;
  used: number;
  limit: number | null;
  isTrial: boolean;
}) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const barColor = progressBarColor(pct);

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
          fontFamily: BODY_FONT,
        }}
      >
        <span style={{ fontSize: 13, color: C.text2 }}>{label}</span>
        <span style={{ fontSize: 13, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
          {isTrial && limit !== null
            ? `${used.toLocaleString()} / ${limit.toLocaleString()}`
            : `${used.toLocaleString()} this period`}
        </span>
      </div>
      {isTrial && limit !== null && (
        <div
          style={{
            height: 6,
            background: C.border2,
            borderRadius: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: barColor,
              transition: 'width 0.3s',
            }}
          />
        </div>
      )}
    </div>
  );
}

async function openPortal() {
  const res = await fetch('/api/billing/portal', { method: 'POST' });
  if (res.ok) {
    const data = await res.json();
    window.location.href = data.url;
  }
}

export function BillingTab() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/billing/status')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStatus(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 32, color: C.text3, fontSize: 13, fontFamily: BODY_FONT }}>
        Loading billing information...
      </div>
    );
  }

  if (!status) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ fontSize: 13, color: C.red, fontFamily: BODY_FONT }}>
          Failed to load billing information. Please try again.
        </p>
      </div>
    );
  }

  const isTrial = status.subscription_tier === 'trial';
  const isPaid = ['starter', 'growth', 'scale'].includes(status.subscription_tier);
  const badge = isTrial
    ? { bg: 'transparent', border: `1px solid ${STEEL_BRD}`, color: STEEL, text: 'Trial' }
    : { ...statusBadge(status.subscription_status), border: `1px solid ${statusBadge(status.subscription_status).border}` };

  const daysLeft = status.trial_days_remaining !== null ? Math.floor(status.trial_days_remaining) : null;
  const showDanger =
    (status.subscription_status === 'active' || status.subscription_status === 'past_due') &&
    !!status.stripe_customer_id &&
    isPaid;

  const sectionStyle: React.CSSProperties = {
    borderBottom: `1px solid ${C.border}`,
    paddingBottom: 28,
    marginBottom: 28,
  };

  return (
    <div style={{ maxWidth: 720, fontFamily: BODY_FONT }}>

      {/* Section A: Current Plan */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
          {/* Left: plan info */}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: HEADING_FONT, fontSize: 22, fontWeight: 600, color: C.text, marginBottom: 6 }}>
              {planLabel(status.subscription_tier)}
            </div>
            <div style={{ fontSize: 15, color: C.text2, marginBottom: 10, fontFamily: BODY_FONT }}>
              {isTrial ? 'Free trial' : null}
            </div>

            {/* Status badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  background: badge.bg,
                  border: badge.border,
                  borderRadius: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  color: badge.color,
                  fontFamily: BODY_FONT,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {badge.text}
              </span>
            </div>

            {/* Period info */}
            {isPaid && status.current_period_start && status.current_period_end && (
              <div style={{ fontSize: 12, color: C.text3, fontFamily: BODY_FONT }}>
                Current period: {formatDate(status.current_period_start)} to {formatDate(status.current_period_end)}
              </div>
            )}
            {status.cancel_at_period_end && status.current_period_end && (
              <div style={{ fontSize: 12, color: C.amber, fontFamily: BODY_FONT, marginTop: 4 }}>
                Access ends: {formatDate(status.current_period_end)}
              </div>
            )}
          </div>

          {/* Right: action button */}
          <div style={{ flexShrink: 0 }}>
            {status.stripe_customer_id ? (
              <button
                onClick={openPortal}
                style={{
                  padding: '9px 18px',
                  background: C.surface,
                  border: `1px solid ${C.border2}`,
                  borderRadius: 0,
                  color: C.text,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: BODY_FONT,
                }}
              >
                {status.subscription_status === 'past_due' ? 'Update payment' : 'Manage subscription'}
              </button>
            ) : isTrial ? (
              <Link
                href="/billing/upgrade"
                style={{
                  display: 'inline-block',
                  padding: '9px 18px',
                  background: STEEL,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  borderRadius: 0,
                  fontFamily: BODY_FONT,
                }}
              >
                Upgrade now
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* Section B: Usage This Period */}
      <div style={sectionStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 18, fontFamily: BODY_FONT }}>
          Usage this period
        </div>

        <UsageRow
          label="Merges"
          used={isTrial ? status.trial_merges_used : status.merges_last_30d}
          limit={isTrial ? status.trial_merge_limit : null}
          isTrial={isTrial}
        />
        <UsageRow
          label="Normalize writes"
          used={isTrial ? status.trial_normalize_writes_used : status.normalize_writes_last_30d}
          limit={isTrial ? status.trial_normalize_limit : null}
          isTrial={isTrial}
        />
        <UsageRow
          label="Enrich credits"
          used={isTrial ? status.trial_enrich_credits_used : status.enrich_credits_last_30d}
          limit={isTrial ? status.trial_enrich_limit : null}
          isTrial={isTrial}
        />

        {isTrial && daysLeft !== null && (
          <div
            style={{
              marginTop: 12,
              fontSize: 13,
              fontFamily: BODY_FONT,
              color: daysLeft <= 0 ? C.red : daysLeft <= 3 ? C.amber : C.text2,
            }}
          >
            {daysLeft <= 0
              ? 'Your trial has ended'
              : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} remaining in your trial`}
          </div>
        )}
      </div>

      {/* Section C: Billing Events */}
      {status.events.length > 0 && (
        <div style={sectionStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16, fontFamily: BODY_FONT }}>
            Recent billing activity
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {status.events.map(event => (
              <div key={event.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: eventDotColor(event.event_type),
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 13, color: C.text, flex: 1, fontFamily: BODY_FONT }}>
                  {eventLabel(event)}
                </span>
                <span style={{ fontSize: 12, color: C.text3, fontFamily: BODY_FONT, whiteSpace: 'nowrap' }}>
                  {relativeTime(event.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section D: Danger Zone */}
      {showDanger && (
        <div>
          <button
            onClick={openPortal}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 12,
              color: C.text3,
              cursor: 'pointer',
              textDecoration: 'underline',
              fontFamily: BODY_FONT,
            }}
          >
            Cancel subscription
          </button>
        </div>
      )}
    </div>
  );
}
