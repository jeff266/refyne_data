'use client';

import { useState, useEffect } from 'react';
import { X, Download, ChevronDown, Search, Loader2 } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { PrimaryBtn } from '@/components/refyne';

interface RunDetails {
  id: string;
  started_at: string;
  completed_at: string | null;
  initiated_by: string | null;
  records_changed: number;
  records_processed: number;
  records_failed: number;
  fieldsChanged: string[];
  status: string;
  harmonies: Array<{
    id: string;
    name: string;
  }>;
}

interface ChangeRecord {
  id: string;
  hubspot_company_id: string;
  company_name: string | null;
  field_name: string;
  value_before: string | null;
  value_after: string | null;
  harmony_name: string | null;
}

interface RunDetailSlideOverProps {
  isOpen: boolean;
  runId: string;
  onClose: () => void;
  onRollback?: () => void;
  showRollbackButton?: boolean;
}

export function RunDetailSlideOver({
  isOpen,
  runId,
  onClose,
  onRollback,
  showRollbackButton = false,
}: RunDetailSlideOverProps) {
  const [details, setDetails] = useState<RunDetails | null>(null);
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [changesLoading, setChangesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters and pagination
  const [selectedField, setSelectedField] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [exporting, setExporting] = useState(false);

  const CHANGES_PER_PAGE = 100;

  // Fetch run details
  useEffect(() => {
    if (isOpen && runId) {
      fetchDetails();
    }
  }, [isOpen, runId]);

  // Fetch changes when filters or page changes
  useEffect(() => {
    if (isOpen && runId) {
      fetchChanges();
    }
  }, [isOpen, runId, selectedField, searchQuery, currentPage]);

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/normalize/runs/${runId}/details`);

      if (!response.ok) {
        throw new Error('Failed to fetch run details');
      }

      const data = await response.json();
      setDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  const fetchChanges = async () => {
    setChangesLoading(true);

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: CHANGES_PER_PAGE.toString(),
      });

      if (selectedField !== 'all') {
        params.append('field', selectedField);
      }

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(`/api/normalize/runs/${runId}/changes?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch changes');
      }

      const data = await response.json();
      setChanges(data.changes);
      setTotalPages(Math.ceil(data.total / CHANGES_PER_PAGE));
    } catch (err) {
      console.error('Failed to fetch changes:', err);
      setChanges([]);
    } finally {
      setChangesLoading(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);

    try {
      const params = new URLSearchParams();

      if (selectedField !== 'all') {
        params.append('field', selectedField);
      }

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(`/api/normalize/runs/${runId}/export?${params}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `normalize-run-${runId.slice(0, 8)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  // Get unique fields from details
  const uniqueFields = details?.harmonies.map(h => h.name) || [];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 40,
        }}
      />

      {/* Slide Over */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        maxWidth: 720,
        background: C.surface,
        borderLeft: `1px solid ${C.border}`,
        boxShadow: '-10px 0 50px rgba(0,0,0,0.5)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: F.sans,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: 0 }}>
              Run Details
            </h2>
            <p style={{ fontSize: 12, color: C.text2, margin: '4px 0 0 0', fontFamily: F.mono }}>
              {runId.slice(0, 8)}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: 8,
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: C.text3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = C.hover}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
              <Loader2 size={32} color={C.text3} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : error ? (
            <div style={{ padding: 24 }}>
              <div style={{
                padding: 16,
                background: C.redDim,
                border: `1px solid rgba(239,68,68,0.3)`,
                borderRadius: 8,
              }}>
                <p style={{ fontSize: 13, color: C.red, margin: 0 }}>{error}</p>
              </div>
            </div>
          ) : details ? (
            <>
              {/* Run Metadata */}
              <div style={{ padding: 24, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                      Initiated By
                    </div>
                    <div style={{ fontSize: 13, color: C.text }}>
                      {details.initiated_by || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                      Date
                    </div>
                    <div style={{ fontSize: 13, color: C.text }}>
                      {new Date(details.started_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                      Records Changed
                    </div>
                    <div style={{ fontSize: 20, color: C.text, fontWeight: 600, fontFamily: F.mono }}>
                      {(details.records_changed ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                      Fields Changed
                    </div>
                    <div style={{ fontSize: 20, color: C.text, fontWeight: 600, fontFamily: F.mono }}>
                      {(details.fieldsChanged?.length ?? 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Harmonies Applied */}
              <div style={{ padding: 24, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                  Harmonies Applied
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {details.harmonies.map((harmony) => (
                    <div key={harmony.id} style={{
                      padding: '4px 10px',
                      background: C.indigoDim,
                      border: `1px solid ${C.indigoBrd}`,
                      borderRadius: 6,
                      fontSize: 11,
                      color: C.indigoLt,
                      fontFamily: F.mono,
                    }}>
                      {harmony.name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Filters */}
              <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={14} color={C.text3} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search company name or ID..."
                    style={{
                      width: '100%',
                      padding: '6px 10px 6px 32px',
                      background: C.bg,
                      border: `1px solid ${C.border2}`,
                      borderRadius: 6,
                      fontSize: 12,
                      color: C.text,
                      outline: 'none',
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = C.indigoBrd}
                    onBlur={(e) => e.currentTarget.style.borderColor = C.border2}
                  />
                </div>
                <div style={{ position: 'relative' }}>
                  <select
                    value={selectedField}
                    onChange={(e) => {
                      setSelectedField(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '6px 32px 6px 10px',
                      background: C.bg,
                      border: `1px solid ${C.border2}`,
                      borderRadius: 6,
                      fontSize: 12,
                      color: C.text,
                      outline: 'none',
                      cursor: 'pointer',
                      appearance: 'none',
                    }}
                  >
                    <option value="all">All fields</option>
                    {uniqueFields.map((field) => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} color={C.text3} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
                <button
                  onClick={handleExportCSV}
                  disabled={exporting}
                  style={{
                    padding: '6px 12px',
                    background: C.hover,
                    border: `1px solid ${C.border2}`,
                    borderRadius: 6,
                    fontSize: 12,
                    color: C.text,
                    cursor: exporting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    opacity: exporting ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => !exporting && (e.currentTarget.style.background = C.surface)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = C.hover)}
                >
                  {exporting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
                  Export CSV
                </button>
              </div>

              {/* Changes Table */}
              <div style={{ minHeight: 400 }}>
                {changesLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
                    <Loader2 size={24} color={C.text3} style={{ animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : changes.length === 0 ? (
                  <div style={{ padding: 60, textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: C.text3 }}>No changes found</p>
                  </div>
                ) : (
                  <>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          <th style={{ padding: '10px 24px', textAlign: 'left', color: C.text3, fontSize: 11, fontWeight: 500, letterSpacing: '0.03em' }}>Company</th>
                          <th style={{ padding: '10px 24px', textAlign: 'left', color: C.text3, fontSize: 11, fontWeight: 500, letterSpacing: '0.03em' }}>Field</th>
                          <th style={{ padding: '10px 24px', textAlign: 'left', color: C.text3, fontSize: 11, fontWeight: 500, letterSpacing: '0.03em' }}>Before</th>
                          <th style={{ padding: '10px 24px', textAlign: 'left', color: C.text3, fontSize: 11, fontWeight: 500, letterSpacing: '0.03em' }}>After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {changes.map((change) => (
                          <tr key={change.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ padding: '12px 24px', color: C.text }}>{change.company_name || change.hubspot_company_id}</td>
                            <td style={{ padding: '12px 24px', fontFamily: F.mono, color: C.text3, fontSize: 11 }}>{change.field_name}</td>
                            <td style={{ padding: '12px 24px', fontFamily: F.mono, color: C.red, fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {change.value_before || '—'}
                            </td>
                            <td style={{ padding: '12px 24px', fontFamily: F.mono, color: C.green, fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {change.value_after || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 12, color: C.text2 }}>
                          Page {currentPage} of {totalPages}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            style={{
                              padding: '4px 12px',
                              background: C.hover,
                              border: `1px solid ${C.border2}`,
                              borderRadius: 6,
                              fontSize: 12,
                              color: C.text,
                              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                              opacity: currentPage === 1 ? 0.5 : 1,
                            }}
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            style={{
                              padding: '4px 12px',
                              background: C.hover,
                              border: `1px solid ${C.border2}`,
                              borderRadius: 6,
                              fontSize: 12,
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
            </>
          ) : null}
        </div>

        {/* Footer with Rollback Button */}
        {showRollbackButton && details && (
          <div style={{
            padding: '16px 24px',
            borderTop: `1px solid ${C.border}`,
            background: C.sidebar,
          }}>
            <PrimaryBtn onClick={onRollback}>
              Rollback this run
            </PrimaryBtn>
          </div>
        )}
      </div>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
