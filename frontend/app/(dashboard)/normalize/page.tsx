'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, RotateCcw, Loader2, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Toggle, PrimaryBtn, Chip } from '@/components/refyne';
import { RollbackConfirmModal } from '@/components/normalize/RollbackConfirmModal';
import { RunDetailSlideOver } from '@/components/normalize/RunDetailSlideOver';
import { ByCompanyView } from '@/components/normalize/ByCompanyView';
import { ByFieldView } from '@/components/normalize/ByFieldView';
import { SkippedList } from '@/components/normalize/SkippedList';
import { addToast } from '@/components/ui/toast';
import { useObjectType } from '@/hooks/useObjectType';

// Harmony list is now dynamic based on issue-counts API response

interface PreviewRecord {
  company: string;
  field: string;
  before: string;
  after: string;
  hubspotCompanyId: string;
  portalId: string;
  ruleExplanation?: string;
  excludable: boolean;
}

interface NormalizeRun {
  id: string;
  created_at: string;
  records_changed: number;
  status: 'running' | 'completed' | 'failed' | 'rolling_back' | 'rolled_back';
  rollback_available: boolean;
  rollback_expires_at: string | null;
}

type ViewMode = 'by-company' | 'by-field';
type TabMode = 'preview' | 'skipped';

export default function NormalizePage() {
  const [objectType] = useObjectType();
  const [active, setActive] = useState<string[]>([]);
  const toggle = (id: string) => setActive(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);

  // Source filter state
  const [sourceType, setSourceType] = useState<'all' | 'issues' | 'list'>('issues');
  const [selectedHarmonyFilters, setSelectedHarmonyFilters] = useState<Set<string>>(new Set());
  const [issueCounts, setIssueCounts] = useState<Record<string, number>>({});
  const [countsLoading, setCountsLoading] = useState(true);

  // Tab state
  const [currentTab, setCurrentTab] = useState<TabMode>('preview');

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('by-company');

  // Preview state
  const [preview, setPreview] = useState<PreviewRecord[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLoadedAt, setPreviewLoadedAt] = useState<Date | null>(null);

  // Selection state
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());

  // Apply state
  const [applyLoading, setApplyLoading] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

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

  // Fetch issue counts
  const fetchIssueCounts = async () => {
    try {
      // Add nocache parameter to force recalculation (skip Redis cache)
      const response = await fetch(`/api/normalize/issue-counts?nocache=1&objectType=${objectType}`);
      if (response.ok) {
        const data = await response.json();
        const counts = data.counts || {};
        setIssueCounts(counts);

        // Use harmony IDs from API response to populate the toggle list
        const harmonyIds = Object.keys(counts);
        if (harmonyIds.length > 0 && active.length === 0) {
          // Initialize active state with all harmonies from API
          setActive(harmonyIds);
          setSelectedHarmonyFilters(new Set(harmonyIds));
        }
      }
    } catch (error) {
      console.error('Failed to load issue counts:', error);
    } finally {
      setCountsLoading(false);
    }
  };

  // Load issue counts when component mounts or objectType changes
  useEffect(() => {
    setCountsLoading(true);
    fetchIssueCounts();
  }, [objectType]);

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

  // Check for stale preview every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Trigger re-render to update staleness check
      if (previewLoadedAt) {
        setPreviewLoadedAt(new Date(previewLoadedAt));
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [previewLoadedAt]);

  const fetchPreview = async () => {
    if (active.length === 0) {
      addToast('error', 'Please enable at least one harmony');
      return;
    }

    setPreviewLoading(true);

    try {
      let companyIds: string[] | undefined;

      // Fetch company IDs with issues if source type is 'issues'
      if (sourceType === 'issues' && selectedHarmonyFilters.size > 0) {
        const harmonyFiltersParam = Array.from(selectedHarmonyFilters).join(',');
        const issuesResponse = await fetch(`/api/normalize/companies-with-issues?harmonyIds=${harmonyFiltersParam}&objectType=${objectType}`);

        if (!issuesResponse.ok) {
          throw new Error('Failed to fetch companies with issues');
        }

        const issuesData = await issuesResponse.json();
        companyIds = issuesData.companyIds;

        if (!companyIds || companyIds.length === 0) {
          setPreview([]);
          addToast('success', `No ${objectType === 'contact' ? 'contacts' : 'companies'} need normalization for selected harmonies`);
          setPreviewLoading(false);
          return;
        }
      }

      // Pass active harmony IDs and optional company IDs to preview API
      const harmonyIdsParam = `&harmonyIds=${active.join(',')}`;
      const companyIdsParam = companyIds ? `&companyIds=${companyIds.join(',')}` : '';
      const response = await fetch(`/api/normalize/preview?limit=50${harmonyIdsParam}${companyIdsParam}&objectType=${objectType}`);

      if (!response.ok) {
        throw new Error('Failed to fetch preview');
      }

      const data = await response.json();
      setPreview(data.preview || []);
      setPreviewLoadedAt(new Date());

      // Show feedback based on results
      if (data.preview && data.preview.length > 0) {
        addToast('success', `Found ${data.preview.length} potential changes`);
      } else {
        addToast('success', 'No changes detected. All records match harmonies.');
      }

      // Refresh issue counts after preview loads
      fetchIssueCounts();

      // Auto-select all changes by default
      const allIds = new Set<string>(
        (data.preview || []).map((r: PreviewRecord) => `${r.hubspotCompanyId}:${r.field}`)
      );
      setSelectedChanges(allIds);
    } catch (error) {
      console.error('Failed to fetch preview:', error);
      addToast('error', 'Failed to load preview. Check console for details.');
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

      // Update run in the list with all fields
      setRuns(prev => prev.map(run =>
        run.id === runId ? { ...run, ...data } : run
      ));

      // Stop polling when run reaches terminal state
      if (data.status === 'completed') {
        setPollingRunId(null);
      } else if (data.status === 'rolled_back') {
        addToast('success', `${(data.records_changed ?? 0).toLocaleString()} records reverted successfully`);
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

  const handleToggleChange = (id: string) => {
    setSelectedChanges(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = new Set<string>(
      preview.map(r => `${r.hubspotCompanyId}:${r.field}`)
    );
    setSelectedChanges(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedChanges(new Set());
    setPreviewLoadedAt(null);
  };

  const handleApplyClick = () => {
    if (selectedChanges.size === 0) {
      addToast('error', 'No changes selected');
      return;
    }
    setConfirmModalOpen(true);
  };

  const handleApplyConfirm = async () => {
    setApplyLoading(true);
    setConfirmModalOpen(false);

    try {
      // Convert selectedChanges to array of objects
      const selectedChangesArray = Array.from(selectedChanges).map(id => {
        const [companyId, field] = id.split(':');
        return { companyId, field };
      });

      const response = await fetch('/api/normalize/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          harmonyIds: active,
          selectedChanges: selectedChangesArray,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Apply failed');
      }

      const data = await response.json();
      addToast('success', `Normalization run started (${data.runId.slice(0, 8)})`);

      // Start polling for run status
      setPollingRunId(data.runId);

      // Clear preview loaded timestamp
      setPreviewLoadedAt(null);

      // Refresh preview
      fetchPreview();

      // Refresh issue counts
      fetchIssueCounts();

      // Expand history and refresh runs
      setHistoryExpanded(true);
      fetchRuns();
    } catch (error) {
      console.error('Apply failed:', error);
      addToast('error', 'Failed to apply changes');
    } finally {
      setApplyLoading(false);
    }
  };

  const handleExclusionCreated = () => {
    // Refresh preview when exclusion is created
    fetchPreview();
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

  // Calculate if preview is stale (> 5 minutes old)
  const isStale = previewLoadedAt && (Date.now() - previewLoadedAt.getTime()) > 5 * 60 * 1000;

  const handleLoadPreview = () => {
    fetchPreview();
  };

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: F.sans, flexDirection: 'column' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Harmonies sidebar */}
        <div style={{ width: 232, background: C.sidebar, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Source</div>
          </div>

          {/* Source selector */}
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
            {/* All companies option */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
              <input
                type="radio"
                name="source"
                value="all"
                checked={sourceType === 'all'}
                onChange={(e) => setSourceType(e.target.value as 'all' | 'issues' | 'list')}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: 11, color: C.text2 }}>All {objectType === 'contact' ? 'contacts' : 'companies'}</span>
            </label>

            {/* Records with issues option */}
            <label style={{ display: 'flex', alignItems: 'start', gap: 8, marginBottom: 4, cursor: 'pointer' }}>
              <input
                type="radio"
                name="source"
                value="issues"
                checked={sourceType === 'issues'}
                onChange={(e) => setSourceType(e.target.value as 'all' | 'issues' | 'list')}
                style={{ cursor: 'pointer', marginTop: 2 }}
              />
              <span style={{ fontSize: 11, color: C.text2 }}>{objectType === 'contact' ? 'Contacts' : 'Companies'} with issues</span>
            </label>

            {/* Harmony filter checkboxes (shown when "issues" selected) */}
            {sourceType === 'issues' && (
              <div style={{ marginLeft: 20, marginTop: 8, paddingLeft: 8, borderLeft: `2px solid ${C.border2}` }}>
                {countsLoading ? (
                  <div style={{ padding: '8px 0', fontSize: 10, color: C.text3 }}>Loading counts...</div>
                ) : (
                  Object.keys(issueCounts).map(harmonyId => {
                    const count = issueCounts[harmonyId] || 0;
                    const isChecked = selectedHarmonyFilters.has(harmonyId);

                    return (
                      <label
                        key={harmonyId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 6,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const newSet = new Set(selectedHarmonyFilters);
                            if (e.target.checked) {
                              newSet.add(harmonyId);
                            } else {
                              newSet.delete(harmonyId);
                            }
                            setSelectedHarmonyFilters(newSet);
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 10, fontFamily: F.mono, color: count > 0 ? C.text : C.text3 }}>
                          {harmonyId}
                        </span>
                        <span style={{ fontSize: 9, color: count > 0 ? C.amber : C.text3, fontWeight: 500 }}>
                          ({count})
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Harmonies list */}
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Harmonies</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {Object.keys(issueCounts).map(id => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 11, fontFamily: F.mono, color: active.includes(id) ? C.text : C.text3 }}>{id}</span>
                <Toggle on={active.includes(id)} onToggle={() => toggle(id)} />
              </div>
            ))}
          </div>
          <div style={{ padding: 12, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.text3, marginBottom: 8 }}>
              Don't see a field you need?
            </div>
            <a
              href="/normalize/harmonies/new"
              style={{
                display: 'block',
                padding: '6px 12px',
                background: 'transparent',
                border: `1px solid ${C.border2}`,
                borderRadius: 5,
                fontSize: 11,
                color: C.indigo,
                textDecoration: 'none',
                textAlign: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              + Add custom rule
            </a>
          </div>
          <div style={{ padding: 16, borderTop: `1px solid ${C.border}` }}>
            <PrimaryBtn onClick={fetchPreview} disabled={previewLoading}>
              {previewLoading ? 'Loading...' : 'Load preview'}
            </PrimaryBtn>
          </div>
        </div>

        {/* Main content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Top tabs */}
          <div style={{ borderBottom: `1px solid ${C.border}`, background: C.sidebar }}>
            <div style={{ display: 'flex', gap: 24, padding: '0 24px' }}>
              <button
                onClick={() => setCurrentTab('preview')}
                style={{
                  padding: '12px 0',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: currentTab === 'preview' ? `2px solid ${C.indigo}` : '2px solid transparent',
                  fontSize: 13,
                  fontWeight: 600,
                  color: currentTab === 'preview' ? C.text : C.text3,
                  cursor: 'pointer',
                }}
              >
                Preview
              </button>
              <button
                onClick={() => setCurrentTab('skipped')}
                style={{
                  padding: '12px 0',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: currentTab === 'skipped' ? `2px solid ${C.indigo}` : '2px solid transparent',
                  fontSize: 13,
                  fontWeight: 600,
                  color: currentTab === 'skipped' ? C.text : C.text3,
                  cursor: 'pointer',
                }}
              >
                Skipped
              </button>
            </div>
          </div>

          {/* Preview tab content */}
          {currentTab === 'preview' && (
            <>
              {/* View controls bar */}
              <div style={{ padding: '12px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* View mode toggle */}
                  <div style={{ display: 'flex', gap: 4, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 6, padding: 2 }}>
                    <button
                      onClick={() => setViewMode('by-company')}
                      style={{
                        padding: '4px 12px',
                        background: viewMode === 'by-company' ? C.indigo : 'transparent',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        color: viewMode === 'by-company' ? '#fff' : C.text3,
                        cursor: 'pointer',
                      }}
                    >
                      By Company
                    </button>
                    <button
                      onClick={() => setViewMode('by-field')}
                      style={{
                        padding: '4px 12px',
                        background: viewMode === 'by-field' ? C.indigo : 'transparent',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        color: viewMode === 'by-field' ? '#fff' : C.text3,
                        cursor: 'pointer',
                      }}
                    >
                      By Field
                    </button>
                  </div>

                  {/* Select/deselect buttons */}
                  <button
                    onClick={handleSelectAll}
                    style={{
                      padding: '4px 12px',
                      background: 'transparent',
                      border: `1px solid ${C.border2}`,
                      borderRadius: 5,
                      fontSize: 11,
                      color: C.text,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    Select all
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    style={{
                      padding: '4px 12px',
                      background: 'transparent',
                      border: `1px solid ${C.border2}`,
                      borderRadius: 5,
                      fontSize: 11,
                      color: C.text,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    Deselect all
                  </button>
                </div>

                <span style={{ fontSize: 12, color: C.text2 }}>
                  {preview.length} change{preview.length !== 1 ? 's' : ''} found
                </span>
              </div>

              {/* Preview content */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {previewLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
                    <Loader2 size={24} color={C.text3} style={{ animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : (
                  <>
                    {/* Stale preview warning */}
                    {previewLoadedAt && isStale && (
                      <div style={{
                        padding: '12px 16px',
                        background: '#FEF3C7',
                        border: '1px solid #F59E0B',
                        borderRadius: 6,
                        margin: '16px 24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span style={{ fontSize: 13, color: '#92400E' }}>
                          Preview data is over 5 minutes old. Reload preview before applying to avoid stale changes.
                        </span>
                        <button
                          onClick={handleLoadPreview}
                          style={{
                            padding: '6px 12px',
                            background: '#F59E0B',
                            border: 'none',
                            borderRadius: 4,
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Reload now
                        </button>
                      </div>
                    )}

                    {viewMode === 'by-company' ? (
                      <ByCompanyView
                        changes={preview}
                        selectedChanges={selectedChanges}
                        onToggle={handleToggleChange}
                        onExclusionCreated={handleExclusionCreated}
                      />
                    ) : (
                      <ByFieldView
                        changes={preview}
                        selectedChanges={selectedChanges}
                        onToggle={handleToggleChange}
                        onExclusionCreated={handleExclusionCreated}
                      />
                    )}
                  </>
                )}
              </div>

              {/* Action bar (shown when changes selected) */}
              {selectedChanges.size > 0 && (
                <div
                  style={{
                    borderTop: `1px solid ${C.border}`,
                    background: C.sidebar,
                    padding: '12px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 13, color: C.text2 }}>
                    {selectedChanges.size} change{selectedChanges.size !== 1 ? 's' : ''} selected
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleDeselectAll}
                      style={{
                        padding: '8px 16px',
                        background: 'transparent',
                        border: `1px solid ${C.border2}`,
                        borderRadius: 6,
                        fontSize: 13,
                        color: C.text,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApplyClick}
                      disabled={applyLoading}
                      style={{
                        padding: '8px 16px',
                        background: C.indigo,
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#fff',
                        cursor: applyLoading ? 'not-allowed' : 'pointer',
                        opacity: applyLoading ? 0.6 : 1,
                      }}
                    >
                      {applyLoading ? 'Applying...' : 'Apply Selected Changes →'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Skipped tab content */}
          {currentTab === 'skipped' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <SkippedList />
            </div>
          )}
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
                            {run.created_at ? new Date(run.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            }) : 'Pending'}
                          </td>
                          <td style={{ padding: '10px 24px', fontFamily: F.mono, color: C.text, fontSize: 11 }}>
                            {(run.records_changed ?? 0).toLocaleString()}
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

      {/* Apply confirmation modal */}
      {confirmModalOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 9998,
            }}
            onClick={() => setConfirmModalOpen(false)}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 480,
              maxHeight: '90vh',
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 9999,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <AlertCircle size={24} color={C.indigo} />
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>
                Apply {selectedChanges.size} normalization change{selectedChanges.size !== 1 ? 's' : ''}?
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: 16 }}>
              This will update {selectedChanges.size} field{selectedChanges.size !== 1 ? 's' : ''} in HubSpot. You can roll back within 30 days.
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  background: C.surface,
                  border: `1px solid ${C.border2}`,
                  borderRadius: 6,
                  color: C.text,
                  fontSize: 13,
                  fontFamily: F.sans,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleApplyConfirm}
                style={{
                  padding: '8px 16px',
                  background: C.indigo,
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: F.sans,
                  cursor: 'pointer',
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </>
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
