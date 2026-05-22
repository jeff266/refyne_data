'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';
import { PrimaryBtn } from '@/components/refyne';
import { ArrowLeft, Download, Loader2, Star } from 'lucide-react';

interface RunDetail {
  run_id: string;
  arrangement_id: string;
  arrangement_name: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number;
  status: string;
  providers: string[];
  fields: string[];
  records_processed: number;
  fields_filled: number;
}

interface FilledRecord {
  record_id: string;
  company_name: string;
  fields: {
    field_key: string;
    before: string;
    after: string;
    provider: string;
    harmony_applied: boolean;
  }[];
}

interface NotFoundRecord {
  record_id: string;
  company_name: string;
  reason: string;
}

interface FailedRecord {
  record_id: string;
  company_name: string;
  error: string;
}

interface RunProgress {
  filled: FilledRecord[];
  notFound: NotFoundRecord[];
  failed: FailedRecord[];
}

interface RunDetailResponse {
  run: RunDetail;
  arrangement: {
    id: string;
    name: string;
    field_configs: any[];
  };
  progress: RunProgress;
}

const FIELD_LABELS: Record<string, string> = {
  industry: 'Industry',
  employee_count: 'Employee count',
  numberofemployees: 'Employee count',
  revenue: 'Revenue',
  annualrevenue: 'Revenue',
  linkedin_url: 'LinkedIn URL',
  linkedin_company_page: 'LinkedIn URL',
  phone: 'Phone',
  domain: 'Domain',
};

type TabType = 'filled' | 'notFound' | 'failed';

export default function RunDetailPage() {
  const params = useParams();
  const runId = params.runId as string;

  const [data, setData] = useState<RunDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('filled');

  useEffect(() => {
    if (runId) {
      fetchRunDetail();
    }
  }, [runId]);

  const fetchRunDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/history/${runId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        // Set default tab based on what has data
        if (json.progress.filled.length > 0) {
          setActiveTab('filled');
        } else if (json.progress.notFound.length > 0) {
          setActiveTab('notFound');
        } else if (json.progress.failed.length > 0) {
          setActiveTab('failed');
        }
      }
    } catch (err) {
      console.error('Failed to fetch run detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getFieldLabel = (fieldKey: string) => {
    return FIELD_LABELS[fieldKey] || fieldKey;
  };

  const downloadCSV = () => {
    window.open(`/api/history/${runId}/export`, '_blank');
  };

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: C.text3 }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: C.text3 }}>
        Run not found
      </div>
    );
  }

  const { run, progress } = data;
  const providers = run.providers.join(', ');
  const fieldsDisplay = run.fields.map(getFieldLabel).join(', ');

  // Calculate field fill counts
  const fieldFillCounts: Record<string, number> = {};
  progress.filled.forEach((record) => {
    record.fields.forEach((field) => {
      fieldFillCounts[field.field_key] = (fieldFillCounts[field.field_key] || 0) + 1;
    });
  });

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
      <Link
        href="/history"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: C.indigo,
          fontSize: 13,
          textDecoration: 'none',
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} />
        Back to History
      </Link>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontSize: 24,
          fontWeight: 700,
          color: C.text,
          fontFamily: F.sans,
          marginBottom: 4,
        }}>
          {run.arrangement_name}
        </h1>
        <p style={{ fontSize: 14, color: C.text2, fontFamily: F.sans }}>
          {fieldsDisplay} · {formatTime(run.started_at)}
        </p>
      </div>

      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        padding: 20,
        marginBottom: 24,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 20,
          marginBottom: 20,
        }}>
          <div>
            <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Started
            </div>
            <div style={{ fontSize: 14, color: C.text }}>{formatTime(run.started_at)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Completed
            </div>
            <div style={{ fontSize: 14, color: C.text }}>
              {run.completed_at ? formatTime(run.completed_at) : 'Running'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Duration
            </div>
            <div style={{ fontSize: 14, color: C.text }}>{formatDuration(run.duration_seconds)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Records
            </div>
            <div style={{ fontSize: 14, color: C.text }}>{run.records_processed.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Filled
            </div>
            <div style={{ fontSize: 14, color: C.text }}>{run.fields_filled.toLocaleString()}</div>
          </div>
        </div>

        <div style={{ paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, color: C.text2, marginBottom: 8 }}>
            <strong>Fields:</strong> {run.fields.map((f) => `${getFieldLabel(f)} (${fieldFillCounts[f] || 0} filled)`).join(' · ')}
          </div>
          <div style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
            <strong>Provider:</strong> {providers} · <strong>Policy:</strong> Fill empty only
          </div>
          <PrimaryBtn onClick={downloadCSV} small>
            <Download size={14} />
            Download CSV
          </PrimaryBtn>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 16,
        borderBottom: `1px solid ${C.border}`,
      }}>
        {['filled', 'notFound', 'failed'].map((tab) => {
          const isActive = activeTab === tab;
          const count = progress[tab as TabType].length;
          const label =
            tab === 'filled' ? `Filled (${count})` :
            tab === 'notFound' ? `Not found (${count})` :
            `Failed (${count})`;

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as TabType)}
              style={{
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? `2px solid ${C.indigo}` : '2px solid transparent',
                color: isActive ? C.text : C.text3,
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.1s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        {activeTab === 'filled' && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr',
              padding: '12px 16px',
              borderBottom: `1px solid ${C.border}`,
              fontSize: 11,
              fontWeight: 600,
              color: C.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              <div>Company</div>
              <div>Field</div>
              <div>Before</div>
              <div>After</div>
            </div>
            {progress.filled.map((record, i) => (
              <div key={i}>
                {record.fields.map((field, j) => (
                  <div
                    key={j}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr',
                      padding: '12px 16px',
                      borderBottom: `1px solid ${C.border}`,
                      fontSize: 13,
                      color: C.text2,
                    }}
                  >
                    {j === 0 ? (
                      <div style={{ color: C.text }}>{record.company_name}</div>
                    ) : (
                      <div></div>
                    )}
                    <div>{getFieldLabel(field.field_key)}</div>
                    <div style={{ color: C.text3 }}>{field.before || '(empty)'}</div>
                    <div style={{ color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {field.after}
                      {field.harmony_applied && <Star size={12} color={C.amber} fill={C.amber} />}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {progress.filled.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: C.text3 }}>
                No filled records
              </div>
            )}
          </>
        )}

        {activeTab === 'notFound' && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 3fr',
              padding: '12px 16px',
              borderBottom: `1px solid ${C.border}`,
              fontSize: 11,
              fontWeight: 600,
              color: C.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              <div>Company</div>
              <div>Reason</div>
            </div>
            {progress.notFound.map((record, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 3fr',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 13,
                  color: C.text2,
                }}
              >
                <div style={{ color: C.text }}>{record.company_name}</div>
                <div style={{ color: C.text3 }}>{record.reason}</div>
              </div>
            ))}
            {progress.notFound.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: C.text3 }}>
                No not-found records
              </div>
            )}
          </>
        )}

        {activeTab === 'failed' && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 3fr',
              padding: '12px 16px',
              borderBottom: `1px solid ${C.border}`,
              fontSize: 11,
              fontWeight: 600,
              color: C.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              <div>Company</div>
              <div>Error</div>
            </div>
            {progress.failed.map((record, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 3fr',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 13,
                  color: C.text2,
                }}
              >
                <div style={{ color: C.text }}>{record.company_name}</div>
                <div style={{ color: C.red }}>{record.error}</div>
              </div>
            ))}
            {progress.failed.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: C.text3 }}>
                No failed records
              </div>
            )}
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
