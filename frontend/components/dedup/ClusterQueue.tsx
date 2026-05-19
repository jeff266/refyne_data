'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, GhostBtn, PrimaryBtn } from '@/components/refyne';
import { ScanningState } from './ScanningState';
import type { DedupCluster, ClustersCounts } from '@/lib/dedup/cluster-types';
import type { PairGrade } from '@/lib/dedup/types';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const GRADE_COLORS: Record<PairGrade, { bg: string; text: string; border: string }> = {
  A: { bg: '#10b98115', text: '#10b981', border: '#10b98130' },
  B: { bg: '#3b82f615', text: '#3b82f6', border: '#3b82f630' },
  C: { bg: '#f59e0b15', text: '#f59e0b', border: '#f59e0b30' },
  D: { bg: '#ef444415', text: '#ef4444', border: '#ef444430' },
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'merged', label: 'Merged' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'skipped', label: 'Skipped' },
] as const;

const PER_PAGE_OPTIONS = [
  { value: '20', label: '20 per page' },
  { value: '50', label: '50 per page' },
  { value: '100', label: '100 per page' },
] as const;

const SIZE_OPTIONS = [
  { value: 'all', label: 'All sizes' },
  { value: '2', label: '2 records' },
  { value: '3', label: '3 records' },
  { value: '4', label: '4 records' },
  { value: '5+', label: '5+ records' },
] as const;

// ─────────────────────────────────────────────────────────────
// Utility Components
// ─────────────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade: PairGrade }) {
  const colors = GRADE_COLORS[grade];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: F.mono,
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      {grade}
    </span>
  );
}

function GradePill({
  grade,
  count,
  selected,
  onClick,
}: {
  grade: PairGrade | 'all';
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  const isAll = grade === 'all';
  const colors = isAll
    ? { bg: C.hover, text: C.text2, border: C.border2 }
    : GRADE_COLORS[grade];

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        background: selected ? colors.bg : 'transparent',
        color: selected ? colors.text : C.text3,
        border: `1px solid ${selected ? colors.border : C.border}`,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {isAll ? 'All' : grade}
      <span
        style={{
          fontFamily: F.mono,
          fontSize: 11,
          opacity: 0.8,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function SelectDropdown<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      style={{
        padding: '6px 10px',
        fontSize: 12,
        color: C.text2,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        cursor: 'pointer',
        outline: 'none',
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function RecordCountBadge({ count }: { count: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontFamily: F.mono,
        color: C.text3,
        background: C.hover,
        padding: '3px 8px',
        borderRadius: 4,
        border: `1px solid ${C.border}`,
      }}
    >
      {count} records
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

interface ClusterQueueProps {
  orgId?: string;
}

export function ClusterQueue({ orgId = 'default' }: ClusterQueueProps) {
  const router = useRouter();

  // Data state
  const [clusters, setClusters] = useState<DedupCluster[]>([]);
  const [counts, setCounts] = useState<ClustersCounts>({
    byGrade: { A: 0, B: 0, C: 0, D: 0 },
    byStatus: { pending: 0, merged: 0, rejected: 0, skipped: 0 },
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [gradeFilter, setGradeFilter] = useState<PairGrade | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'merged' | 'rejected' | 'skipped'>('pending');
  const [sizeFilter, setSizeFilter] = useState<'all' | '2' | '3' | '4' | '5+'>('all');
  const [view, setView] = useState<'compact' | 'expanded'>('compact');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Company data for expanded view
  const [companyData, setCompanyData] = useState<
    Record<
      string,
      {
        name: string;
        domain?: string;
        phone?: string;
        website?: string;
        lifecyclestage?: string;
      }
    >
  >({});

  // Selection state for bulk merge
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Action state
  const [bulkMergeLoading, setBulkMergeLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────
  // Fetch clusters
  // ─────────────────────────────────────────────────────────────

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (gradeFilter !== 'all') params.set('grade', gradeFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (sizeFilter !== 'all') params.set('size', sizeFilter);
      params.set('page', String(page));
      params.set('per_page', String(perPage));

      const res = await fetch(`/api/dedup/clusters?${params}`, {
        headers: { 'x-org-id': orgId },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch clusters');
      }

      const data = await res.json();
      setClusters(data.clusters);
      setCounts(data.counts);
      setTotal(data.total);

      // If expanded view, fetch company names
      if (view === 'expanded' && data.clusters.length > 0) {
        const allRecordIds = new Set<string>();
        data.clusters.forEach((c: DedupCluster) =>
          c.recordIds.forEach((id: string) => allRecordIds.add(id))
        );

        // Fetch company names
        const namesRes = await fetch('/api/hubspot/companies/batch-names', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-org-id': orgId,
          },
          body: JSON.stringify({ ids: Array.from(allRecordIds) }),
        });

        if (namesRes.ok) {
          const namesData = await namesRes.json();
          setCompanyData(namesData.companies);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch clusters');
    } finally {
      setLoading(false);
    }
  }, [orgId, gradeFilter, statusFilter, sizeFilter, page, perPage, view]);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  // ─────────────────────────────────────────────────────────────
  // Action handlers
  // ─────────────────────────────────────────────────────────────

  const handleBulkMerge = async () => {
    if (selectedIds.size === 0) return;
    setBulkMergeLoading(true);
    try {
      const res = await fetch('/api/dedup/clusters/bulk-merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': orgId,
        },
        body: JSON.stringify({ clusterIds: Array.from(selectedIds) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to merge clusters');
      }

      const result = await res.json();
      console.log(`[Bulk Merge] Merged ${result.merged} clusters`);

      setSelectedIds(new Set());
      fetchClusters();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge clusters');
    } finally {
      setBulkMergeLoading(false);
    }
  };

  const handleRunScan = async () => {
    setScanLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dedup/scan', {
        method: 'POST',
        headers: { 'x-org-id': orgId },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start scan');
      }

      const data = await res.json();
      console.log(`[Dedup] Scan enqueued: jobId=${data.jobId}`);

      // Show scanning UI
      setActiveJobId(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scan');
    } finally {
      setScanLoading(false);
    }
  };

  const handleScanComplete = () => {
    setActiveJobId(null);
    fetchClusters();
  };

  // ─────────────────────────────────────────────────────────────
  // Computed values
  // ─────────────────────────────────────────────────────────────

  const totalGradeCount =
    counts.byGrade.A + counts.byGrade.B + counts.byGrade.C + counts.byGrade.D;
  const gradeAClusters = clusters.filter((c) => c.grade === 'A' && c.status === 'pending');

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Show scanning state when job is active */}
      {activeJobId && (
        <ScanningState jobId={activeJobId} orgId={orgId} onComplete={handleScanComplete} />
      )}

      {/* Show normal review queue when not scanning */}
      {!activeJobId && (
        <>
          {/* Grade pills */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <GradePill
              grade="all"
              count={totalGradeCount}
              selected={gradeFilter === 'all'}
              onClick={() => {
                setGradeFilter('all');
                setPage(1);
              }}
            />
            {(['A', 'B', 'C', 'D'] as PairGrade[]).map((g) => (
              <GradePill
                key={g}
                grade={g}
                count={counts.byGrade[g]}
                selected={gradeFilter === g}
                onClick={() => {
                  setGradeFilter(g);
                  setPage(1);
                }}
              />
            ))}
          </div>

          {/* Filter bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <SelectDropdown
                value={statusFilter}
                options={STATUS_OPTIONS}
                onChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              />
              <SelectDropdown
                value={sizeFilter}
                options={SIZE_OPTIONS}
                onChange={(v) => {
                  setSizeFilter(v);
                  setPage(1);
                }}
              />
              <button
                onClick={() => setView((v) => (v === 'compact' ? 'expanded' : 'compact'))}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  background: C.hover,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.text2,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {view === 'compact' ? '📋 Compact' : '📖 Expanded'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {gradeAClusters.length > 0 && selectedIds.size === 0 && (
                <PrimaryBtn
                  onClick={() => {
                    const ids = new Set(gradeAClusters.map((c) => c.id));
                    setSelectedIds(ids);
                  }}
                >
                  Select all Grade A ({gradeAClusters.length})
                </PrimaryBtn>
              )}
              {selectedIds.size > 0 && (
                <>
                  <GhostBtn onClick={() => setSelectedIds(new Set())}>
                    Clear selection
                  </GhostBtn>
                  <PrimaryBtn onClick={handleBulkMerge} disabled={bulkMergeLoading}>
                    {bulkMergeLoading ? 'Merging...' : `Bulk merge ${selectedIds.size}`}
                  </PrimaryBtn>
                </>
              )}
              {selectedIds.size === 0 && (
                <>
                  <PrimaryBtn onClick={handleRunScan} disabled={scanLoading || loading}>
                    {scanLoading ? 'Scanning...' : 'Run scan'}
                  </PrimaryBtn>
                  <GhostBtn onClick={fetchClusters} disabled={loading}>
                    <RefreshCw size={12} style={{ marginRight: 4 }} />
                    Refresh
                  </GhostBtn>
                </>
              )}
            </div>
          </div>

          {/* Error state */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 12,
                marginBottom: 16,
                background: `${C.red}15`,
                border: `1px solid ${C.red}30`,
                borderRadius: 8,
                color: C.red,
                fontSize: 13,
              }}
            >
              <AlertCircle size={14} />
              {error}
              <button
                onClick={() => setError(null)}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: C.red,
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Main table */}
          <Card>
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 80px 1fr 120px',
                gap: 0,
                borderBottom: `1px solid ${C.border}`,
                padding: '10px 20px',
                alignItems: 'center',
              }}
            >
              <div></div>
              <div style={{ fontSize: 11, color: C.text3, fontWeight: 500 }}>Grade</div>
              <div style={{ fontSize: 11, color: C.text3, fontWeight: 500 }}>Cluster</div>
              <div style={{ fontSize: 11, color: C.text3, fontWeight: 500 }}>Size</div>
            </div>

            {/* Loading state */}
            {loading && (
              <div style={{ padding: 40, textAlign: 'center', color: C.text3 }}>
                Loading clusters...
              </div>
            )}

            {/* Empty state */}
            {!loading && clusters.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: C.text2, marginBottom: 8 }}>
                  No duplicate clusters found
                </div>
                <div style={{ fontSize: 12, color: C.text3 }}>
                  {gradeFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Run a dedup scan to find potential duplicates'}
                </div>
              </div>
            )}

            {/* Cluster rows */}
            {!loading &&
              clusters.map((cluster) => (
                <div
                  key={cluster.id}
                  onClick={() => router.push(`/dedup/clusters/${cluster.id}`)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 80px 1fr 120px',
                    gap: 0,
                    padding: '12px 20px',
                    borderBottom: `1px solid ${C.border}`,
                    cursor: 'pointer',
                    background: selectedIds.has(cluster.id) ? C.indigoDim : 'transparent',
                    alignItems: 'center',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedIds.has(cluster.id)) {
                      e.currentTarget.style.background = C.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedIds.has(cluster.id)) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {/* Checkbox (Grade A only) */}
                  <div
                    onClick={(e) => {
                      if (cluster.grade === 'A' && cluster.status === 'pending') {
                        e.stopPropagation();
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(cluster.id)) {
                            next.delete(cluster.id);
                          } else {
                            next.add(cluster.id);
                          }
                          return next;
                        });
                      }
                    }}
                  >
                    {cluster.grade === 'A' && cluster.status === 'pending' && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(cluster.id)}
                        onChange={() => {}}
                        style={{ cursor: 'pointer' }}
                      />
                    )}
                  </div>

                  {/* Grade */}
                  <div>
                    <GradeBadge grade={cluster.grade} />
                  </div>

                  {/* Cluster info */}
                  <div>
                    {view === 'expanded' ? (
                      <>
                        <div
                          style={{
                            color: C.text,
                            fontWeight: 500,
                            fontSize: 12,
                            marginBottom: 8,
                          }}
                        >
                          Cluster {cluster.id.slice(0, 8)}
                        </div>
                        {/* Mini table with key fields */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '180px 120px 100px 120px 120px',
                            gap: 8,
                            marginBottom: 4,
                          }}
                        >
                          {/* Header row */}
                          <div style={{ fontSize: 9, color: C.text3, fontWeight: 600, textTransform: 'uppercase' }}>
                            Company Name
                          </div>
                          <div style={{ fontSize: 9, color: C.text3, fontWeight: 600, textTransform: 'uppercase' }}>
                            Domain
                          </div>
                          <div style={{ fontSize: 9, color: C.text3, fontWeight: 600, textTransform: 'uppercase' }}>
                            Phone
                          </div>
                          <div style={{ fontSize: 9, color: C.text3, fontWeight: 600, textTransform: 'uppercase' }}>
                            Website
                          </div>
                          <div style={{ fontSize: 9, color: C.text3, fontWeight: 600, textTransform: 'uppercase' }}>
                            Lifecycle Stage
                          </div>

                          {/* Data rows */}
                          {cluster.recordIds.slice(0, 3).map((id, idx) => {
                            const company = companyData[id];
                            if (!company) return null;

                            const isMaster = idx === 0; // First record is the suggested master

                            return (
                              <>
                                <div
                                  key={`${id}-name`}
                                  style={{
                                    fontSize: 11,
                                    color: isMaster ? C.text : C.text2,
                                    fontWeight: isMaster ? 600 : 400,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                  title={company.name}
                                >
                                  {isMaster && (
                                    <span
                                      style={{
                                        fontSize: 10,
                                        color: C.green,
                                        fontWeight: 600,
                                      }}
                                      title="Surviving record (based on survivorship strategy)"
                                    >
                                      ★
                                    </span>
                                  )}
                                  {company.name}
                                </div>
                                <div
                                  key={`${id}-domain`}
                                  style={{
                                    fontSize: 11,
                                    color: isMaster ? C.text : C.text3,
                                    fontWeight: isMaster ? 600 : 400,
                                    fontFamily: F.mono,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={company.domain}
                                >
                                  {company.domain || '—'}
                                </div>
                                <div
                                  key={`${id}-phone`}
                                  style={{
                                    fontSize: 11,
                                    color: isMaster ? C.text : C.text3,
                                    fontWeight: isMaster ? 600 : 400,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={company.phone}
                                >
                                  {company.phone || '—'}
                                </div>
                                <div
                                  key={`${id}-website`}
                                  style={{
                                    fontSize: 11,
                                    color: isMaster ? C.text : C.text3,
                                    fontWeight: isMaster ? 600 : 400,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={company.website}
                                >
                                  {company.website || '—'}
                                </div>
                                <div
                                  key={`${id}-lifecycle`}
                                  style={{
                                    fontSize: 11,
                                    color: isMaster ? C.text : C.text3,
                                    fontWeight: isMaster ? 600 : 400,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={company.lifecyclestage}
                                >
                                  {company.lifecyclestage || '—'}
                                </div>
                              </>
                            );
                          })}
                        </div>
                        {/* See more link */}
                        <div
                          style={{
                            fontSize: 11,
                            color: C.indigo,
                            marginTop: 4,
                            cursor: 'pointer',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dedup/clusters/${cluster.id}`);
                          }}
                        >
                          See more →
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          style={{
                            color: C.text,
                            fontWeight: 500,
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          Cluster {cluster.id.slice(0, 8)}
                        </div>
                        <div style={{ fontSize: 11, color: C.text3 }}>
                          {cluster.recordIds.length} companies
                        </div>
                      </>
                    )}
                  </div>

                  {/* Size badge */}
                  <div>
                    <RecordCountBadge count={cluster.recordIds.length} />
                  </div>
                </div>
              ))}

            {/* Pagination */}
            {!loading && total > perPage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 20px',
                  borderTop: `1px solid ${C.border}`,
                }}
              >
                <div style={{ fontSize: 12, color: C.text3 }}>
                  Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)} of{' '}
                  {total}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <SelectDropdown
                    value={String(perPage)}
                    options={PER_PAGE_OPTIONS}
                    onChange={(v) => {
                      setPerPage(Number(v));
                      setPage(1);
                    }}
                  />
                  <GhostBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                    Previous
                  </GhostBtn>
                  <GhostBtn
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * perPage >= total}
                  >
                    Next
                  </GhostBtn>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
