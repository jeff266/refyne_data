'use client';

import { useState, useEffect } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card, PrimaryBtn, GhostBtn } from '@/components/refyne';

interface ComplianceRecord {
  recordId: string;
  companyName: string | null;
  domain: string | null;
  currentValue: string | null;
  hubspotId: string;
  portalId: string;
}

interface InsightsSlideOverProps {
  harmonyId: string;
  harmonyName: string;
  recordCount: number;
  isOpen: boolean;
  onClose: () => void;
}

export function InsightsSlideOver({ harmonyId, harmonyName, recordCount, isOpen, onClose }: InsightsSlideOverProps) {
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [topPattern, setTopPattern] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchRecords();
    }
  }, [isOpen, harmonyId, page]);

  async function fetchRecords() {
    try {
      const res = await fetch(`/api/compliance/records?harmonyId=${harmonyId}&status=unmatched&page=${page}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setTopPattern(data.topPattern);
        setHasMore(data.hasMore);
      }
    } catch (error) {
      console.error('Failed to fetch records:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportCSV() {
    // In production, would implement CSV export
    alert('CSV export coming soon');
  }

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 998,
        }}
        onClick={onClose}
      />

      {/* Slide-over */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '500px',
          maxWidth: '90vw',
          background: C.bg,
          borderLeft: `1px solid ${C.border}`,
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 12px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              {recordCount} records — {harmonyName} unmatched
            </div>
            {topPattern && (
              <div style={{ fontSize: 12, color: C.text3 }}>
                {topPattern}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <GhostBtn onClick={handleExportCSV} style={{ fontSize: 11, padding: '4px 10px' }}>
              Export CSV
            </GhostBtn>
            <button
              onClick={onClose}
              style={{
                padding: 6,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: C.text3,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {topPattern && (
            <div
              style={{
                padding: '12px 16px',
                background: C.indigoDim,
                border: `1px solid ${C.indigoBrd}`,
                borderRadius: 8,
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 6 }}>
                Suggested fix
              </div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 12 }}>
                Add the most common value as a canonical option in the {harmonyName} harmony.
              </div>
              <PrimaryBtn
                onClick={() => window.location.href = `/harmonies?harmony=${harmonyId}`}
                style={{ width: '100%', fontSize: 11 }}
              >
                Add to harmony →
              </PrimaryBtn>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <select
              style={{
                padding: '6px 10px',
                background: C.surface,
                border: `1px solid ${C.border2}`,
                borderRadius: 6,
                color: C.text,
                fontSize: 11,
                fontFamily: F.sans,
              }}
            >
              <option>All unmatched</option>
              <option>Stale only</option>
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.text3 }}>
              Loading records...
            </div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.text3 }}>
              No records found
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ padding: '8px 0', textAlign: 'left', fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'uppercase' }}>
                      Company
                    </th>
                    <th style={{ padding: '8px 0', textAlign: 'left', fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'uppercase' }}>
                      Current value
                    </th>
                    <th style={{ padding: '8px 0', textAlign: 'left', fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'uppercase' }}>
                      Portal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.recordId} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '10px 0', fontSize: 12, color: C.text }}>
                        {record.companyName || record.recordId}
                      </td>
                      <td style={{ padding: '10px 0', fontSize: 11, fontFamily: F.mono, color: C.text3 }}>
                        {record.currentValue || '—'}
                      </td>
                      <td style={{ padding: '10px 0', fontSize: 11, color: C.text3 }}>
                        {record.portalId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: 20 }}>
                  <GhostBtn onClick={() => setPage(page + 1)}>
                    Load more
                  </GhostBtn>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
