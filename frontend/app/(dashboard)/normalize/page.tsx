'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, RotateCcw, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Toggle, PrimaryBtn, Chip } from '@/components/refyne';
import { RollbackConfirmModal } from '@/components/normalize/RollbackConfirmModal';
import { RunDetailSlideOver } from '@/components/normalize/RunDetailSlideOver';
import { addToast } from '@/components/ui/toast';

// TODO: wire to API - GET /api/harmonies or similar
const list = ['company-name','company-industry','phone-e164','linkedin-url','person-title','person-name'];

interface PreviewRecord {
  company: string;
  field: string;
  before: string;
  after: string;
  hubspotCompanyId: string;
  portalId: string;
}

interface NormalizeRun {
  id: string;
  created_at: string;
  records_changed: number;
  status: 'running' | 'completed' | 'failed' | 'rolling_back' | 'rolled_back';
  rollback_available: boolean;
  rollback_expires_at: string | null;
}

export default function NormalizePage() {
  const [active, setActive] = useState(['company-name','company-industry','phone-e164','linkedin-url']);
  const toggle = (id: string) => setActive(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);

  // Preview state
  const [preview, setPreview] = useState<PreviewRecord[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Run history state
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [runs, setRuns] = useState<NormalizeRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const RUNS_PER_PAGE = 10;

  // Rollback state
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [pollingRunId, setPollingRunId] = useState<string | null>(null);

  // Detail slide over state
  const [detailSlideOverOpen, setDetailSlideOverOpen] = useState(false);
  const [detailRunId, setDetailRunId] = useState<string | null>(null);

  // Note: Preview is loaded on-demand via "Load preview" button click

  // Fetch runs when history is expanded
  useEffect(() => {
    if (historyExpanded) {
      fetchRuns();
    }
  }, [historyExpanded, currentPage]);

  // Poll for run status updates
  useEffect(() => {
    if (!pollingRunId) return;

    const interval = setInterval(() => {
      pollRunStatus(pollingRunId);
    }, 3000);

    return () => clearInterval(interval);
  }, [pollingRunId]);

  const fetchPreview = async () => {
    setPreviewLoading(true);

    try {
      const response = await fetch('/api/normalize/preview?limit=50');

      if (!response.ok) {
        throw new Error('Failed to fetch preview');
      }

      const data = await response.json();
      setPreview(data.preview || []);
    } catch (error) {
      console.error('Failed to fetch preview:', error);
      addToast('error', 'Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const fetchRuns = async () => {
    setRunsLoading(true);

    try {
      const response = await fetch(`/api/normalize/runs?page=${currentPage}&limit=${RUNS_PER_PAGE}`);

      if (!response.ok) {
        throw new Error('Failed to fetch runs');
      }

      const data = await response.json();
      setRuns(data.runs);
      setTotalPages(Math.ceil(data.total / RUNS_PER_PAGE));
    } catch (error) {
      console.error('Failed to fetch runs:', error);
      addToast('error', 'Failed to load run history');
    } finally {
      setRunsLoading(false);
    }
  };

  const pollRunStatus = async (runId: string) => {
    try {
      const response = await fetch(`/api/normalize/runs/${runId}`);

      if (!response.ok) {
        throw new Error('Failed to poll run status');
      }

      const data = await response.json();

      // Update run in the list
      setRuns(prev => prev.map(run =>
        run.id === runId ? { ...run, status: data.status } : run
      ));

      // If status changed to rolled_back, show success toast and stop polling
      if (data.status === 'rolled_back') {
        addToast('success', `${data.records_changed.toLocaleString()} records reverted successfully`);
        setPollingRunId(null);
      } else if (data.status === 'failed') {
        // Check for partial failure
        const failedCount = data.rollback_error ? JSON.parse(data.rollback_error).length : 0;
        if (failedCount > 0) {
          addToast('error', `Rollback partially failed. ${failedCount} records failed. Check Sentry for details.`);
        } else {
          addToast('error', 'Rollback failed');
        }
        setPollingRunId(null);
      }
    } catch (error) {
      console.error('Failed to poll run status:', error);
    }
  };

  const handleRollbackClick = (run: NormalizeRun) => {
    setSelectedRunId(run.id);
    setRollbackModalOpen(true);
  };

  const handleRollbackConfirm = async () => {
    if (!selectedRunId) return;

    try {
      const response = await fetch(`/api/normalize/runs/${selectedRunId}/rollback`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Rollback failed');
      }

      // Start polling for status updates
      setPollingRunId(selectedRunId);

      // Update run status immediately to show "rolling back" state
      setRuns(prev => prev.map(run =>
        run.id === selectedRunId ? { ...run, status: 'rolling_back' } : run
      ));

      setRollbackModalOpen(false);
      setSelectedRunId(null);
    } catch (error) {
      console.error('Rollback failed:', error);
      throw error; // Re-throw to be caught by modal
    }
  };

  const handleRunClick = (runId: string) => {
    setDetailRunId(runId);
    setDetailSlideOverOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <CheckCircle size={14} color={C.green} />
            <span style={{ fontSize: 11, color: C.green, fontWeight: 500 }}>Done</span>
          </div>
        );
      case 'rolled_back':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <RotateCcw size={14} color={C.text2} />
            <span style={{ fontSize: 11, color: C.text2, fontWeight: 500 }}>Rolled</span>
          </div>
        );
      case 'failed':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <XCircle size={14} color={C.red} />
            <span style={{ fontSize: 11, color: C.red, fontWeight: 500 }}>Failed</span>
          </div>
        );
      case 'running':
      case 'rolling_back':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Loader2 size={14} color={C.indigo} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 11, color: C.indigo, fontWeight: 500 }}>
              {status === 'rolling_back' ? 'Rolling...' : 'Running'}
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  const isRollbackExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const selectedRun = runs.find(r => r.id === selectedRunId);

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: F.sans, flexDirection: 'column' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Harmonies sidebar */}
        <div style={{ width: 232, background: C.sidebar, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Harmonies</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {list.map(id => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 11, fontFamily: F.mono, color: active.includes(id) ? C.text : C.text3 }}>{id}</span>
                <Toggle on={active.includes(id)} onToggle={() => toggle(id)} />
              </div>
            ))}
          </div>
          <div style={{ padding: 16, borderTop: `1px solid ${C.border}` }}>
            <PrimaryBtn onClick={fetchPreview} disabled={previewLoading}>
              {previewLoading ? 'Loading...' : 'Load preview'}
            </PrimaryBtn>
          </div>
        </div>

        {/* Preview area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '12px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: C.text2 }}>4 fields will change · 23,096 unchanged</span>
            <PrimaryBtn>Apply 4 changes</PrimaryBtn>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: F.sans }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Record', 'Field', 'Before', 'After'].map(h => (
                    <th key={h} style={{ padding: '10px 24px', textAlign: 'left', color: C.text3, fontSize: 11, fontWeight: 500, letterSpacing: '0.03em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.length === 0 && !previewLoading && (
                  <tr>
                    <td colSpan={4} style={{ padding: '40px 24px', textAlign: 'center', color: C.text3, fontSize: 12 }}>
                      No changes to preview
                    </td>
                  </tr>
                )}
                {previewLoading && (
                  <tr>
                    <td colSpan={4} style={{ padding: '40px 24px', textAlign: 'center', color: C.text3, fontSize: 12 }}>
                      Loading preview...
                    </td>
                  </tr>
                )}
                {preview.map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '12px 24px', color: C.text2, fontWeight: 500 }}>
                      <a
                        href={`https://app.hubspot.com/contacts/${r.portalId}/company/${r.hubspotCompanyId}`}
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
                        {r.company}
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                          <path
                            d="M10 6.5V10C10 10.2652 9.89464 10.5196 9.70711 10.7071C9.51957 10.8946 9.26522 11 9 11H2C1.73478 11 1.48043 10.8946 1.29289 10.7071C1.10536 10.5196 1 10.2652 1 10V3C1 2.73478 1.10536 2.48043 1.29289 2.29289C1.48043 2.10536 1.73478 2 2 2H5.5M8 1H11M11 1V4M11 1L5.5 6.5"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </a>
                    </td>
                    <td style={{ padding: '12px 24px', fontFamily: F.mono, color: C.text3, fontSize: 11 }}>{r.field}</td>
                    <td style={{ padding: '12px 24px', fontFamily: F.mono, color: C.red, fontSize: 11 }}>{r.before}</td>
                    <td style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontFamily: F.mono, color: C.green, fontSize: 11 }}>{r.after}</span>
                      <CheckCircle2 size={11} color={C.green} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Run history panel */}
      <div style={{ borderTop: `1px solid ${C.border}`, background: C.sidebar }}>
        {/* Header */}
        <button
          onClick={() => setHistoryExpanded(!historyExpanded)}
          style={{
            width: '100%',
            padding: '12px 24px',
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            color: C.text,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = C.hover}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontSize: 12, fontWeight: 600 }}>Run history</span>
          {historyExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>

        {/* History content */}
        {historyExpanded && (
          <div style={{ maxHeight: 400, overflowY: 'auto', borderTop: `1px solid ${C.border}` }}>
            {runsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                <Loader2 size={20} color={C.text3} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : runs.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: C.text3 }}>No runs yet</p>
              </div>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.bg }}>
                      <th style={{ padding: '8px 24px', textAlign: 'left', color: C.text3, fontSize: 11, fontWeight: 500 }}>Run ID</th>
                      <th style={{ padding: '8px 24px', textAlign: 'left', color: C.text3, fontSize: 11, fontWeight: 500 }}>Date</th>
                      <th style={{ padding: '8px 24px', textAlign: 'left', color: C.text3, fontSize: 11, fontWeight: 500 }}>Changed</th>
                      <th style={{ padding: '8px 24px', textAlign: 'left', color: C.text3, fontSize: 11, fontWeight: 500 }}>Status</th>
                      <th style={{ padding: '8px 24px', textAlign: 'right', color: C.text3, fontSize: 11, fontWeight: 500 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => {
                      const expired = isRollbackExpired(run.rollback_expires_at);
                      const showRollbackButton = run.rollback_available && run.status === 'completed' && !expired;
                      const isPolling = pollingRunId === run.id;

                      return (
                        <tr key={run.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ padding: '10px 24px' }}>
                            <button
                              onClick={() => handleRunClick(run.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                fontFamily: F.mono,
                                fontSize: 11,
                                color: C.indigoLt,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                            >
                              {run.id.slice(0, 8)}
                            </button>
                          </td>
                          <td style={{ padding: '10px 24px', color: C.text2, fontSize: 11 }}>
                            {new Date(run.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </td>
                          <td style={{ padding: '10px 24px', fontFamily: F.mono, color: C.text, fontSize: 11 }}>
                            {run.records_changed.toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 24px' }}>
                            {getStatusBadge(run.status)}
                          </td>
                          <td style={{ padding: '10px 24px', textAlign: 'right' }}>
                            {showRollbackButton && (
                              <button
                                onClick={() => handleRollbackClick(run)}
                                disabled={isPolling}
                                style={{
                                  padding: '4px 10px',
                                  background: 'transparent',
                                  border: `1px solid ${C.border2}`,
                                  borderRadius: 5,
                                  fontSize: 11,
                                  color: C.text,
                                  cursor: isPolling ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  opacity: isPolling ? 0.6 : 1,
                                }}
                                onMouseEnter={(e) => !isPolling && (e.currentTarget.style.background = C.hover)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                {isPolling ? (
                                  <>
                                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                    Rolling back...
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw size={12} />
                                    Rollback
                                  </>
                                )}
                              </button>
                            )}
                            {expired && run.rollback_available && (
                              <span style={{ fontSize: 11, color: C.text3, fontStyle: 'italic' }}>Expired</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, color: C.text2 }}>
                      Page {currentPage} of {totalPages}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        style={{
                          padding: '4px 10px',
                          background: C.hover,
                          border: `1px solid ${C.border2}`,
                          borderRadius: 5,
                          fontSize: 11,
                          color: C.text,
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          opacity: currentPage === 1 ? 0.5 : 1,
                        }}
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        style={{
                          padding: '4px 10px',
                          background: C.hover,
                          border: `1px solid ${C.border2}`,
                          borderRadius: 5,
                          fontSize: 11,
                          color: C.text,
                          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                          opacity: currentPage === totalPages ? 0.5 : 1,
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Rollback confirmation modal */}
      {selectedRun && (
        <RollbackConfirmModal
          isOpen={rollbackModalOpen}
          runId={selectedRun.id}
          shortRunId={selectedRun.id.slice(0, 8)}
          onClose={() => {
            setRollbackModalOpen(false);
            setSelectedRunId(null);
          }}
          onConfirm={handleRollbackConfirm}
        />
      )}

      {/* Run detail slide over */}
      {detailRunId && (
        <RunDetailSlideOver
          isOpen={detailSlideOverOpen}
          runId={detailRunId}
          onClose={() => {
            setDetailSlideOverOpen(false);
            setDetailRunId(null);
          }}
          onRollback={() => {
            const run = runs.find(r => r.id === detailRunId);
            if (run) {
              setDetailSlideOverOpen(false);
              handleRollbackClick(run);
            }
          }}
          showRollbackButton={(() => {
            const run = runs.find(r => r.id === detailRunId);
            if (!run) return false;
            const expired = isRollbackExpired(run.rollback_expires_at);
            return run.rollback_available && run.status === 'completed' && !expired;
          })()}
        />
      )}

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
