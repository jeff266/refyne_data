'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Play, Pause, XCircle, Download, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Chip, PrimaryBtn } from '@/components/refyne';
import { addToast } from '@/components/ui/toast';

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
  };
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
        <div style={{ marginBottom: 16 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 14, color: C.text2 }}>Progress</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{progress}%</span>
          </div>
          <div style={{
            height: 8,
            background: C.bg,
            borderRadius: 4,
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
