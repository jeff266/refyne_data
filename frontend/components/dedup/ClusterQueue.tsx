'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, GhostBtn, PrimaryBtn } from '@/components/refyne';
import { ScanningState } from './ScanningState';
import type { DedupCluster, ClustersCounts } from '@/lib/dedup/cluster-types';
import type { PairGrade } from '@/lib/dedup/types';
import { useObjectType } from '@/hooks/useObjectType';

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

function ScanButton({
  onScan,
  disabled,
  recordTypeLabelPlural
}: {
  onScan: (forceFullScan: boolean) => void;
  disabled: boolean;
  recordTypeLabelPlural: string;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleIncremental = () => {
    setShowDropdown(false);
    onScan(false);
  };

  const handleFull = () => {
    setShowDropdown(false);
    onScan(true);
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <div style={{ display: 'flex', gap: 0 }}>
        <button
          onClick={handleIncremental}
          disabled={disabled}
          style={{
            padding: '8px 14px',
            background: C.indigo,
            color: 'white',
            border: 'none',
            borderRadius: '6px 0 0 6px',
            fontSize: 13,
            fontWeight: 500,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            fontFamily: F.sans,
          }}
        >
          Run scan
        </button>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={disabled}
          style={{
            padding: '8px 8px',
            background: C.indigo,
            color: 'white',
            border: 'none',
            borderLeft: `1px solid rgba(255,255,255,0.2)`,
            borderRadius: '0 6px 6px 0',
            fontSize: 11,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            fontFamily: F.sans,
          }}
        >
          ▼
        </button>
      </div>

      {showDropdown && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: 280,
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          <button
            onClick={handleIncremental}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: `1px solid ${C.border}`,
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: F.sans,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 4 }}>
              Incremental scan
            </div>
            <div style={{ fontSize: 11, color: C.text3, lineHeight: 1.4 }}>
              Only process {recordTypeLabelPlural} modified since last scan<br />
              Faster · Runs automatically overnight
            </div>
          </button>
          <button
            onClick={handleFull}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: F.sans,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 4 }}>
              Full scan
            </div>
            <div style={{ fontSize: 11, color: C.text3, lineHeight: 1.4 }}>
              Reprocess all {recordTypeLabelPlural} from scratch<br />
              Use after connecting HubSpot or changing settings
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

interface FiredSignal {
  tier: number;
  type: string;
  deterministic: boolean;
  score: number;
}

function SignalBadge({ signal }: { signal: FiredSignal }) {
  const getSignalDisplay = () => {
    switch (signal.type) {
      case 'domain':
        return { label: 'Domain exact', bg: C.greenDim, color: C.green };
      case 'linkedin':
        return { label: 'LinkedIn exact', bg: C.greenDim, color: C.green };
      case 'phone':
        return { label: 'Phone match', bg: C.greenDim, color: C.green };
      case 'name':
        return { label: `Name ${Math.round(signal.score)}%`, bg: C.indigoDim, color: C.indigoLt };
      case 'name_industry':
        return { label: 'Name + Industry', bg: C.amberDim, color: C.amber };
      default:
        return { label: signal.type, bg: C.hover, color: C.text3 };
    }
  };

  const { label, bg, color } = getSignalDisplay();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        fontFamily: F.sans,
        fontWeight: 500,
        color,
        background: bg,
        padding: '3px 7px',
        borderRadius: 4,
      }}
    >
      {label}
    </span>
  );
}

function SignalBadges({ signals }: { signals: FiredSignal[] }) {
  if (!signals || signals.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
      {signals.map((signal, idx) => (
        <SignalBadge key={idx} signal={signal} />
      ))}
    </div>
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
  const [objectType] = useObjectType();

  console.log(`[ClusterQueue] Rendered with objectType: ${objectType}`);

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

  // Data policies for merge outcome preview
  const [dataPolicy, setDataPolicy] = useState<'fill_gaps' | 'overwrite_always' | 'overwrite_if_stale'>('fill_gaps');

  // Selection state for bulk merge
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Action state
  const [bulkMergeLoading, setBulkMergeLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────
  // Helper: Determine merge outcome for a field
  // ─────────────────────────────────────────────────────────────

  function getMergeOutcome(masterValue: string | undefined, absorbedValue: string | undefined): {
    masterColor: string;
    absorbedColor: string;
    indicator?: 'fill' | 'conflict' | 'discard';
    showBoth: boolean;
  } {
    const masterEmpty = !masterValue || masterValue === '—';
    const absorbedEmpty = !absorbedValue || absorbedValue === '—';

    // Both empty - show once in muted
    if (masterEmpty && absorbedEmpty) {
      return {
        masterColor: C.text3,
        absorbedColor: C.text3,
        showBoth: false,
      };
    }

    // Master has value, absorbed empty - master wins (green)
    if (!masterEmpty && absorbedEmpty) {
      return {
        masterColor: C.green,
        absorbedColor: C.text3,
        indicator: undefined,
        showBoth: false,
      };
    }

    // Master empty, absorbed has value - fill gap (amber)
    if (masterEmpty && !absorbedEmpty) {
      return {
        masterColor: C.text3,
        absorbedColor: C.amber,
        indicator: 'fill',
        showBoth: true,
      };
    }

    // Both have values
    if (masterValue === absorbedValue) {
      // Identical - show once in muted
      return {
        masterColor: C.text3,
        absorbedColor: C.text3,
        showBoth: false,
      };
    } else {
      // Different values - conflict (master green, absorbed amber)
      return {
        masterColor: C.green,
        absorbedColor: C.amber,
        indicator: dataPolicy === 'fill_gaps' ? 'discard' : 'conflict',
        showBoth: true,
      };
    }
  }

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
      params.set('objectType', objectType);

      console.log(`[ClusterQueue] Fetching clusters with objectType: ${objectType}, URL: /api/dedup/clusters?${params}`);

      const res = await fetch(`/api/dedup/clusters?${params}`, {
        headers: { 'x-org-id': orgId },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch clusters');
      }

      const data = await res.json();
      console.log(`[ClusterQueue] Received ${data.clusters?.length || 0} clusters, total: ${data.total}, objectType requested: ${objectType}`);
      setClusters(data.clusters);
      setCounts(data.counts);
      setTotal(data.total);

      // Fetch record data for both compact and expanded views
      // Compact: fetch first record from each cluster (for display names)
      // Expanded: fetch all records (for full comparison table)
      if (data.clusters.length > 0) {
        const recordIds = new Set<string>();

        if (view === 'expanded') {
          // Expanded: fetch all records
          data.clusters.forEach((c: DedupCluster) =>
            c.recordIds.forEach((id: string) => recordIds.add(id))
          );
        } else {
          // Compact: fetch first record from each cluster
          data.clusters.forEach((c: DedupCluster) => {
            if (c.recordIds.length > 0) {
              recordIds.add(c.recordIds[0]);
            }
          });
        }

        // Fetch record data (names for companies, or contact info for contacts)
        const batchEndpoint =
          objectType === 'contact'
            ? '/api/hubspot/contacts/batch-names'
            : '/api/hubspot/companies/batch-names';

        const namesRes = await fetch(batchEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-org-id': orgId,
          },
          body: JSON.stringify({ ids: Array.from(recordIds) }),
        });

        if (namesRes.ok) {
          const namesData = await namesRes.json();
          setCompanyData(namesData.companies || namesData.contacts || {});
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch clusters');
    } finally {
      setLoading(false);
    }
  }, [orgId, gradeFilter, statusFilter, sizeFilter, page, perPage, view, objectType]);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  // Fetch data policies
  useEffect(() => {
    async function fetchPolicies() {
      try {
        const res = await fetch('/api/org/data-policies', {
          headers: { 'x-org-id': orgId },
        });
        if (res.ok) {
          const data = await res.json();
          setDataPolicy(data.existingValuePolicy);
        }
      } catch (error) {
        console.error('Failed to fetch data policies:', error);
      }
    }
    fetchPolicies();
  }, [orgId]);

  // ─────────────────────────────────────────────────────────────
  // Action handlers
  // ─────────────────────────────────────────────────────────────

  const handleBulkMerge = async (allGradeA = false) => {
    if (!allGradeA && selectedIds.size === 0) return;
    setBulkMergeLoading(true);
    try {
      const res = await fetch('/api/dedup/clusters/bulk-merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': orgId,
        },
        body: JSON.stringify(
          allGradeA
            ? { allGradeA: true }
            : { clusterIds: Array.from(selectedIds) }
        ),
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

  const handleRunScan = async (forceFullScan: boolean = false) => {
    setScanLoading(true);
    setError(null);
    try {
      console.log(`[ClusterQueue] handleRunScan START: objectType=${objectType}, URL=${window.location.href}, currentActiveJobId=${activeJobId}`);
      const res = await fetch('/api/dedup/scan', {
        method: 'POST',
        headers: {
          'x-org-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ forceFullScan, objectType }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error(`[ClusterQueue] Scan API error: ${data.error}`);
        throw new Error(data.error || 'Failed to start scan');
      }

      const data = await res.json();
      console.log(`[ClusterQueue] Scan enqueued: jobId=${data.jobId}, scanType=${data.scanType}, queued=${data.queued}`);

      // Show scanning UI
      console.log(`[ClusterQueue] Setting activeJobId to: ${data.jobId}`);
      setActiveJobId(data.jobId);
      console.log(`[ClusterQueue] activeJobId set complete (state update queued)`);
    } catch (err) {
      console.error(`[ClusterQueue] Scan failed:`, err);
      setError(err instanceof Error ? err.message : 'Failed to start scan');
    } finally {
      setScanLoading(false);
    }
  };

  const handleScanComplete = () => {
    console.log(`[ClusterQueue] handleScanComplete called - clearing activeJobId`);
    setActiveJobId(null);
    fetchClusters();
  };

  // Track activeJobId changes
  useEffect(() => {
    console.log(`[ClusterQueue] activeJobId changed to: ${activeJobId}, objectType=${objectType}`);
  }, [activeJobId, objectType]);

  // ─────────────────────────────────────────────────────────────
  // Computed values
  // ─────────────────────────────────────────────────────────────

  const totalGradeCount =
    counts.byGrade.A + counts.byGrade.B + counts.byGrade.C + counts.byGrade.D;
  const gradeAClusters = clusters.filter((c) => c.grade === 'A' && c.status === 'pending');

  // Object type labels
  const recordTypeLabel = objectType === 'contact' ? 'contact' : 'company';
  const recordTypeLabelPlural = objectType === 'contact' ? 'contacts' : 'companies';

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
              {counts.byGrade.A > 0 && selectedIds.size === 0 && (
                <PrimaryBtn
                  onClick={() => handleBulkMerge(true)}
                  disabled={bulkMergeLoading}
                >
                  {bulkMergeLoading ? 'Merging...' : `Select all ${counts.byGrade.A} Grade A`}
                </PrimaryBtn>
              )}
              {selectedIds.size > 0 && (
                <>
                  <GhostBtn onClick={() => setSelectedIds(new Set())}>
                    Clear selection
                  </GhostBtn>
                  <PrimaryBtn onClick={() => handleBulkMerge(false)} disabled={bulkMergeLoading}>
                    {bulkMergeLoading ? 'Merging...' : `Bulk merge ${selectedIds.size}`}
                  </PrimaryBtn>
                </>
              )}
              {selectedIds.size === 0 && (
                <>
                  {scanLoading ? (
                    <div style={{
                      padding: '8px 14px',
                      background: C.hover,
                      borderRadius: 6,
                      fontSize: 13,
                      color: C.text3,
                      fontFamily: F.sans,
                    }}>
                      Scanning...
                    </div>
                  ) : (
                    <ScanButton onScan={handleRunScan} disabled={loading} recordTypeLabelPlural={recordTypeLabelPlural} />
                  )}
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
                  onClick={() => {
                    // Store cluster IDs in sessionStorage for navigation
                    const clusterIds = clusters.map(c => c.id);
                    sessionStorage.setItem('dedupClusterIds', JSON.stringify(clusterIds));
                    sessionStorage.setItem('dedupObjectType', objectType);
                    router.push(`/dedup/clusters/${cluster.id}?objectType=${objectType}`);
                  }}
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
                            marginBottom: 4,
                          }}
                        >
                          {(() => {
                            const survivorRecord = companyData[cluster.recordIds[0]];
                            if (survivorRecord?.name) {
                              // Use actual company name from survivor record
                              return survivorRecord.name;
                            }
                            // Fallback: apply title case to cluster name
                            if (cluster.clusterName) {
                              return cluster.clusterName
                                .split(' ')
                                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                .join(' ');
                            }
                            return `Cluster ${cluster.id.slice(0, 8)}`;
                          })()}
                        </div>
                        {/* Signal badges */}
                        <SignalBadges signals={(cluster as any).signals || []} />
                        <div style={{ height: 8 }} />
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
                            {objectType === 'contact' ? 'Name' : 'Company Name'}
                          </div>
                          <div style={{ fontSize: 9, color: C.text3, fontWeight: 600, textTransform: 'uppercase' }}>
                            {objectType === 'contact' ? 'Email' : 'Domain'}
                          </div>
                          <div style={{ fontSize: 9, color: C.text3, fontWeight: 600, textTransform: 'uppercase' }}>
                            Phone
                          </div>
                          <div style={{ fontSize: 9, color: C.text3, fontWeight: 600, textTransform: 'uppercase' }}>
                            {objectType === 'contact' ? 'Company' : 'Website'}
                          </div>
                          <div style={{ fontSize: 9, color: C.text3, fontWeight: 600, textTransform: 'uppercase' }}>
                            Lifecycle Stage
                          </div>

                          {/* Data rows - All records stacked vertically */}
                          {(() => {
                            const allRecords = cluster.recordIds.map(id => companyData[id]).filter(Boolean);
                            if (allRecords.length === 0) return null;

                            const recordsToShow = cluster.recordIds.length > 3
                              ? allRecords.slice(0, 3)
                              : allRecords;

                            return recordsToShow.map((record, recordIndex) => {
                              const isMaster = recordIndex === 0;
                              return (
                                <React.Fragment key={cluster.recordIds[recordIndex]}>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      fontFamily: F.sans,
                                    }}
                                  >
                                    {isMaster && (
                                      <span
                                        style={{
                                          fontSize: 10,
                                          color: C.green,
                                          fontWeight: 600,
                                          marginRight: 6,
                                        }}
                                        title="Master record (surviving)"
                                      >
                                        ★
                                      </span>
                                    )}
                                    <span
                                      style={{
                                        color: isMaster ? C.green : C.text2,
                                        fontWeight: isMaster ? 600 : 400,
                                      }}
                                    >
                                      {objectType === 'contact'
                                        ? (() => {
                                            const firstname = (record as any).firstname || '';
                                            const lastname = (record as any).lastname || '';
                                            const fullName = `${firstname} ${lastname}`.trim();
                                            return fullName || '—';
                                          })()
                                        : record.name || '—'}
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      fontFamily: F.mono,
                                      color: C.text2,
                                    }}
                                  >
                                    {objectType === 'contact'
                                      ? (record as any).email || '—'
                                      : record.domain || '—'}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      fontFamily: F.sans,
                                      color: C.text2,
                                    }}
                                  >
                                    {record.phone || '—'}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      fontFamily: F.sans,
                                      color: C.text2,
                                    }}
                                  >
                                    {objectType === 'contact'
                                      ? (record as any).company || '—'
                                      : record.website || '—'}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      fontFamily: F.sans,
                                      color: C.text2,
                                    }}
                                  >
                                    {record.lifecyclestage || '—'}
                                  </div>
                                </React.Fragment>
                              );
                            });
                          })()}
                        </div>
                        {/* See more link - only if cluster has more than 3 records */}
                        {cluster.recordIds.length > 3 && (
                          <div
                            style={{
                              fontSize: 11,
                              color: C.indigo,
                              marginTop: 4,
                              cursor: 'pointer',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Store cluster IDs in sessionStorage for navigation
                              const clusterIds = clusters.map(c => c.id);
                              sessionStorage.setItem('dedupClusterIds', JSON.stringify(clusterIds));
                              sessionStorage.setItem('dedupObjectType', objectType);
                              router.push(`/dedup/clusters/${cluster.id}?objectType=${objectType}`);
                            }}
                          >
                            See more →
                          </div>
                        )}
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
                          {(() => {
                            // Try to get the first record's name from fetched data
                            const firstRecord = companyData[cluster.recordIds[0]];

                            if (objectType === 'contact' && firstRecord) {
                              // For contacts: show firstname lastname or email
                              const firstname = (firstRecord as any).firstname || '';
                              const lastname = (firstRecord as any).lastname || '';
                              const fullName = `${firstname} ${lastname}`.trim();
                              if (fullName) return fullName;
                              if ((firstRecord as any).email) return (firstRecord as any).email;
                            } else if (firstRecord?.name) {
                              // For companies: show company name
                              return firstRecord.name;
                            }

                            // Fallback: use cluster name or ID
                            if (cluster.clusterName) {
                              return cluster.clusterName
                                .split(' ')
                                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                .join(' ');
                            }
                            return `Cluster ${cluster.id.slice(0, 8)}`;
                          })()}
                        </div>
                        {/* Signal badges */}
                        <SignalBadges signals={(cluster as any).signals || []} />
                        <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>
                          {cluster.recordIds.length} {recordTypeLabelPlural}
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
