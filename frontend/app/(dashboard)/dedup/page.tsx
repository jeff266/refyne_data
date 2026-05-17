'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
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
          <ReviewQueue />
        </div>
      )}
    </div>
  );
}
