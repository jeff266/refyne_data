'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Settings, Check, X, History, Clock } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { HowItWorksStrip } from '@/components/refyne';
import { DedupSettings, ClusterQueue, MergeHistoryTab, PendingMergesTab } from '@/components/dedup';
import { useObjectType, type ObjectType } from '@/hooks/useObjectType';

// ─────────────────────────────────────────────────────────────
// Tab type
// ─────────────────────────────────────────────────────────────

type DedupTab = 'queue' | 'pending' | 'history' | 'settings';

// ─────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────

export default function DedupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<DedupTab>('queue');
  const hasTrackedVisit = useRef(false);
  const [showMergeBanner, setShowMergeBanner] = useState(false);
  const [mergeData, setMergeData] = useState<{
    name: string;
    rescued: number;
  } | null>(null);

  // Check for merge success params
  useEffect(() => {
    const merged = searchParams?.get('merged');
    const name = searchParams?.get('name');
    const rescued = searchParams?.get('rescued');

    if (merged === 'true' && name) {
      setShowMergeBanner(true);
      setMergeData({
        name: decodeURIComponent(name),
        rescued: rescued ? parseInt(rescued, 10) : 0,
      });

      // Auto-dismiss after 6 seconds
      const timer = setTimeout(() => {
        setShowMergeBanner(false);
        router.replace('/dedup');
      }, 6000);

      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

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

  const handleDismissBanner = () => {
    setShowMergeBanner(false);
    router.replace('/dedup');
  };

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
          style={tabStyle(tab === 'pending')}
          onClick={() => setTab('pending')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} /> Pending merges
          </span>
        </button>
        <button
          style={tabStyle(tab === 'history')}
          onClick={() => setTab('history')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <History size={14} /> History
          </span>
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

      {/* Pending merges tab content */}
      {tab === 'pending' && <PendingMergesTab />}

      {/* History tab content */}
      {tab === 'history' && <MergeHistoryTab />}

      {/* Review queue tab content */}
      {tab === 'queue' && (
        <div style={{ padding: '28px 32px' }}>
          {/* Merge success banner */}
          {showMergeBanner && mergeData && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                marginBottom: 16,
                background: 'rgba(46, 204, 138, 0.08)',
                border: '0.5px solid rgba(46, 204, 138, 0.3)',
                borderLeft: '3px solid #2ecc8a',
                borderRadius: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Check size={16} color="#2ecc8a" />
                <div>
                  <div style={{ fontSize: 13, color: '#2ecc8a', fontWeight: 500 }}>
                    {mergeData.name} merged successfully
                  </div>
                  {mergeData.rescued > 0 && (
                    <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>
                      {mergeData.rescued} fields rescued from duplicate records
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleDismissBanner}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: C.text3,
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = C.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = C.text3;
                }}
              >
                Dismiss <X size={14} />
              </button>
            </div>
          )}

          <HowItWorksStrip steps={dedupSteps} storageKey="how-it-works-dedup" />
          <ClusterQueue />
        </div>
      )}
    </div>
  );
}
