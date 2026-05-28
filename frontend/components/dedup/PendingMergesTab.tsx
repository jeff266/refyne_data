'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, Clock, X } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, GhostBtn, PrimaryBtn } from '@/components/refyne';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface PendingCluster {
  id: string;
  companyNames: string[];
  recordCount: number;
  grade: string;
  confidence: number;
  signals: any[];
  scheduledAt: string;
  minutesRemaining: number;
}

interface PendingMergesResponse {
  clusters: PendingCluster[];
  total: number;
}

interface AutoMergeSettings {
  enabled: boolean;
  confidence_threshold: number;
  waiting_period_hours: number;
  notify_email: string | null;
  notify_slack_webhook: string | null;
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function PendingMergesTab() {
  const [clusters, setClusters] = useState<PendingCluster[]>([]);
  const [settings, setSettings] = useState<AutoMergeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [clustersRes, settingsRes] = await Promise.all([
        fetch('/api/dedup/auto-merge/pending'),
        fetch('/api/dedup/auto-merge/settings'),
      ]);

      if (!clustersRes.ok || !settingsRes.ok) {
        throw new Error('Failed to load data');
      }

      const clustersData: PendingMergesResponse = await clustersRes.json();
      const settingsData: AutoMergeSettings = await settingsRes.json();

      setClusters(clustersData.clusters);
      setSettings(settingsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Refresh every minute to update countdowns
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleCancel = async (clusterId: string) => {
    if (!confirm('Cancel this auto-merge? The cluster will return to the review queue.')) {
      return;
    }

    setCancelling(clusterId);

    try {
      const res = await fetch(`/api/dedup/auto-merge/${clusterId}/cancel`, {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Failed to cancel auto-merge');
      }

      // Remove from list
      setClusters((prev) => prev.filter((c) => c.id !== clusterId));
    } catch (err) {
      alert(`Failed to cancel: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCancelling(null);
    }
  };

  const handleCancelAll = async () => {
    if (!confirm(`Cancel all ${clusters.length} pending auto-merges?`)) {
      return;
    }

    for (const cluster of clusters) {
      try {
        await fetch(`/api/dedup/auto-merge/${cluster.id}/cancel`, {
          method: 'POST',
        });
      } catch (err) {
        console.error(`Failed to cancel cluster ${cluster.id}:`, err);
      }
    }

    loadData();
  };

  const formatCountdown = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatSignals = (signals: any[]) => {
    if (!signals || signals.length === 0) return '—';
    return signals.map((s) => s.type).join(', ');
  };

  if (loading && clusters.length === 0) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <Card>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 40,
              color: C.text2,
              fontSize: 13,
            }}
          >
            <RefreshCw size={16} style={{ marginRight: 8 }} />
            Loading pending merges...
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <Card>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: 16,
              background: '#fef2f2',
              border: '1px solid #fee2e2',
              borderRadius: 8,
              color: '#991b1b',
              fontSize: 13,
            }}
          >
            <AlertCircle size={16} style={{ marginRight: 8 }} />
            {error}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Header with status */}
      <div style={{ marginBottom: 20 }}>
        {settings?.enabled ? (
          <div
            style={{
              padding: '12px 16px',
              background: '#eff6ff',
              border: '1px solid #dbeafe',
              borderRadius: 8,
              fontSize: 13,
              color: C.text,
              marginBottom: 16,
            }}
          >
            <strong>Auto-merge is ON</strong> · Grade A clusters above{' '}
            {Math.round((settings.confidence_threshold || 0.97) * 100)}% confidence merge
            automatically after {settings.waiting_period_hours || 24} hours
          </div>
        ) : (
          <div
            style={{
              padding: '12px 16px',
              background: '#fef2f2',
              border: '1px solid #fee2e2',
              borderRadius: 8,
              fontSize: 13,
              color: C.text2,
              marginBottom: 16,
            }}
          >
            Auto-merge is disabled. Enable it in Settings to automatically merge high-confidence
            duplicates.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: 0 }}>
            Pending Auto-merges
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <GhostBtn onClick={loadData} disabled={loading}>
              <RefreshCw size={14} style={{ marginRight: 6 }} />
              Refresh
            </GhostBtn>
            {clusters.length > 0 && (
              <GhostBtn onClick={handleCancelAll}>
                <X size={14} style={{ marginRight: 6 }} />
                Cancel all
              </GhostBtn>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <Card>
        {clusters.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: C.text2,
              fontSize: 13,
            }}
          >
            No pending auto-merges. High-confidence clusters will appear here when scheduled.
          </div>
        ) : (
          <>
            <div
              style={{
                padding: '12px 16px',
                background: '#fef3c7',
                border: '1px solid #fde68a',
                fontSize: 13,
                color: '#78350f',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Clock size={16} />
              <strong>{clusters.length}</strong> {clusters.length === 1 ? 'cluster' : 'clusters'}{' '}
              merging in{' '}
              <strong>
                {formatCountdown(Math.min(...clusters.map((c) => c.minutesRemaining)))}
              </strong>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ ...tableHeaderStyle, width: '30%' }}>Records</th>
                    <th style={{ ...tableHeaderStyle, width: '10%' }}>Score</th>
                    <th style={{ ...tableHeaderStyle, width: '25%' }}>Signals</th>
                    <th style={{ ...tableHeaderStyle, width: '20%' }}>Merges in</th>
                    <th style={{ ...tableHeaderStyle, width: '15%', textAlign: 'right' }}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clusters.map((cluster) => (
                    <tr
                      key={cluster.id}
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      <td style={tableCellStyle}>
                        <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                          {cluster.companyNames.join(' · ')}
                        </div>
                        {cluster.recordCount > 3 && (
                          <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                            +{cluster.recordCount - 3} more
                          </div>
                        )}
                      </td>
                      <td style={tableCellStyle}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: '#10b98115',
                            color: '#10b981',
                          }}
                        >
                          {cluster.confidence}%
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <div style={{ fontSize: 12, color: C.text2 }}>
                          {formatSignals(cluster.signals)}
                        </div>
                      </td>
                      <td style={tableCellStyle}>
                        <div
                          style={{
                            fontSize: 13,
                            color: cluster.minutesRemaining < 60 ? '#dc2626' : C.text,
                            fontWeight: 500,
                            fontFamily: F.mono,
                          }}
                        >
                          {formatCountdown(cluster.minutesRemaining)}
                        </div>
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                        <GhostBtn
                          onClick={() => handleCancel(cluster.id)}
                          disabled={cancelling === cluster.id}
                          style={{ fontSize: 12, padding: '4px 10px' }}
                        >
                          <X size={12} style={{ marginRight: 4 }} />
                          {cancelling === cluster.id ? 'Cancelling...' : 'Cancel'}
                        </GhostBtn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const tableHeaderStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: C.text3,
  background: C.hover,
};

const tableCellStyle: React.CSSProperties = {
  padding: '16px',
  fontSize: 13,
  color: C.text,
};
