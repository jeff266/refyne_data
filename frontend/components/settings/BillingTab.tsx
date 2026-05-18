'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { C, F } from '@/lib/design-tokens';
import { PLAN_PRICING, getPlanFeatures } from '@/lib/billing/plan-features';
import { PrimaryBtn } from '@/components/refyne/PrimaryBtn';
import { GhostBtn } from '@/components/refyne/GhostBtn';

interface BillingStatus {
  plan: string;
  status: string;
  alwaysOnAddon: boolean;
  creditsUsed: number;
  creditsLimit: number;
  creditsRemaining: number;
  trialEndsAt: string | null;
  daysRemaining: number | null;
}

interface Usage {
  credits: { used: number; limit: number; remaining: number; resetAt: string | null };
  portals: { connected: number; limit: number };
  seats: {
    operators: number;
    admins: number;
    limits: { operators: number; admins: number };
  };
}

export function BillingTab() {
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBillingData();
  }, []);

  async function fetchBillingData() {
    try {
      const [statusRes, usageRes] = await Promise.all([
        fetch('/api/billing/status'),
        fetch('/api/billing/usage'),
      ]);

      if (statusRes.ok) {
        setBilling(await statusRes.json());
      }
      if (usageRes.ok) {
        setUsage(await usageRes.json());
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
        window.location.href = data.portalUrl;
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

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; text: string }> = {
      trialing: { color: C.indigoLt, text: 'Trial' },
      active: { color: C.green, text: 'Active' },
      past_due: { color: C.amber, text: 'Past due' },
      cancelled: { color: C.text3, text: 'Cancelled' },
      trial_expired: { color: C.red, text: 'Trial expired' },
    };
    return badges[status] || { color: C.text3, text: status };
  };

  const statusBadge = getStatusBadge(billing.status);
  const planInfo = PLAN_PRICING[billing.plan as keyof typeof PLAN_PRICING];

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      {/* Current Plan */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 16 }}>
          Current Plan
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              padding: '6px 14px',
              background: C.indigoDim,
              border: `1px solid ${C.indigoBrd}`,
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              color: C.indigoLt,
              textTransform: 'capitalize',
            }}
          >
            {planInfo?.name || billing.plan}
          </div>
          <div
            style={{
              padding: '4px 10px',
              background: statusBadge.color + '20',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              color: statusBadge.color,
            }}
          >
            {statusBadge.text}
          </div>
        </div>

        {billing.status === 'trialing' && billing.daysRemaining !== null && (
          <p style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
            Trial ends in <strong>{billing.daysRemaining} days</strong>
          </p>
        )}

        {billing.status === 'active' && (
          <p style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
            Your subscription is active
          </p>
        )}

        <GhostBtn onClick={handleManageSubscription}>Manage subscription →</GhostBtn>
      </div>

      {/* Usage this period */}
      {usage && (
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 20 }}>
            Usage this period
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Enrich credits */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 13, color: C.text2 }}>Enrich credits</span>
                <span style={{ fontSize: 13, color: C.text, fontFamily: F.mono }}>
                  {usage.credits.used} / {usage.credits.limit}
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  background: C.border,
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    background: C.indigo,
                    width: `${Math.min(100, (usage.credits.used / usage.credits.limit) * 100)}%`,
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>

            {/* Portals */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 13, color: C.text2 }}>Connected portals</span>
                <span style={{ fontSize: 13, color: C.text, fontFamily: F.mono }}>
                  {usage.portals.connected} / {usage.portals.limit}
                </span>
              </div>
            </div>

            {/* Seats */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 13, color: C.text2 }}>Team members</span>
                <span style={{ fontSize: 13, color: C.text, fontFamily: F.mono }}>
                  {usage.seats.operators} / {usage.seats.limits.operators}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Always On add-on */}
      {billing.plan !== 'scale' && billing.plan !== 'enterprise' && (
        <div
          style={{
            background: C.indigoDim,
            border: `2px solid ${C.indigo}`,
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 16,
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                Always On Monitoring
              </h3>
              <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>
                Get nightly digest emails with compliance changes, dedup alerts, and auto-merge
                Grade A pairs.
              </p>
            </div>
            {!billing.alwaysOnAddon && (
              <div style={{ fontSize: 20, fontWeight: 600, color: C.text, textAlign: 'right' }}>
                +$79<span style={{ fontSize: 14, fontWeight: 400, color: C.text2 }}>/mo</span>
              </div>
            )}
          </div>

          {billing.alwaysOnAddon ? (
            <div
              style={{
                padding: '6px 12px',
                background: C.greenDim,
                border: `1px solid ${C.greenBrd}`,
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: C.green,
                display: 'inline-block',
              }}
            >
              Active · $79/mo
            </div>
          ) : (
            <GhostBtn onClick={handleManageSubscription}>Add Always On →</GhostBtn>
          )}
        </div>
      )}

      {/* Upgrade path (for lower tiers) */}
      {(billing.plan === 'trialing' || billing.plan === 'starter') && (
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 12 }}>
            Unlock more with an upgrade
          </h3>
          <p style={{ fontSize: 13, color: C.text2, marginBottom: 20, lineHeight: 1.6 }}>
            Get more credits, portals, and seats by upgrading to Growth or Scale.
          </p>
          <Link
            href="/pricing"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '10px 20px',
              background: `linear-gradient(to bottom, ${C.indigo}, ${C.indigoDk})`,
              color: '#fff',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 0 0 1px rgba(99,102,241,0.3), 0 1px 3px rgba(0,0,0,0.4)',
            }}
          >
            See upgrade options →
          </Link>
        </div>
      )}
    </div>
  );
}
