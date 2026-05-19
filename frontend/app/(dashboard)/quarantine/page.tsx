'use client';

import { useEffect, useState } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card, PrimaryBtn, GhostBtn } from '@/components/refyne';

interface QuarantineRecord {
  id: string;
  org_id: string;
  submitted_by: string;
  submitted_name: string | null;
  record_data: any;
  source: string;
  duplicate_of: string | null;
  confidence: number | null;
  signals_fired: any;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_note: string | null;
  created_at: string;
  portalId?: string;
}

interface Stats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

export default function QuarantinePage() {
  const [records, setRecords] = useState<QuarantineRecord[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedRecord, setSelectedRecord] = useState<QuarantineRecord | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');

  useEffect(() => {
    loadRecords();
  }, [filter]);

  async function loadRecords() {
    try {
      const url = filter === 'all' ? '/api/quarantine' : `/api/quarantine?status=${filter}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load records');
      const data = await res.json();
      setRecords(data.records || []);
      setStats(data.stats || { pending: 0, approved: 0, rejected: 0, total: 0 });
    } catch (err) {
      console.error('Failed to load records:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    if (!confirm('Approve this record and push to HubSpot?')) return;

    try {
      const res = await fetch(`/api/quarantine/${id}/approve`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to approve');
      }

      await loadRecords();
      setSelectedRecord(null);
      alert('Record approved and pushed to HubSpot');
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleReject(id: string) {
    try {
      const res = await fetch(`/api/quarantine/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: rejectionNote }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reject');
      }

      await loadRecords();
      setSelectedRecord(null);
      setRejectionNote('');
      alert('Record rejected');
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: F.sans }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 4 }}>Quarantine</h1>
        <p style={{ fontSize: 13, color: C.text3 }}>Review records flagged as potential duplicates</p>
      </div>

      {/* Stats Banner */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <StatCard label="Pending" value={stats.pending} color={C.yellow} />
        <StatCard label="Approved" value={stats.approved} color={C.green} />
        <StatCard label="Rejected" value={stats.rejected} color={C.red} />
        <StatCard label="Total" value={stats.total} color={C.text3} />
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <FilterTab active={filter === 'pending'} onClick={() => setFilter('pending')}>
          Pending ({stats.pending})
        </FilterTab>
        <FilterTab active={filter === 'approved'} onClick={() => setFilter('approved')}>
          Approved ({stats.approved})
        </FilterTab>
        <FilterTab active={filter === 'rejected'} onClick={() => setFilter('rejected')}>
          Rejected ({stats.rejected})
        </FilterTab>
        <FilterTab active={filter === 'all'} onClick={() => setFilter('all')}>
          All ({stats.total})
        </FilterTab>
      </div>

      {/* Records Table */}
      {loading ? (
        <div style={{ color: C.text3, fontSize: 13 }}>Loading records...</div>
      ) : records.length === 0 ? (
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.text3 }}>No records in quarantine</div>
        </Card>
      ) : (
        <Card>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.text3 }}>
                    Company
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.text3 }}>
                    Source
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.text3 }}>
                    Duplicate Of
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.text3 }}>
                    Confidence
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.text3 }}>
                    Submitted
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: C.text3 }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '12px 16px' }}>
                      {record.portalId && record.record_data?.hubspot_id ? (
                        <a
                          href={`https://app.hubspot.com/contacts/${record.portalId}/company/${record.record_data.hubspot_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: C.indigo,
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>
                              {record.record_data?.name || record.record_data?.domain || 'Unknown'}
                            </div>
                            <div style={{ fontSize: 12, color: C.text3 }}>{record.record_data?.domain}</div>
                          </div>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, marginTop: -10 }}>
                            <path
                              d="M10 6.5V10C10 10.2652 9.89464 10.5196 9.70711 10.7071C9.51957 10.8946 9.26522 11 9 11H2C1.73478 11 1.48043 10.8946 1.29289 10.7071C1.10536 10.5196 1 10.2652 1 10V3C1 2.73478 1.10536 2.48043 1.29289 2.29289C1.48043 2.10536 1.73478 2 2 2H5.5M8 1H11M11 1V4M11 1L5.5 6.5"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </a>
                      ) : (
                        <div>
                          <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                            {record.record_data?.name || record.record_data?.domain || 'Unknown'}
                          </div>
                          <div style={{ fontSize: 12, color: C.text3 }}>{record.record_data?.domain}</div>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          background: C.surface,
                          borderRadius: 4,
                          color: C.text,
                        }}
                      >
                        {record.source}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 12, color: C.text3, fontFamily: F.mono }}>
                        {record.duplicate_of ? record.duplicate_of.slice(0, 8) : '-'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, color: C.text }}>
                        {record.confidence ? `${Math.round(record.confidence)}%` : '-'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 12, color: C.text3 }}>
                        {new Date(record.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {record.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <PrimaryBtn onClick={() => handleApprove(record.id)}>Approve</PrimaryBtn>
                          <GhostBtn onClick={() => setSelectedRecord(record)}>Reject</GhostBtn>
                        </div>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            padding: '4px 10px',
                            background: record.status === 'approved' ? C.green + '20' : C.red + '20',
                            color: record.status === 'approved' ? C.green : C.red,
                            borderRadius: 4,
                          }}
                        >
                          {record.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Rejection Modal */}
      {selectedRecord && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedRecord(null)}
        >
          <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <Card style={{ width: 480, padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 16 }}>
              Reject Record
            </h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: C.text3, marginBottom: 6, display: 'block' }}>
                Rejection Note (optional)
              </label>
              <textarea
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                placeholder="Reason for rejection..."
                style={{
                  width: '100%',
                  minHeight: 80,
                  padding: '8px 12px',
                  background: C.surface,
                  border: `1px solid ${C.border2}`,
                  borderRadius: 6,
                  color: C.text,
                  fontFamily: F.sans,
                  fontSize: 13,
                  resize: 'vertical',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <GhostBtn onClick={() => setSelectedRecord(null)}>Cancel</GhostBtn>
              <PrimaryBtn onClick={() => handleReject(selectedRecord.id)}>Confirm Rejection</PrimaryBtn>
            </div>
          </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card style={{ flex: 1, padding: '16px 20px' }}>
      <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color }}>{value}</div>
    </Card>
  );
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? C.indigo + '20' : 'transparent',
        border: `1px solid ${active ? C.indigo : C.border}`,
        borderRadius: 6,
        padding: '6px 14px',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        color: active ? C.indigo : C.text3,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {children}
    </button>
  );
}
