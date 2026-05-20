'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Play, Pause, XCircle, Download, CheckCircle, Loader2, AlertCircle, Clock } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Chip, PrimaryBtn } from '@/components/refyne';
import { addToast } from '@/components/ui/toast';

interface ProviderStatus {
  provider: string;
  status: 'queued' | 'active' | 'complete';
  recordsProcessed: number;
  fieldsFilled: number;
}

interface CompletionEvent {
  id: string;
  recordName: string;
  field: string;
  provider: string;
  timestamp: string;
}

interface ArrangementRun {
  id: string;
  arrangement_id: string;
  run_type: string;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  total_records: number;
  processed_records: number;
  successful_records: number;
  failed_records: number;
  estimated_credits: number;
  actual_credits_used: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  arrangements: {
    name: string;
    enrichment_steps: Array<{
      provider: string;
      fields: string[];
      order: number;
    }>;
  };
  provider_stats?: ProviderStatus[];
  recent_completions?: CompletionEvent[];
}

export default function RunStatusPage({ params }: { params: { runId: string } }) {
  const router = useRouter();
  const [run, setRun] = useState<ArrangementRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRun();

    // Poll for updates if running
    const interval = setInterval(() => {
      if (run?.status === 'running' || run?.status === 'queued') {
        fetchRun();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [params.runId]);

  const fetchRun = async () => {
    try {
      const response = await fetch(`/api/arrangements/runs/${params.runId}`);
      if (!response.ok) throw new Error('Failed to fetch run');
      const data = await response.json();
      setRun(data.run);
    } catch (error) {
      console.error('Failed to fetch run:', error);
      addToast('error', 'Failed to load run details');
    } finally {
      setLoading(false);
    }
  };

  const handleControl = async (action: 'pause' | 'resume' | 'cancel') => {
    try {
      const response = await fetch(`/api/arrangements/runs/${params.runId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) throw new Error(`Failed to ${action} run`);

      addToast('success', `Run ${action}d successfully`);
      fetchRun();
    } catch (error) {
      console.error(`Failed to ${action} run:`, error);
      addToast('error', `Failed to ${action} run`);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/arrangements/runs/${params.runId}/export`);
      if (!response.ok) throw new Error('Failed to export');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `run-${params.runId}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      addToast('success', 'Export downloaded');
    } catch (error) {
      console.error('Failed to export:', error);
      addToast('error', 'Failed to export run');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32, color: C.text2 }}>
        Loading run details...
      </div>
    );
  }

  if (!run) {
    return (
      <div style={{ padding: 32, color: C.text2 }}>
        Run not found
      </div>
    );
  }

  const progress = run.total_records > 0
    ? Math.round((run.processed_records / run.total_records) * 100)
    : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return C.green;
      case 'failed': return C.red;
      case 'running': return C.indigo;
      case 'paused': return C.amber;
      default: return C.text3;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={20} color={C.green} />;
      case 'failed': return <AlertCircle size={20} color={C.red} />;
      case 'running': return <Loader2 size={20} color={C.indigo} className="spin" />;
      case 'paused': return <Pause size={20} color={C.amber} />;
      default: return null;
    }
  };

  const getProviderStatusColor = (status: string) => {
    switch (status) {
      case 'active': return C.indigo;
      case 'complete': return C.green;
      case 'queued': return C.text3;
      default: return C.text3;
    }
  };

  const PROVIDER_COLORS: Record<string, string> = {
    apollo: C.indigo,
    clearbit: C.green,
    zoominfo: C.amber,
    serper: C.purple,
  };

  const estimateTimeRemaining = () => {
    if (run.status !== 'running' || run.processed_records === 0) return null;

    const elapsed = new Date().getTime() - new Date(run.started_at).getTime();
    const rate = run.processed_records / (elapsed / 1000); // records per second
    const remaining = run.total_records - run.processed_records;
    const secondsRemaining = remaining / rate;

    if (secondsRemaining < 60) return `${Math.round(secondsRemaining)}s remaining`;
    if (secondsRemaining < 3600) return `${Math.round(secondsRemaining / 60)}m remaining`;
    return `${Math.round(secondsRemaining / 3600)}h remaining`;
  };

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => router.push('/arrangements')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'transparent',
            border: 'none',
            color: C.text2,
            fontSize: 14,
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          <ChevronLeft size={16} />
          Back to arrangements
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              {run.arrangements.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {getStatusIcon(run.status)}
              <span style={{ fontSize: 14, color: C.text2 }}>
                {run.run_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {run.status === 'running' && (
              <button
                onClick={() => handleControl('pause')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  background: C.hover,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.text,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <Pause size={14} />
                Pause
              </button>
            )}
            {run.status === 'paused' && (
              <button
                onClick={() => handleControl('resume')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  background: C.indigo,
                  border: 'none',
                  borderRadius: 6,
                  color: C.text,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <Play size={14} />
                Resume
              </button>
            )}
            {['running', 'paused', 'queued'].includes(run.status) && (
              <button
                onClick={() => handleControl('cancel')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  background: C.redDim,
                  border: `1px solid ${C.redBrd}`,
                  borderRadius: 6,
                  color: C.text,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <XCircle size={14} />
                Cancel
              </button>
            )}
            {run.status === 'completed' && (
              <button
                onClick={handleExport}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  background: C.hover,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.text,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <Download size={14} />
                Export CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 24,
        marginBottom: 24,
      }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Progress</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {run.status === 'running' && estimateTimeRemaining() && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: C.text3,
                }}>
                  <Clock size={12} />
                  {estimateTimeRemaining()}
                </div>
              )}
              <span style={{ fontSize: 18, fontWeight: 600, color: C.text }}>{progress}%</span>
            </div>
          </div>
          <div style={{
            height: 12,
            background: C.bg,
            borderRadius: 6,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: getStatusColor(run.status),
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 4 }}>Total Records</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: C.text }}>
              {run.total_records.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 4 }}>Successful</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: C.green }}>
              {run.successful_records.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 4 }}>Failed</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: C.red }}>
              {run.failed_records.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 4 }}>Credits Used</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: C.text }}>
              {run.actual_credits_used.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Provider Status */}
      {run.arrangements.enrichment_steps && run.arrangements.enrichment_steps.length > 0 && (
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 24,
          marginBottom: 24,
        }}>
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            color: C.text,
            marginBottom: 16,
          }}>
            Provider Status
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {run.arrangements.enrichment_steps
              .sort((a, b) => a.order - b.order)
              .map((step, idx) => {
                const providerStat = run.provider_stats?.find(
                  (ps) => ps.provider === step.provider
                );
                const status = providerStat?.status ||
                  (run.status === 'completed' ? 'complete' :
                   idx === 0 && run.status === 'running' ? 'active' : 'queued');
                const color = PROVIDER_COLORS[step.provider.toLowerCase()] || C.text3;

                return (
                  <div
                    key={step.provider}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 16,
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: color,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: C.text,
                        marginBottom: 4,
                      }}>
                        {step.provider.charAt(0).toUpperCase() + step.provider.slice(1)}
                      </div>
                      <div style={{ fontSize: 11, color: C.text3 }}>
                        {step.fields.length} fields · {step.fields.join(', ')}
                      </div>
                    </div>
                    <div style={{
                      padding: '4px 10px',
                      background: status === 'active' ? C.indigoDim :
                                  status === 'complete' ? C.greenDim : C.bg,
                      border: `1px solid ${
                        status === 'active' ? C.indigoBrd :
                        status === 'complete' ? C.greenBrd : C.border
                      }`,
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 500,
                      color: status === 'active' ? C.indigo :
                              status === 'complete' ? C.green : C.text3,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {status}
                    </div>
                    {providerStat && (
                      <div style={{
                        fontSize: 12,
                        color: C.text2,
                        minWidth: 120,
                        textAlign: 'right',
                      }}>
                        {providerStat.fieldsFilled} fields filled
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Completion Feed */}
      {run.status === 'running' && run.recent_completions && run.recent_completions.length > 0 && (
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 24,
          marginBottom: 24,
        }}>
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            color: C.text,
            marginBottom: 16,
          }}>
            Recent Completions
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {run.recent_completions.slice(0, 10).map((event) => {
              const color = PROVIDER_COLORS[event.provider.toLowerCase()] || C.text3;
              return (
                <div
                  key={event.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    background: C.bg,
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: color,
                    }}
                  />
                  <span style={{ color: C.text, fontWeight: 500 }}>
                    {event.recordName}
                  </span>
                  <span style={{ color: C.text3 }}>·</span>
                  <span style={{ color: C.text2, fontFamily: F.mono, fontSize: 11 }}>
                    {event.field}
                  </span>
                  <span style={{ color: C.text3 }}>filled by</span>
                  <span style={{ color: color, fontWeight: 500 }}>
                    {event.provider}
                  </span>
                  <span style={{ marginLeft: 'auto', color: C.text3, fontSize: 11 }}>
                    just now
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error */}
      {run.error_message && (
        <div style={{
          background: C.redDim,
          border: `1px solid ${C.redBrd}`,
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
          }}>
            <AlertCircle size={16} color={C.red} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Error</span>
          </div>
          <p style={{ fontSize: 13, color: C.text2 }}>
            {run.error_message}
          </p>
        </div>
      )}
    </div>
  );
}
