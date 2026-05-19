'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { HowItWorksStrip } from '@/components/refyne';
import { DedupSettings, ReviewQueue } from '@/components/dedup';

// ─────────────────────────────────────────────────────────────
// Tab type
// ─────────────────────────────────────────────────────────────

type DedupTab = 'queue' | 'settings';

// ─────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────

export default function DedupPage() {
  const [tab, setTab] = useState<DedupTab>('queue');
  const hasTrackedVisit = useRef(false);

  // Track page visit for onboarding
  useEffect(() => {
    if (!hasTrackedVisit.current) {
      hasTrackedVisit.current = true;

      fetch('/api/onboarding/step/viewed_dedup', {
        method: 'POST',
      }).catch((error) => {
        console.error('Failed to track dedup visit:', error);
      });
    }
  }, []);

  const dedupSteps = [
    {
      title: 'Scan detects pairs',
      description: 'Refyne runs a 7-signal cascade — domain, LinkedIn, phone, name — and grades each pair A through D by confidence.',
    },
    {
      title: 'Review the queue',
      description: 'Bulk approve Grade A matches or use the accordion to pick field-by-field which value survives.',
    },
    {
      title: 'Merge with provenance',
      description: 'Refyne executes the merge in HubSpot, transfers all associations, and logs every decision for audit.',
    },
  ];

  // Tab button style
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 500,
    color: active ? C.text : C.text3,
    background: active ? C.surface : 'transparent',
    border: 'none',
    borderBottom: active ? `2px solid ${C.indigo}` : '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ fontFamily: F.sans }}>
      {/* Tab navigation */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: `1px solid ${C.border}`,
        padding: '0 32px',
        background: C.bg,
      }}>
        <button
          style={tabStyle(tab === 'queue')}
          onClick={() => setTab('queue')}
        >
          Review queue
        </button>
        <button
          style={tabStyle(tab === 'settings')}
          onClick={() => setTab('settings')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Settings size={14} /> Settings
          </span>
        </button>
      </div>

      {/* Settings tab content */}
      {tab === 'settings' && (
        <div style={{ padding: '28px 32px' }}>
          <DedupSettings isAdmin={true} />
        </div>
      )}

      {/* Review queue tab content */}
      {tab === 'queue' && (
        <div style={{ padding: '28px 32px' }}>
          <HowItWorksStrip steps={dedupSteps} storageKey="how-it-works-dedup" />
          <ReviewQueue />
        </div>
      )}
    </div>
  );
}
