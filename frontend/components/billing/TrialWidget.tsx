'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { C } from '@/lib/design-tokens';

const STEEL = '#2E6BA8';
const BODY_FONT = "'Jost', system-ui, sans-serif";

interface BillingStatus {
  subscription_tier: string;
  subscription_status: string;
  trial_days_remaining: number | null;
  trial_merges_used: number;
  trial_normalize_writes_used: number;
  trial_enrich_credits_used: number;
  trial_merge_limit: number | null;
  trial_normalize_limit: number | null;
  trial_enrich_limit: number | null;
}

function progressBarColor(pct: number): string {
  if (pct >= 100) return C.red;
  if (pct >= 80) return C.amber;
  return STEEL;
}

function MiniBar({ used, limit }: { used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div style={{ height: 3, background: C.border2, borderRadius: 0, overflow: 'hidden', marginTop: 2 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: progressBarColor(pct) }} />
    </div>
  );
}

export function TrialWidget() {
  const [status, setStatus] = useState<BillingStatus | null>(null);

  useEffect(() => {
    fetch('/api/billing/status')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStatus(data); })
      .catch(() => {});
  }, []);

  if (
    !status ||
    status.subscription_tier !== 'trial' ||
    status.subscription_status !== 'active'
  ) {
    return null;
  }

  const daysLeft = status.trial_days_remaining !== null
    ? Math.max(0, Math.floor(status.trial_days_remaining))
    : null;

  return (
    <div
      style={{
        margin: '8px 0',
        padding: '10px 8px',
        background: C.hover,
        border: `1px solid ${C.border}`,
        borderRadius: 0,
        fontFamily: BODY_FONT,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: C.text2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {daysLeft !== null ? `Trial: ${daysLeft}d left` : 'Trial'}
        </span>
        <Link
          href="/billing/upgrade"
          style={{
            fontSize: 11,
            color: STEEL,
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Upgrade
        </Link>
      </div>

      {/* Mini usage bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: C.text3 }}>Merges</span>
            <span style={{ fontSize: 10, color: C.text3 }}>
              {status.trial_merges_used}/{status.trial_merge_limit ?? 25}
            </span>
          </div>
          <MiniBar used={status.trial_merges_used} limit={status.trial_merge_limit} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: C.text3 }}>Normalize</span>
            <span style={{ fontSize: 10, color: C.text3 }}>
              {status.trial_normalize_writes_used}/{status.trial_normalize_limit ?? 100}
            </span>
          </div>
          <MiniBar used={status.trial_normalize_writes_used} limit={status.trial_normalize_limit} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: C.text3 }}>Enrich</span>
            <span style={{ fontSize: 10, color: C.text3 }}>
              {status.trial_enrich_credits_used}/{status.trial_enrich_limit ?? 50}
            </span>
          </div>
          <MiniBar used={status.trial_enrich_credits_used} limit={status.trial_enrich_limit} />
        </div>
      </div>
    </div>
  );
}
