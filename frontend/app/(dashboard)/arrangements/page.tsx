'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Workflow, Plus, Play, Copy, Archive, MoreVertical } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { PrimaryBtn, Chip } from '@/components/refyne';
import { addToast } from '@/components/ui/toast';

interface Arrangement {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  enrichment_steps: any[];
  last_run_at: string | null;
  total_runs: number;
  total_records_processed: number;
  total_credits_used: number;
  created_at: string;
}

export default function ArrangementsPage() {
  const router = useRouter();
  const [arrangements, setArrangements] = useState<Arrangement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArrangements();
  }, []);

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

  const handleCreateNew = () => {
    router.push('/arrangements/new');
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
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: 32,
      }}>
        <Workflow size={64} color={C.text3} style={{ marginBottom: 24 }} />
        <h2 style={{
          fontSize: 24,
          fontWeight: 600,
          color: C.text,
          marginBottom: 8,
        }}>
          No arrangements yet
        </h2>
        <p style={{
          fontSize: 14,
          color: C.text2,
          marginBottom: 24,
          textAlign: 'center',
          maxWidth: 400,
        }}>
          Arrangements are saved enrichment pipelines that you can run on demand.
          Create your first arrangement to get started.
        </p>
        <PrimaryBtn onClick={handleCreateNew}>
          <Plus size={16} />
          New arrangement
        </PrimaryBtn>
      </div>
    );
  }

  return (
    <div style={{ padding: 32 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text }}>
          Arrangements
        </h1>
        <PrimaryBtn onClick={handleCreateNew}>
          <Plus size={16} />
          New arrangement
        </PrimaryBtn>
      </div>

      <div style={{
        display: 'grid',
        gap: 16,
      }}>
        {arrangements.map((arr) => (
          <div
            key={arr.id}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: C.text,
                  marginBottom: 4,
                }}>
                  {arr.name}
                </h3>
                {arr.description && (
                  <p style={{
                    fontSize: 14,
                    color: C.text2,
                    marginBottom: 12,
                  }}>
                    {arr.description}
                  </p>
                )}
                <div style={{
                  display: 'flex',
                  gap: 16,
                  fontSize: 13,
                  color: C.text2,
                }}>
                  <span>
                    <strong>{arr.enrichment_steps.length}</strong> steps
                  </span>
                  <span>
                    <strong>{arr.total_runs}</strong> runs
                  </span>
                  <span>
                    <strong>{arr.total_records_processed.toLocaleString()}</strong> records processed
                  </span>
                  <span>
                    <strong>{arr.total_credits_used.toLocaleString()}</strong> credits used
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleRun(arr.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    background: C.indigo,
                    color: C.text,
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <Play size={14} />
                  Run
                </button>
                <button
                  onClick={() => router.push(`/arrangements/${arr.id}`)}
                  style={{
                    padding: '8px 16px',
                    background: C.hover,
                    color: C.text2,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
