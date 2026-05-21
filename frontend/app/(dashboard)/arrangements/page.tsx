'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Workflow, Plus, Play, Edit, Clock, Trash2 } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { PrimaryBtn, GhostBtn } from '@/components/refyne';
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

export default function ArrangementsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { orgRole } = useAuth();
  const [arrangements, setArrangements] = useState<Arrangement[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [arrangementToDelete, setArrangementToDelete] = useState<Arrangement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const isViewer = orgRole === 'org:viewer';
  const canCreate = !isViewer;

  useEffect(() => {
    fetchArrangements();
  }, []);

  // Handle highlight from query param
  useEffect(() => {
    const highlight = searchParams.get('highlight');
    if (highlight && arrangements.length > 0) {
      setHighlightedId(highlight);

      // Scroll to highlighted arrangement
      setTimeout(() => {
        const ref = highlightRefs.current[highlight];
        if (ref) {
          ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);

      // Remove highlight after 3 seconds
      setTimeout(() => {
        setHighlightedId(null);
        // Clean up query param
        router.replace('/arrangements', { scroll: false });
      }, 3000);
    }
  }, [searchParams, arrangements, router]);

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

  const handleRun = async (id: string) => {
    try {
      const response = await fetch(`/api/arrangements/${id}/run`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to start run');
      const data = await response.json();
      addToast('success', 'Run started successfully');
      router.push(`/arrangements/runs/${data.runId}`);
    } catch (error) {
      console.error('Failed to start run:', error);
      addToast('error', 'Failed to start run');
    }
  };

  const handleDeleteClick = (arrangement: Arrangement) => {
    setArrangementToDelete(arrangement);
    setDeleteModalOpen(true);
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
        <div
          style={{
            fontSize: 64,
            marginBottom: 24,
          }}
        >
          🌊
        </div>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: C.text,
            marginBottom: 8,
          }}
        >
          {isViewer ? 'No Arrangements Yet' : 'Your first Arrangement takes 3 minutes to build.'}
        </h2>
        <p
          style={{
            fontSize: 14,
            color: C.text2,
            marginBottom: 4,
            textAlign: 'center',
            maxWidth: 520,
            lineHeight: '1.6',
          }}
        >
          {isViewer
            ? 'Your workspace admin hasn\'t created any arrangements yet.'
            : 'Enrich 10x more records with multi-provider waterfalls.'}
        </p>
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
          {isViewer ? (
            'Arrangements are multi-provider enrichment pipelines that keep your CRM data fresh.'
          ) : (
            <>
              Apollo fills what it can. Clearbit fills the gaps. Serper catches what both miss. Set it
              up once, run it whenever your data needs refreshing.
            </>
          )}
        </p>
        {canCreate && (
          <PrimaryBtn onClick={handleCreateNew}>
            Build your first Arrangement →
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
          marginBottom: 32,
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

      {/* Arrangements list */}
      <div
        style={{
          display: 'grid',
          gap: 16,
        }}
      >
        {arrangements.map((arr) => {
          const steps = arr.enrichment_steps || [];
          const providerNames = steps
            .sort((a, b) => a.order - b.order)
            .map((step) => step.provider.charAt(0).toUpperCase() + step.provider.slice(1))
            .join(' → ');

          const totalFields = new Set(steps.flatMap((step) => step.fields)).size;
          const isHighlighted = highlightedId === arr.id;

          return (
            <div
              key={arr.id}
              ref={(el) => {
                highlightRefs.current[arr.id] = el;
              }}
              style={{
                background: C.surface,
                border: `1px solid ${isHighlighted ? C.green : C.border}`,
                borderRadius: 8,
                padding: 20,
                boxShadow: isHighlighted ? `0 0 0 3px ${C.greenDim}` : undefined,
                transition: 'all 0.3s ease',
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start',
                  marginBottom: 8,
                }}
              >
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: C.text,
                      marginBottom: 4,
                    }}
                  >
                    {arr.name}
                  </h3>
                  <div
                    style={{
                      fontSize: 13,
                      color: C.text3,
                      marginBottom: 12,
                    }}
                  >
                    {providerNames} · {arr.total_runs} runs · {totalFields} fields
                  </div>
                </div>
                {arr.last_run_at && (
                  <div
                    style={{
                      fontSize: 12,
                      color: C.text3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Clock size={12} />
                    Last run: {formatTimeAgo(arr.last_run_at)}
                  </div>
                )}
              </div>

              {/* Last run stats */}
              {arr.last_run_stats && (
                <div
                  style={{
                    fontSize: 13,
                    color: C.text2,
                    marginBottom: 16,
                    paddingBottom: 16,
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  Last run:{' '}
                  <strong style={{ color: C.text }}>
                    {arr.last_run_stats.records_enriched.toLocaleString()} records enriched
                  </strong>{' '}
                  ·{' '}
                  <strong style={{ color: C.green }}>
                    {Math.round(arr.last_run_stats.fill_rate * 100)}% fill rate
                  </strong>{' '}
                  · {formatDuration(arr.last_run_stats.duration_seconds)}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                {canCreate && (
                  <>
                    <button
                      onClick={() => handleRun(arr.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 16px',
                        background: C.indigo,
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.9';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                    >
                      Run again
                    </button>
                    <GhostBtn onClick={() => router.push(`/arrangements/${arr.id}`)}>
                      <Edit size={14} />
                      Edit
                    </GhostBtn>
                  </>
                )}
                <GhostBtn onClick={() => router.push(`/arrangements/${arr.id}`)}>
                  View details
                </GhostBtn>
                {canCreate && (
                  <button
                    onClick={() => handleDeleteClick(arr)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 12px',
                      background: 'transparent',
                      border: `1px solid ${C.border2}`,
                      borderRadius: 6,
                      fontSize: 13,
                      color: C.red,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = C.redDim;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
              width: 480,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 9999,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Trash2 size={24} color={C.red} />
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>
                Delete arrangement?
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: 8 }}>
              Are you sure you want to delete <strong style={{ color: C.text }}>{arrangementToDelete.name}</strong>?
            </div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: 20 }}>
              This will archive the arrangement and preserve its run history. This action cannot be undone.
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                style={{
                  padding: '8px 16px',
                  background: C.surface,
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
                {deleting ? 'Deleting...' : 'Delete arrangement'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
