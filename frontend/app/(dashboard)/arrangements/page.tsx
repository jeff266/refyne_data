'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Plus, Play, Edit, MoreVertical, Trash2, X } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { PrimaryBtn } from '@/components/refyne';
import { addToast } from '@/components/ui/toast';

interface Arrangement {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  enrichment_steps: Array<{ provider: string; fields: string[]; order: number }>;
  last_run_at: string | null;
  last_run_stats?: {
    records_enriched: number;
    fill_rate: number;
    duration_seconds: number;
  };
  total_runs: number;
  total_records_processed: number;
  total_credits_used: number;
  created_at: string;
}

interface Run {
  id: string;
  type: 'enrichment' | 'segmentation';
  name: string;
  status: 'pending' | 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  started_at?: string;
  created_at: string;
  completed_at?: string;
  total_records?: number;
  records_processed?: number;
  processed_count?: number;
  updated_count?: number;
  skipped_count?: number;
  error_count?: number;
  level_field?: string;
  function_field?: string;
}

interface RunEstimate {
  estimated_records: number;
  provider: string;
  is_byok: boolean;
  credits_required: number;
  credits_available: number;
}

type Tab = 'arrangements' | 'history';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (diffDays === 0) return `${monthDay} · today`;
  if (diffDays === 1) return `${monthDay} · yesterday`;
  if (diffDays < 7) return `${monthDay} · ${diffDays} days ago`;
  return monthDay;
}

export default function ArrangementsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { orgRole } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('arrangements');
  const [arrangements, setArrangements] = useState<Arrangement[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [runConfirmModalOpen, setRunConfirmModalOpen] = useState(false);
  const [arrangementToRun, setArrangementToRun] = useState<Arrangement | null>(null);
  const [runEstimate, setRunEstimate] = useState<RunEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);

  const [arrangementToDelete, setArrangementToDelete] = useState<Arrangement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [running, setRunning] = useState(false);

  // Dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const isViewer = orgRole === 'org:viewer';
  const canCreate = !isViewer;

  useEffect(() => {
    fetchArrangements();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchRuns();
    }
  }, [activeTab]);

  const fetchArrangements = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/arrangements');
      if (!response.ok) throw new Error('Failed to fetch arrangements');
      const data = await response.json();
      setArrangements(data.arrangements);
    } catch (error) {
      console.error('Failed to fetch arrangements:', error);
      addToast('error', 'Failed to load arrangements');
    } finally {
      setLoading(false);
    }
  };

  const fetchRuns = async () => {
    setRunsLoading(true);
    try {
      const response = await fetch('/api/arrangements/runs?per_page=50');
      if (!response.ok) throw new Error('Failed to fetch runs');
      const data = await response.json();
      setRuns(data.runs);
    } catch (error) {
      console.error('Failed to fetch runs:', error);
      addToast('error', 'Failed to load run history');
    } finally {
      setRunsLoading(false);
    }
  };

  const fetchRunEstimate = async (arrangementId: string) => {
    setEstimateLoading(true);
    try {
      const response = await fetch(`/api/arrangements/${arrangementId}/estimate`);
      if (!response.ok) throw new Error('Failed to fetch estimate');
      const data = await response.json();
      setRunEstimate(data);
    } catch (error) {
      console.error('Failed to fetch estimate:', error);
      setRunEstimate({
        estimated_records: 0,
        provider: 'Unknown',
        is_byok: false,
        credits_required: 0,
        credits_available: 0,
      });
    } finally {
      setEstimateLoading(false);
    }
  };

  const handleCreateNew = async () => {
    try {
      // Check onboarding status
      const res = await fetch('/api/arrangements/onboarding');
      if (res.ok) {
        const { arrangements_onboarding_complete } = await res.json();

        if (!arrangements_onboarding_complete) {
          // Redirect to calibration with onboarding flag
          router.push('/settings?tab=calibration&onboarding=true');
          return;
        }
      }

      // Onboarding complete, proceed to wizard
      router.push('/arrangements/new');
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
      // Proceed anyway on error
      router.push('/arrangements/new');
    }
  };

  const handleRunClick = async (arrangement: Arrangement) => {
    setArrangementToRun(arrangement);
    setRunConfirmModalOpen(true);
    await fetchRunEstimate(arrangement.id);
  };

  const handleRunConfirm = async () => {
    if (!arrangementToRun) return;

    setRunning(true);
    try {
      const response = await fetch(`/api/arrangements/${arrangementToRun.id}/run`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to start run');
      const data = await response.json();
      addToast('success', 'Run started successfully');
      setRunConfirmModalOpen(false);
      setArrangementToRun(null);
      router.push(`/arrangements/runs/${data.runId}`);
    } catch (error) {
      console.error('Failed to start run:', error);
      addToast('error', 'Failed to start run');
    } finally {
      setRunning(false);
    }
  };

  const handleDeleteClick = (arrangement: Arrangement) => {
    setArrangementToDelete(arrangement);
    setDeleteModalOpen(true);
    setOpenDropdownId(null);
  };

  const handleDeleteConfirm = async () => {
    if (!arrangementToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/arrangements/${arrangementToDelete.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete arrangement');

      addToast('success', 'Arrangement deleted successfully');
      setDeleteModalOpen(false);
      setArrangementToDelete(null);

      // Refresh the list
      await fetchArrangements();
    } catch (error) {
      console.error('Failed to delete arrangement:', error);
      addToast('error', 'Failed to delete arrangement');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    setDeleting(true);
    try {
      const deletePromises = Array.from(selectedIds).map(id =>
        fetch(`/api/arrangements/${id}`, { method: 'DELETE' })
      );

      await Promise.all(deletePromises);

      addToast('success', `${selectedIds.size} arrangement${selectedIds.size > 1 ? 's' : ''} deleted successfully`);
      setBulkDeleteModalOpen(false);
      setSelectedIds(new Set());

      // Refresh the list
      await fetchArrangements();
    } catch (error) {
      console.error('Failed to delete arrangements:', error);
      addToast('error', 'Failed to delete arrangements');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === arrangements.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(arrangements.map(a => a.id)));
    }
  };

  const getStatusBadge = (arrangement: Arrangement) => {
    // Determine status based on last run
    if (!arrangement.last_run_at) {
      return (
        <span style={{
          padding: '4px 10px',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 500,
          background: 'rgba(255,255,255,0.05)',
          color: 'rgba(249,248,245,0.4)',
        }}>
          Never run
        </span>
      );
    }

    // For now, assume completed if last_run_at exists
    // TODO: Check actual status from last run
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 500,
        background: 'rgba(34,197,94,0.15)',
        color: '#22c55e',
      }}>
        Completed
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: 32, color: C.text2 }}>
        Loading arrangements...
      </div>
    );
  }

  // Empty state
  if (arrangements.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: 32,
        }}
      >
        <h2
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: C.text,
            marginBottom: 8,
          }}
        >
          No arrangements yet
        </h2>
        <p
          style={{
            fontSize: 14,
            color: C.text2,
            marginBottom: 24,
            textAlign: 'center',
            maxWidth: 520,
            lineHeight: '1.6',
          }}
        >
          Create a multi-provider enrichment pipeline to fill gaps in your HubSpot data.
        </p>
        {canCreate && (
          <PrimaryBtn onClick={handleCreateNew}>
            <Plus size={16} />
            New arrangement
          </PrimaryBtn>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 4 }}>
            Arrangements
          </h1>
          <p style={{ fontSize: 14, color: C.text3 }}>Multi-provider enrichment pipelines</p>
        </div>
        {canCreate && (
          <PrimaryBtn onClick={handleCreateNew}>
            <Plus size={16} />
            New arrangement
          </PrimaryBtn>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: `1px solid ${C.border}`,
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => setActiveTab('arrangements')}
          style={{
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            color: activeTab === 'arrangements' ? C.text : C.text2,
            borderBottom: `2px solid ${activeTab === 'arrangements' ? C.indigo : 'transparent'}`,
            marginBottom: '-1px',
            fontFamily: F.sans,
          }}
        >
          Arrangements
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            color: activeTab === 'history' ? C.text : C.text2,
            borderBottom: `2px solid ${activeTab === 'history' ? C.indigo : 'transparent'}`,
            marginBottom: '-1px',
            fontFamily: F.sans,
          }}
        >
          History
        </button>
      </div>

      {/* Arrangements tab content */}
      {activeTab === 'arrangements' && (
        <>
          {/* Bulk actions bar */}
          {selectedIds.size > 0 && canCreate && (
            <div
              style={{
                padding: '12px 16px',
                background: '#162944',
                border: `1px solid ${C.border}`,
                borderBottom: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <span style={{ fontSize: 14, color: C.text2, fontFamily: F.sans }}>
                {selectedIds.size} arrangement{selectedIds.size > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setBulkDeleteModalOpen(true)}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: C.red,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: F.sans,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                Delete selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: C.text3,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: F.sans,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                Deselect all
              </button>
            </div>
          )}

          {/* Table */}
          <div>
            {/* Header row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: canCreate ? '40px 2fr 1.5fr 140px 120px 180px' : '2fr 1.5fr 140px 120px 180px',
                padding: '12px 16px',
                background: '#1C3654',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                fontSize: 12,
                fontWeight: 600,
                color: C.text3,
                fontFamily: F.sans,
              }}
            >
              {canCreate && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === arrangements.length}
                    onChange={toggleSelectAll}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: 'pointer',
                      accentColor: '#2E6BA8',
                    }}
                  />
                </div>
              )}
              <div>Name</div>
              <div>Fields</div>
              <div>Last run</div>
              <div>Status</div>
              <div>Actions</div>
            </div>

            {/* Data rows */}
            {arrangements.map((arr) => {
              const steps = arr.enrichment_steps || [];
              const totalFields = new Set(steps.flatMap((step) => step.fields)).size;
              const fieldsText = steps
                .flatMap((step) => step.fields)
                .slice(0, 3)
                .join(', ');
              const remainingFields = totalFields - 3;

              return (
                <div
                  key={arr.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: canCreate ? '40px 2fr 1.5fr 140px 120px 180px' : '2fr 1.5fr 140px 120px 180px',
                    padding: '12px 16px',
                    background: '#162944',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    fontSize: 14,
                    alignItems: 'center',
                    fontFamily: F.sans,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#162944';
                  }}
                >
                  {canCreate && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(arr.id)}
                        onChange={() => toggleSelect(arr.id)}
                        style={{
                          width: 16,
                          height: 16,
                          cursor: 'pointer',
                          accentColor: '#2E6BA8',
                        }}
                      />
                    </div>
                  )}
                  <div
                    style={{
                      fontWeight: 500,
                      color: C.text,
                      cursor: 'pointer',
                    }}
                    onClick={() => router.push(`/arrangements/${arr.id}`)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textDecoration = 'none';
                    }}
                  >
                    {arr.name}
                  </div>
                  <div style={{ color: 'rgba(249,248,245,0.7)' }}>
                    {fieldsText}
                    {remainingFields > 0 && `, +${remainingFields} more`}
                  </div>
                  <div style={{ color: 'rgba(249,248,245,0.7)' }}>
                    {arr.last_run_at ? formatDate(arr.last_run_at) : '—'}
                  </div>
                  <div>{getStatusBadge(arr)}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {canCreate && (
                      <>
                        <button
                          onClick={() => handleRunClick(arr)}
                          style={{
                            padding: '6px 12px',
                            background: C.indigo,
                            border: 'none',
                            borderRadius: 6,
                            color: C.text,
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: 'pointer',
                            fontFamily: F.sans,
                          }}
                        >
                          Run
                        </button>
                        <button
                          onClick={() => router.push(`/arrangements/new?edit=${arr.id}`)}
                          style={{
                            padding: '6px 12px',
                            background: 'transparent',
                            border: `1px solid ${C.border2}`,
                            borderRadius: 6,
                            color: C.text2,
                            fontSize: 13,
                            cursor: 'pointer',
                            fontFamily: F.sans,
                          }}
                        >
                          Edit
                        </button>
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => setOpenDropdownId(openDropdownId === arr.id ? null : arr.id)}
                            style={{
                              padding: '6px 8px',
                              background: 'transparent',
                              border: `1px solid ${C.border2}`,
                              borderRadius: 6,
                              color: C.text2,
                              fontSize: 13,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>

                          {/* Dropdown menu */}
                          {openDropdownId === arr.id && (
                            <>
                              {/* Backdrop */}
                              <div
                                style={{
                                  position: 'fixed',
                                  inset: 0,
                                  zIndex: 998,
                                }}
                                onClick={() => setOpenDropdownId(null)}
                              />
                              {/* Menu */}
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: '100%',
                                  marginTop: 4,
                                  background: C.surface,
                                  border: `1px solid ${C.border}`,
                                  borderRadius: 6,
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                  zIndex: 999,
                                  minWidth: 140,
                                }}
                              >
                                <button
                                  onClick={() => {
                                    router.push(`/arrangements/${arr.id}`);
                                    setOpenDropdownId(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'transparent',
                                    border: 'none',
                                    textAlign: 'left',
                                    color: C.text2,
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    fontFamily: F.sans,
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = C.hover;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  View details
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(arr)}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'transparent',
                                    border: 'none',
                                    textAlign: 'left',
                                    color: C.red,
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    fontFamily: F.sans,
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = C.hover;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* History tab content */}
      {activeTab === 'history' && (
        <div>
          {runsLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: C.text2 }}>
              Loading run history...
            </div>
          ) : runs.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: C.text3 }}>
              No runs yet
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {/* Table header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1.5fr 120px 100px 120px 120px 100px',
                  padding: '8px 16px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                }}
              >
                <div>Type</div>
                <div>Name</div>
                <div>Status</div>
                <div>Records</div>
                <div>Started</div>
                <div>Duration</div>
                <div></div>
              </div>

              {/* Runs */}
              {runs.map((run) => {
                const startedAt = run.started_at || run.created_at;
                const date = new Date(startedAt);
                const statusColor =
                  run.status === 'completed'
                    ? C.green
                    : run.status === 'running'
                    ? C.indigo
                    : run.status === 'failed'
                    ? C.red
                    : C.text3;

                let duration = 0;
                if (run.completed_at && startedAt) {
                  duration = Math.round(
                    (new Date(run.completed_at).getTime() - new Date(startedAt).getTime()) / 1000
                  );
                }

                const recordsCount =
                  run.type === 'segmentation'
                    ? run.processed_count || 0
                    : run.records_processed || 0;

                return (
                  <div
                    key={run.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '140px 1.5fr 120px 100px 120px 120px 100px',
                      padding: '12px 16px',
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      fontSize: 13,
                      color: C.text2,
                      alignItems: 'center',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = C.hover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = C.surface;
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 4,
                          background:
                            run.type === 'enrichment'
                              ? 'rgba(55,138,221,0.1)'
                              : 'rgba(139,92,246,0.1)',
                          color: run.type === 'enrichment' ? C.indigo : '#8B5CF6',
                          fontWeight: 500,
                        }}
                      >
                        {run.type === 'enrichment' ? 'Enrichment' : 'Segmentation'}
                      </span>
                    </div>
                    <div style={{ color: C.text, fontWeight: 500 }}>{run.name}</div>
                    <div style={{ color: statusColor }}>
                      {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                    </div>
                    <div>{recordsCount.toLocaleString()}</div>
                    <div>
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at{' '}
                      {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                    <div>
                      {duration > 0 ? formatDuration(duration) : run.status === 'running' ? 'Running...' : '—'}
                    </div>
                    <div>
                      {run.type === 'enrichment' && (
                        <button
                          onClick={() => router.push(`/arrangements/runs/${run.id}`)}
                          style={{
                            fontSize: 12,
                            color: C.indigo,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: 0,
                            fontFamily: F.sans,
                          }}
                        >
                          View →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteModalOpen && arrangementToDelete && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 9998,
            }}
            onClick={() => !deleting && setDeleteModalOpen(false)}
          />
          {/* Modal */}
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 440,
              background: '#1C3654',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 9999,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: F.sans }}>
                Delete arrangement?
              </div>
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.text3,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: 8, fontFamily: F.sans }}>
              Are you sure you want to delete <strong style={{ color: C.text }}>{arrangementToDelete.name}</strong>?
            </div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: 20, fontFamily: F.sans }}>
              This cannot be undone. Run history will be preserved.
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: `1px solid ${C.border2}`,
                  borderRadius: 6,
                  color: C.text,
                  fontSize: 13,
                  fontFamily: F.sans,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                style={{
                  padding: '8px 16px',
                  background: C.red,
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: F.sans,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bulk delete confirmation modal */}
      {bulkDeleteModalOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 9998,
            }}
            onClick={() => !deleting && setBulkDeleteModalOpen(false)}
          />
          {/* Modal */}
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 440,
              background: '#1C3654',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 9999,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: F.sans }}>
                Delete {selectedIds.size} arrangement{selectedIds.size > 1 ? 's' : ''}?
              </div>
              <button
                onClick={() => setBulkDeleteModalOpen(false)}
                disabled={deleting}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.text3,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: 20, fontFamily: F.sans }}>
              This cannot be undone. Run history will be preserved.
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setBulkDeleteModalOpen(false)}
                disabled={deleting}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: `1px solid ${C.border2}`,
                  borderRadius: 6,
                  color: C.text,
                  fontSize: 13,
                  fontFamily: F.sans,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDeleteConfirm}
                disabled={deleting}
                style={{
                  padding: '8px 16px',
                  background: C.red,
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: F.sans,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Run confirmation modal */}
      {runConfirmModalOpen && arrangementToRun && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 9998,
            }}
            onClick={() => !running && setRunConfirmModalOpen(false)}
          />
          {/* Modal */}
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 440,
              maxWidth: '90vw',
              background: '#1C3654',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 9999,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: F.sans }}>
                Run arrangement
              </div>
              <button
                onClick={() => setRunConfirmModalOpen(false)}
                disabled={running}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.text3,
                  cursor: running ? 'not-allowed' : 'pointer',
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4, fontFamily: F.sans }}>
                {arrangementToRun.name}
              </div>
              <div style={{ fontSize: 13, color: C.text3, fontFamily: F.sans }}>
                {arrangementToRun.enrichment_steps
                  ?.flatMap(step => step.fields)
                  .slice(0, 3)
                  .join(', ')}
              </div>
            </div>

            {estimateLoading ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: C.text3 }}>
                Loading estimate...
              </div>
            ) : runEstimate && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: F.sans }}>
                    Scope
                  </div>
                  <div style={{ fontSize: 13, color: C.text2, fontFamily: F.sans }}>
                    All companies with missing fields
                  </div>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 500, fontFamily: F.sans }}>
                    Estimated records: ~{runEstimate.estimated_records.toLocaleString()}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: F.sans }}>
                    Provider
                  </div>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 500, fontFamily: F.sans }}>
                    {runEstimate.provider.charAt(0).toUpperCase() + runEstimate.provider.slice(1)}
                    {runEstimate.is_byok && ' (uses your API key)'}
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: F.sans }}>
                    Credits
                  </div>
                  {runEstimate.is_byok ? (
                    <div style={{ fontSize: 13, color: C.text2, fontFamily: F.sans }}>
                      No Refyne credits used
                      <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>
                        (BYOK arrangement - {runEstimate.provider} is free from Refyne's perspective)
                      </div>
                    </div>
                  ) : runEstimate.credits_required > runEstimate.credits_available ? (
                    <div style={{ fontSize: 13, color: C.amber, fontFamily: F.sans }}>
                      ~{runEstimate.credits_required} Refyne credits required
                      <div style={{ fontSize: 12, color: C.amber, marginTop: 4 }}>
                        You have {runEstimate.credits_available} remaining. Not enough credits. Upgrade your plan.
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: C.text2, fontFamily: F.sans }}>
                      ~{runEstimate.credits_required} Refyne credits
                      <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>
                        You have {runEstimate.credits_available} remaining ({Math.round((runEstimate.credits_available - runEstimate.credits_required) / runEstimate.credits_available * 100)}% after this run)
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRunConfirmModalOpen(false)}
                disabled={running}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: `1px solid ${C.border2}`,
                  borderRadius: 6,
                  color: C.text,
                  fontSize: 13,
                  fontFamily: F.sans,
                  cursor: running ? 'not-allowed' : 'pointer',
                  opacity: running ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRunConfirm}
                disabled={running || (runEstimate && !runEstimate.is_byok && runEstimate.credits_required > runEstimate.credits_available)}
                style={{
                  padding: '8px 16px',
                  background: C.indigo,
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: F.sans,
                  cursor: running || (runEstimate && !runEstimate.is_byok && runEstimate.credits_required > runEstimate.credits_available) ? 'not-allowed' : 'pointer',
                  opacity: running || (runEstimate && !runEstimate.is_byok && runEstimate.credits_required > runEstimate.credits_available) ? 0.6 : 1,
                }}
              >
                {running ? 'Starting...' : 'Run arrangement →'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
