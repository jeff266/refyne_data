'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, Check, ExternalLink, X, AlertCircle, RefreshCw } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, GhostBtn, PrimaryBtn } from '@/components/refyne';
import type {
  DedupPair,
  PairGrade,
  PairStatus,
  PairsCounts,
  FiredSignal,
  FieldSelection,
} from '@/lib/dedup/types';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const HUBSPOT_PORTAL_ID = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID || '49169539';

function getHubSpotUrl(hubspotId: string): string {
  return `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-1/${hubspotId}`;
}

const GRADE_COLORS: Record<PairGrade, { bg: string; text: string; border: string }> = {
  A: { bg: '#10b98115', text: '#10b981', border: '#10b98130' },
  B: { bg: '#3b82f615', text: '#3b82f6', border: '#3b82f630' },
  C: { bg: '#f59e0b15', text: '#f59e0b', border: '#f59e0b30' },
  D: { bg: '#ef444415', text: '#ef4444', border: '#ef444430' },
};

const SORT_OPTIONS = [
  { value: 'confidence_desc', label: 'Confidence (high first)' },
  { value: 'confidence_asc', label: 'Confidence (low first)' },
  { value: 'detected_asc', label: 'Oldest first' },
] as const;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suppressed', label: 'Suppressed' },
  { value: 'merged', label: 'Merged' },
] as const;

// ─────────────────────────────────────────────────────────────
// Utility Components
// ─────────────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade: PairGrade }) {
  const colors = GRADE_COLORS[grade];
  return (
    <span style={{
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
    }}>
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
  const colors = isAll ? { bg: C.hover, text: C.text2, border: C.border2 } : GRADE_COLORS[grade];

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
      <span style={{
        fontFamily: F.mono,
        fontSize: 11,
        opacity: 0.8,
      }}>
        {count}
      </span>
    </button>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const col = value >= 90 ? C.green : value >= 75 ? C.amber : C.red;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ height: 3, width: 44, background: C.hover, borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${value}%`, background: col, borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: F.mono, fontSize: 11, color: col, fontWeight: 500 }}>{value}%</span>
    </div>
  );
}

function RecordLink({ hubspotId, showIcon = true }: { hubspotId: string; showIcon?: boolean }) {
  const url = getHubSpotUrl(hubspotId);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: F.mono,
        fontSize: 10,
        color: C.indigoLt,
        textDecoration: 'none',
        padding: '2px 6px',
        background: C.indigoDim,
        borderRadius: 4,
        border: `1px solid ${C.indigoBrd}`,
      }}
    >
      {hubspotId}
      {showIcon && <ExternalLink size={9} />}
    </a>
  );
}

function SignalTag({ signal }: { signal: FiredSignal }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 10,
      fontFamily: F.mono,
      color: signal.deterministic ? C.green : C.text3,
      background: signal.deterministic ? `${C.green}15` : C.hover,
      padding: '2px 6px',
      borderRadius: 4,
      border: `1px solid ${signal.deterministic ? `${C.green}30` : C.border}`,
    }}>
      {signal.type}
      {signal.deterministic && <Check size={8} />}
    </span>
  );
}

function Checkbox({
  checked,
  onChange,
  indeterminate = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  indeterminate?: boolean;
}) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      style={{
        width: 16,
        height: 16,
        borderRadius: 4,
        border: `2px solid ${checked || indeterminate ? C.indigo : C.border2}`,
        background: checked || indeterminate ? C.indigo : 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {checked && <Check size={10} color="#fff" strokeWidth={3} />}
      {indeterminate && !checked && (
        <div style={{ width: 8, height: 2, background: '#fff', borderRadius: 1 }} />
      )}
    </div>
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

// ─────────────────────────────────────────────────────────────
// Selection Bar
// ─────────────────────────────────────────────────────────────

interface SelectionBarProps {
  selectedCount: number;
  onBulkApprove: () => void;
  onBulkReject: () => void;
  onClearSelection: () => void;
  loading: boolean;
}

function SelectionBar({
  selectedCount,
  onBulkApprove,
  onBulkReject,
  onClearSelection,
  loading,
}: SelectionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 16px',
      background: C.indigoDim,
      borderRadius: 8,
      marginBottom: 12,
      border: `1px solid ${C.indigoBrd}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
          {selectedCount} selected
        </span>
        <button
          onClick={onClearSelection}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            color: C.text3,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <X size={12} /> Clear
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <GhostBtn onClick={onBulkReject} disabled={loading}>
          Reject all
        </GhostBtn>
        <PrimaryBtn onClick={onBulkApprove} disabled={loading}>
          {loading ? 'Processing...' : `Approve ${selectedCount}`}
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Detail Panel (Accordion Content)
// ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  pair: DedupPair;
  recordAData: Record<string, unknown> | null;
  recordBData: Record<string, unknown> | null;
  onApprove: (fieldSelections?: Record<string, FieldSelection>) => void;
  onReject: () => void;
  onSkip: () => void;
  loading: boolean;
}

function DetailPanel({
  pair,
  recordAData,
  recordBData,
  onApprove,
  onReject,
  onSkip,
  loading,
}: DetailPanelProps) {
  // Core fields to display
  const DISPLAY_FIELDS = [
    { key: 'name', label: 'Name' },
    { key: 'domain', label: 'Domain' },
    { key: 'industry', label: 'Industry' },
    { key: 'phone', label: 'Phone' },
    { key: 'numberofemployees', label: 'Employees' },
    { key: 'city', label: 'City' },
    { key: 'website', label: 'Website' },
  ];

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined || val === '') return '—';
    return String(val);
  };

  return (
    <div style={{ padding: '20px 24px', background: C.bg, borderTop: `1px solid ${C.border}` }}>
      {/* Loading state */}
      {(!recordAData || !recordBData) && (
        <div style={{ padding: 20, textAlign: 'center', color: C.text3 }}>
          Loading record details...
        </div>
      )}

      {recordAData && recordBData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Record A */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
              fontSize: 11,
              color: C.text3,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}>
              Record A
              <RecordLink hubspotId={pair.recordAId} />
            </div>
            {DISPLAY_FIELDS.map(({ key, label }) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: C.text3, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, fontFamily: F.mono, color: C.text }}>
                  {formatValue(recordAData[key])}
                </div>
              </div>
            ))}
          </div>

          {/* Record B */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
              fontSize: 11,
              color: C.text3,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}>
              Record B
              <RecordLink hubspotId={pair.recordBId} />
            </div>
            {DISPLAY_FIELDS.map(({ key, label }) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: C.text3, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, fontFamily: F.mono, color: C.text2 }}>
                  {formatValue(recordBData[key])}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signals */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, color: C.text3, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>
          Matching signals
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {pair.signalsFired.map((sig, i) => (
            <SignalTag key={i} signal={sig} />
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
        <PrimaryBtn onClick={() => onApprove()} disabled={loading}>
          Merge →
        </PrimaryBtn>
        <GhostBtn onClick={onReject} disabled={loading}>
          Not a Duplicate
        </GhostBtn>
        <GhostBtn onClick={onSkip} disabled={loading}>
          Skip
        </GhostBtn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

interface ReviewQueueProps {
  orgId?: string;
}

export function ReviewQueue({ orgId = 'default' }: ReviewQueueProps) {
  // Data state
  const [pairs, setPairs] = useState<DedupPair[]>([]);
  const [counts, setCounts] = useState<PairsCounts>({
    byGrade: { A: 0, B: 0, C: 0, D: 0 },
    byStatus: { pending: 0, approved: 0, rejected: 0, suppressed: 0, merged: 0, reversed: 0 },
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [gradeFilter, setGradeFilter] = useState<PairGrade | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<PairStatus | 'all'>('pending');
  const [sortBy, setSortBy] = useState<'confidence_desc' | 'confidence_asc' | 'detected_asc'>('confidence_desc');
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedRecordData, setExpandedRecordData] = useState<{
    a: Record<string, unknown> | null;
    b: Record<string, unknown> | null;
  }>({ a: null, b: null });

  // Action state
  const [actionLoading, setActionLoading] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // Fetch pairs
  // ─────────────────────────────────────────────────────────────

  const fetchPairs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (gradeFilter !== 'all') params.set('grade', gradeFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('sort', sortBy);
      params.set('page', String(page));
      params.set('per_page', String(perPage));

      const res = await fetch(`/api/dedup/pairs?${params}`, {
        headers: { 'x-org-id': orgId },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch pairs');
      }

      const data = await res.json();
      setPairs(data.pairs);
      setCounts(data.counts);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pairs');
    } finally {
      setLoading(false);
    }
  }, [orgId, gradeFilter, statusFilter, sortBy, page]);

  useEffect(() => {
    fetchPairs();
  }, [fetchPairs]);

  // ─────────────────────────────────────────────────────────────
  // Fetch expanded pair details
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!expandedId) {
      setExpandedRecordData({ a: null, b: null });
      return;
    }

    const fetchDetails = async () => {
      try {
        const res = await fetch(`/api/dedup/pairs/${expandedId}`, {
          headers: { 'x-org-id': orgId },
        });
        if (res.ok) {
          const data = await res.json();
          setExpandedRecordData({
            a: data.recordAData || null,
            b: data.recordBData || null,
          });
        }
      } catch {
        // Silently fail - will show loading state
      }
    };

    fetchDetails();
  }, [expandedId, orgId]);

  // ─────────────────────────────────────────────────────────────
  // Selection handlers
  // ─────────────────────────────────────────────────────────────

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(pairs.filter(p => p.status === 'pending').map(p => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [pairs]);

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Action handlers
  // ─────────────────────────────────────────────────────────────

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/dedup/pairs/bulk-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': orgId,
        },
        body: JSON.stringify({ pairIds: Array.from(selectedIds) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to approve pairs');
      }

      setSelectedIds(new Set());
      fetchPairs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve pairs');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/dedup/pairs/bulk-reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': orgId,
        },
        body: JSON.stringify({ pairIds: Array.from(selectedIds) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reject pairs');
      }

      setSelectedIds(new Set());
      fetchPairs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject pairs');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSingleApprove = async (id: string, fieldSelections?: Record<string, FieldSelection>) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/dedup/pairs/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': orgId,
        },
        body: JSON.stringify({ fieldSelections }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to approve pair');
      }

      setExpandedId(null);
      fetchPairs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve pair');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSingleReject = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/dedup/pairs/${id}/reject`, {
        method: 'POST',
        headers: { 'x-org-id': orgId },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reject pair');
      }

      setExpandedId(null);
      fetchPairs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject pair');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSkip = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/dedup/pairs/${id}/skip`, {
        method: 'POST',
        headers: { 'x-org-id': orgId },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to skip pair');
      }

      // Move to next pair
      const currentIndex = pairs.findIndex(p => p.id === id);
      if (currentIndex < pairs.length - 1) {
        setExpandedId(pairs[currentIndex + 1].id);
      } else {
        setExpandedId(null);
      }
      fetchPairs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to skip pair');
    } finally {
      setActionLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Computed values
  // ─────────────────────────────────────────────────────────────

  const pendingPairs = pairs.filter(p => p.status === 'pending');
  const allPendingSelected = pendingPairs.length > 0 && pendingPairs.every(p => selectedIds.has(p.id));
  const somePendingSelected = pendingPairs.some(p => selectedIds.has(p.id));
  const totalGradeCount = counts.byGrade.A + counts.byGrade.B + counts.byGrade.C + counts.byGrade.D;

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Grade pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <GradePill
          grade="all"
          count={totalGradeCount}
          selected={gradeFilter === 'all'}
          onClick={() => { setGradeFilter('all'); setPage(1); }}
        />
        {(['A', 'B', 'C', 'D'] as PairGrade[]).map(g => (
          <GradePill
            key={g}
            grade={g}
            count={counts.byGrade[g]}
            selected={gradeFilter === g}
            onClick={() => { setGradeFilter(g); setPage(1); }}
          />
        ))}
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <SelectDropdown
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={(v) => { setStatusFilter(v as PairStatus | 'all'); setPage(1); }}
          />
          <SelectDropdown
            value={sortBy}
            options={SORT_OPTIONS}
            onChange={(v) => { setSortBy(v); setPage(1); }}
          />
        </div>
        <GhostBtn onClick={fetchPairs} disabled={loading}>
          <RefreshCw size={12} style={{ marginRight: 4 }} />
          Refresh
        </GhostBtn>
      </div>

      {/* Selection bar */}
      <SelectionBar
        selectedCount={selectedIds.size}
        onBulkApprove={handleBulkApprove}
        onBulkReject={handleBulkReject}
        onClearSelection={() => setSelectedIds(new Set())}
        loading={actionLoading}
      />

      {/* Error state */}
      {error && (
        <div style={{
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
        }}>
          <AlertCircle size={14} />
          {error}
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.red }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main table */}
      <Card>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 40px 80px 1fr 1fr 160px 100px',
          gap: 0,
          borderBottom: `1px solid ${C.border}`,
          padding: '10px 20px',
          alignItems: 'center',
        }}>
          <div>
            <Checkbox
              checked={allPendingSelected}
              indeterminate={somePendingSelected && !allPendingSelected}
              onChange={handleSelectAll}
            />
          </div>
          <div />
          <div style={{ fontSize: 11, color: C.text3, fontWeight: 500 }}>Grade</div>
          <div style={{ fontSize: 11, color: C.text3, fontWeight: 500 }}>Record A</div>
          <div style={{ fontSize: 11, color: C.text3, fontWeight: 500 }}>Record B</div>
          <div style={{ fontSize: 11, color: C.text3, fontWeight: 500 }}>Signals</div>
          <div style={{ fontSize: 11, color: C.text3, fontWeight: 500 }}>Confidence</div>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: C.text3 }}>
            Loading pairs...
          </div>
        )}

        {/* Empty state */}
        {!loading && pairs.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: C.text2, marginBottom: 8 }}>
              No duplicate pairs found
            </div>
            <div style={{ fontSize: 12, color: C.text3 }}>
              {gradeFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Run a dedup scan to find potential duplicates'}
            </div>
          </div>
        )}

        {/* Pair rows */}
        {!loading && pairs.map((pair) => (
          <div key={pair.id}>
            {/* Collapsed row */}
            <div
              onClick={() => setExpandedId(expandedId === pair.id ? null : pair.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 40px 80px 1fr 1fr 160px 100px',
                gap: 0,
                padding: '12px 20px',
                borderBottom: expandedId === pair.id ? 'none' : `1px solid ${C.border}`,
                cursor: 'pointer',
                background: expandedId === pair.id ? C.surface : 'transparent',
                alignItems: 'center',
              }}
            >
              {/* Checkbox */}
              <div onClick={(e) => e.stopPropagation()}>
                {pair.status === 'pending' && (
                  <Checkbox
                    checked={selectedIds.has(pair.id)}
                    onChange={(checked) => handleSelectOne(pair.id, checked)}
                  />
                )}
              </div>

              {/* Expand toggle */}
              <div style={{ color: C.text3 }}>
                {expandedId === pair.id ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
              </div>

              {/* Grade */}
              <div>
                <GradeBadge grade={pair.grade} />
              </div>

              {/* Record A */}
              <div>
                <div style={{ color: C.text, fontWeight: 500, fontSize: 12, marginBottom: 2 }}>
                  {pair.recordAId}
                </div>
              </div>

              {/* Record B */}
              <div>
                <div style={{ color: C.text2, fontSize: 12, marginBottom: 2 }}>
                  {pair.recordBId}
                </div>
              </div>

              {/* Signals */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {pair.signalsFired.slice(0, 2).map((sig, i) => (
                  <SignalTag key={i} signal={sig} />
                ))}
                {pair.signalsFired.length > 2 && (
                  <span style={{ fontSize: 10, color: C.text3 }}>
                    +{pair.signalsFired.length - 2}
                  </span>
                )}
              </div>

              {/* Confidence */}
              <div>
                <ConfidenceBar value={pair.confidence} />
              </div>
            </div>

            {/* Expanded detail panel */}
            {expandedId === pair.id && (
              <DetailPanel
                pair={pair}
                recordAData={expandedRecordData.a}
                recordBData={expandedRecordData.b}
                onApprove={(fs) => handleSingleApprove(pair.id, fs)}
                onReject={() => handleSingleReject(pair.id)}
                onSkip={() => handleSkip(pair.id)}
                loading={actionLoading}
              />
            )}
          </div>
        ))}

        {/* Pagination */}
        {!loading && total > perPage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderTop: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 12, color: C.text3 }}>
              Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)} of {total}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <GhostBtn
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </GhostBtn>
              <GhostBtn
                onClick={() => setPage(p => p + 1)}
                disabled={page * perPage >= total}
              >
                Next
              </GhostBtn>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
