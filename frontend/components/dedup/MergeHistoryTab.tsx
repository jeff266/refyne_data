'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, RotateCcw } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, GhostBtn, PrimaryBtn } from '@/components/refyne';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface MergeHistory {
  id: string;
  merged_at: string;
  merged_by: string;
  merged_by_name: string | null;
  merge_method: string;
  survivor_record_id: string;
  merged_record_id: string;
  survivor_snapshot: Record<string, any>;
  merged_snapshot: Record<string, any>;
  result_snapshot: Record<string, any>;
  field_selections: Record<string, string> | null;
  confidence_score: number;
  similarity_signals: any;
  cluster_id: string;
}

interface MergeHistoryResponse {
  merges: MergeHistory[];
  total: number;
  page: number;
  limit: number;
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function MergeHistoryTab() {
  const [merges, setMerges] = useState<MergeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [restoring, setRestoring] = useState<string | null>(null);

  const loadMerges = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/dedup/merges?page=${page}&limit=${limit}`);
      if (!res.ok) {
        throw new Error('Failed to load merge history');
      }

      const data: MergeHistoryResponse = await res.json();
      setMerges(data.merges);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMerges();
  }, [page]);

  const handleRestore = async (mergeId: string) => {
    if (!confirm('Restore this merge? This will recreate the absorbed record as a new company in HubSpot. Associations (contacts, deals) will NOT be moved back automatically.')) {
      return;
    }

    setRestoring(mergeId);

    try {
      const res = await fetch(`/api/dedup/merges/${mergeId}/restore`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to restore merge');
      }

      const result = await res.json();
      alert(`Record restored successfully as HubSpot company ${result.newRecordId}`);
      loadMerges(); // Reload history
    } catch (err) {
      alert(`Failed to restore: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRestoring(null);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const formatSignals = (signals: any) => {
    if (!signals || !Array.isArray(signals)) return '—';
    return signals
      .map((s: any) => s.type)
      .join(', ');
  };

  const getCompanyName = (snapshot: Record<string, any>) => {
    return snapshot?.name || 'Unknown';
  };

  if (loading && merges.length === 0) {
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
            <RefreshCw size={16} style={{ marginRight: 8, animation: 'spin 1s linear infinite' }} />
            Loading merge history...
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
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: 0 }}>
            Merge History
          </h2>
          <p style={{ fontSize: 13, color: C.text2, margin: '4px 0 0 0' }}>
            Audit trail of all merge operations with rollback capability
          </p>
        </div>
        <GhostBtn onClick={loadMerges} disabled={loading}>
          <RefreshCw size={14} style={{ marginRight: 6 }} />
          Refresh
        </GhostBtn>
      </div>

      {/* Table */}
      <Card>
        {merges.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: C.text2,
              fontSize: 13,
            }}
          >
            No merge history found. Merged records will appear here.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ ...tableHeaderStyle, width: '15%' }}>Date</th>
                    <th style={{ ...tableHeaderStyle, width: '20%' }}>Merged</th>
                    <th style={{ ...tableHeaderStyle, width: '20%' }}>Into</th>
                    <th style={{ ...tableHeaderStyle, width: '10%' }}>Method</th>
                    <th style={{ ...tableHeaderStyle, width: '20%' }}>Signals</th>
                    <th style={{ ...tableHeaderStyle, width: '15%', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {merges.map((merge) => (
                    <tr
                      key={merge.id}
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      <td style={tableCellStyle}>
                        <div style={{ fontSize: 12, color: C.text2 }}>
                          {formatDate(merge.merged_at)}
                        </div>
                      </td>
                      <td style={tableCellStyle}>
                        <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                          {getCompanyName(merge.merged_snapshot)}
                        </div>
                        <div style={{ fontSize: 11, color: C.text3, marginTop: 2, fontFamily: F.mono }}>
                          {merge.merged_record_id}
                        </div>
                      </td>
                      <td style={tableCellStyle}>
                        <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                          {getCompanyName(merge.survivor_snapshot)}
                        </div>
                        <div style={{ fontSize: 11, color: C.text3, marginTop: 2, fontFamily: F.mono }}>
                          {merge.survivor_record_id}
                        </div>
                      </td>
                      <td style={tableCellStyle}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 500,
                            textTransform: 'capitalize',
                            background: merge.merge_method === 'manual' ? '#eff6ff' : '#f0fdf4',
                            color: merge.merge_method === 'manual' ? '#1e40af' : '#15803d',
                          }}
                        >
                          {merge.merge_method}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <div style={{ fontSize: 12, color: C.text2 }}>
                          {formatSignals(merge.similarity_signals)}
                        </div>
                        <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                          {merge.confidence_score}% confidence
                        </div>
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                        <GhostBtn
                          onClick={() => handleRestore(merge.id)}
                          disabled={restoring === merge.id}
                          style={{ fontSize: 12, padding: '4px 10px' }}
                        >
                          <RotateCcw size={12} style={{ marginRight: 4 }} />
                          {restoring === merge.id ? 'Restoring...' : 'Restore'}
                        </GhostBtn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > limit && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  borderTop: `1px solid ${C.border}`,
                  fontSize: 13,
                  color: C.text2,
                }}
              >
                <div>
                  Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total} merges
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <GhostBtn
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{ fontSize: 12, padding: '4px 12px' }}
                  >
                    Previous
                  </GhostBtn>
                  <GhostBtn
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * limit >= total}
                    style={{ fontSize: 12, padding: '4px 12px' }}
                  >
                    Next
                  </GhostBtn>
                </div>
              </div>
            )}
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
