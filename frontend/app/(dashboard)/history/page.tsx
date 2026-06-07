'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { C, F } from '@/lib/design-tokens';
import { CustomDropdown, PrimaryBtn } from '@/components/refyne';
import type { CustomDropdownOption } from '@/components/refyne';
import { Check, X, Loader2 } from 'lucide-react';

interface HistoryRun {
  run_id: string;
  arrangement_id: string;
  arrangement_name: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number;
  status: 'completed' | 'failed' | 'running';
  providers: string[];
  fields: string[];
  records_processed: number;
  fields_filled: number;
}

interface HistorySummary {
  totalRuns: number;
  totalRecords: number;
  totalFilled: number;
  avgFillsPerRun: number;
}

interface HistoryResponse {
  runs: HistoryRun[];
  total: number;
  summary: HistorySummary;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <Check size={14} color={C.green} />,
  failed: <X size={14} color={C.red} />,
  running: <Loader2 size={14} color={C.indigo} style={{ animation: 'spin 1s linear infinite' }} />,
};

export default function HistoryPage() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<string>('all');
  const [field, setField] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('last30days');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchHistory();
  }, [provider, field, status, dateRange, page]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (provider !== 'all') params.set('provider', provider);
      if (field !== 'all') params.set('field', field);
      if (status !== 'all') params.set('status', status);
      params.set('dateRange', dateRange);
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch(`/api/history?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async () => {
    const params = new URLSearchParams();
    if (provider !== 'all') params.set('provider', provider);
    if (field !== 'all') params.set('field', field);
    if (status !== 'all') params.set('status', status);
    params.set('dateRange', dateRange);

    window.open(`/api/history/export?${params}`, '_blank');
  };

  const formatDate = (isoString: string | null | undefined) => {
    if (!isoString) return 'N/A';

    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Invalid date';

    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 2) {
      const minutes = Math.round(diffHours * 60);
      return `${minutes} min ago`;
    }
    if (diffHours < 24) {
      return `${Math.round(diffHours)} hours ago`;
    }
    if (diffHours < 48) {
      return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const providerOptions: CustomDropdownOption[] = [
    { value: 'all', label: 'All providers' },
    { value: 'apollo', label: 'Apollo' },
    { value: 'zoominfo', label: 'ZoomInfo' },
    { value: 'clearbit', label: 'Clearbit' },
  ];

  const fieldOptions: CustomDropdownOption[] = [
    { value: 'all', label: 'All fields' },
    { value: 'industry', label: 'Industry' },
    { value: 'employee_count', label: 'Employee count' },
    { value: 'revenue', label: 'Revenue' },
    { value: 'linkedin_url', label: 'LinkedIn URL' },
  ];

  const statusOptions: CustomDropdownOption[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'completed', label: 'Complete' },
    { value: 'failed', label: 'Failed' },
    { value: 'running', label: 'Running' },
  ];

  const dateOptions: CustomDropdownOption[] = [
    { value: 'today', label: 'Today' },
    { value: 'last7days', label: 'Last 7 days' },
    { value: 'last30days', label: 'Last 30 days' },
    { value: 'alltime', label: 'All time' },
  ];

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 8 }}>
          History
        </h1>
        <p style={{ fontSize: 14, color: C.text2, fontFamily: F.sans }}>
          All enrichment runs across your HubSpot portal
        </p>
      </div>

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <div style={{ background: C.surface, padding: 16, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Total runs
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.text, fontFamily: F.sans }}>
              {(data.summary.totalRuns ?? 0).toLocaleString()}
            </div>
          </div>
          <div style={{ background: C.surface, padding: 16, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Records processed
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.text, fontFamily: F.sans }}>
              {(data.summary.totalRecords ?? 0).toLocaleString()}
            </div>
          </div>
          <div style={{ background: C.surface, padding: 16, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Fields filled
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.text, fontFamily: F.sans }}>
              {(data.summary.totalFilled ?? 0).toLocaleString()}
            </div>
          </div>
          <div style={{ background: C.surface, padding: 16, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Avg fills per run
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.text, fontFamily: F.sans }}>
              {data.summary.avgFillsPerRun ?? 0}
            </div>
          </div>
        </div>
      )}

      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        padding: 16,
        marginBottom: 16,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <CustomDropdown
          value={provider}
          options={providerOptions}
          onChange={(v) => {
            setProvider(v);
            setPage(1);
          }}
        />
        <CustomDropdown
          value={field}
          options={fieldOptions}
          onChange={(v) => {
            setField(v);
            setPage(1);
          }}
        />
        <CustomDropdown
          value={status}
          options={statusOptions}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
        <CustomDropdown
          value={dateRange}
          options={dateOptions}
          onChange={(v) => {
            setDateRange(v);
            setPage(1);
          }}
        />
        <div style={{ marginLeft: 'auto' }}>
          <PrimaryBtn onClick={exportCSV} small>
            Export CSV
          </PrimaryBtn>
        </div>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr 1.5fr 1fr 1fr 40px',
          padding: '12px 16px',
          borderBottom: `1px solid ${C.border}`,
          fontSize: 11,
          fontWeight: 600,
          color: C.text3,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <div>Date</div>
          <div>Provider</div>
          <div>Fields</div>
          <div>Records</div>
          <div>Filled</div>
          <div></div>
        </div>

        {loading && (
          <div style={{ padding: 32, textAlign: 'center', color: C.text3 }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        )}

        {!loading && data && data.runs.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: C.text3 }}>
            No runs found matching filters
          </div>
        )}

        {!loading && data && data.runs.map((run) => (
          <Link
            key={run.run_id}
            href={`/history/${run.run_id}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 1.5fr 1fr 1fr 40px',
              padding: '12px 16px',
              borderBottom: `1px solid ${C.border}`,
              fontSize: 13,
              color: C.text2,
              textDecoration: 'none',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = C.hover}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ color: C.text }}>{formatDate(run.started_at)}</div>
            <div>{run.providers.join(', ')}</div>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {run.fields.slice(0, 3).join(', ')}
              {run.fields.length > 3 && ` +${run.fields.length - 3} more`}
            </div>
            <div>{(run.records_processed ?? 0).toLocaleString()}</div>
            <div>{(run.fields_filled ?? 0).toLocaleString()}</div>
            <div>{STATUS_ICONS[run.status]}</div>
          </Link>
        ))}
      </div>

      {!loading && data && data.runs.length > 0 && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button
            onClick={() => setPage(page + 1)}
            style={{
              padding: '8px 16px',
              background: C.surface,
              border: `1px solid ${C.border}`,
              color: C.text,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Load more
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
