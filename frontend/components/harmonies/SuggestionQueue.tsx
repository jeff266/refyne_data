'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Check, X, Loader2, Play } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { PrimaryBtn, GhostBtn, Chip } from '@/components/refyne';

interface Suggestion {
  id: string;
  raw_value: string;
  canonical_value: string | null;
  confidence: 'high' | 'medium' | 'low' | 'unsure';
  explanation: string | null;
  created_at: string;
}

interface GroupedSuggestions {
  high: Suggestion[];
  medium: Suggestion[];
  low: Suggestion[];
  unsure: Suggestion[];
}

export function SuggestionQueue({ harmonyId }: { harmonyId: string }) {
  const [suggestions, setSuggestions] = useState<GroupedSuggestions>({
    high: [],
    medium: [],
    low: [],
    unsure: [],
  });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [editingCanonical, setEditingCanonical] = useState<Record<string, string>>({});
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/taxonomy/harmonies/${harmonyId}/suggestions`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
    } finally {
      setLoading(false);
    }
  }, [harmonyId]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Poll for job status while scanning
  useEffect(() => {
    if (!jobId || !scanning) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.state === 'completed') {
            setScanning(false);
            setJobId(null);
            fetchSuggestions();
          } else if (data.state === 'failed') {
            setScanning(false);
            setJobId(null);
            console.error('Scan job failed');
          }
        }
      } catch (err) {
        console.error('Failed to poll job status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, scanning, fetchSuggestions]);

  const handleScanNow = async () => {
    setScanning(true);
    try {
      const res = await fetch(`/api/taxonomy/harmonies/${harmonyId}/suggestions/scan`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setJobId(data.jobId);
      } else {
        setScanning(false);
        console.error('Failed to start scan');
      }
    } catch (err) {
      setScanning(false);
      console.error('Failed to start scan:', err);
    }
  };

  const handleAccept = async (suggestion: Suggestion) => {
    const canonicalValue = editingCanonical[suggestion.id] || suggestion.canonical_value;
    if (!canonicalValue) return;

    setProcessingIds((prev) => new Set(prev).add(suggestion.id));

    try {
      const res = await fetch(`/api/taxonomy/suggestions/${suggestion.id}/accept`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canonicalValue,
          harmonyId,
          rawValue: suggestion.raw_value,
        }),
      });

      if (res.ok) {
        // Remove from suggestions
        setSuggestions((prev) => ({
          high: prev.high.filter((s) => s.id !== suggestion.id),
          medium: prev.medium.filter((s) => s.id !== suggestion.id),
          low: prev.low.filter((s) => s.id !== suggestion.id),
          unsure: prev.unsure.filter((s) => s.id !== suggestion.id),
        }));
        // Clear editing state
        setEditingCanonical((prev) => {
          const next = { ...prev };
          delete next[suggestion.id];
          return next;
        });
      } else {
        console.error('Failed to accept suggestion');
      }
    } catch (err) {
      console.error('Failed to accept suggestion:', err);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(suggestion.id);
        return next;
      });
    }
  };

  const handleReject = async (suggestionId: string) => {
    setProcessingIds((prev) => new Set(prev).add(suggestionId));

    try {
      const res = await fetch(`/api/taxonomy/suggestions/${suggestionId}/reject`, {
        method: 'PATCH',
      });

      if (res.ok) {
        // Remove from suggestions
        setSuggestions((prev) => ({
          high: prev.high.filter((s) => s.id !== suggestionId),
          medium: prev.medium.filter((s) => s.id !== suggestionId),
          low: prev.low.filter((s) => s.id !== suggestionId),
          unsure: prev.unsure.filter((s) => s.id !== suggestionId),
        }));
      } else {
        console.error('Failed to reject suggestion');
      }
    } catch (err) {
      console.error('Failed to reject suggestion:', err);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(suggestionId);
        return next;
      });
    }
  };

  const handleAcceptAllHigh = async () => {
    const highSuggestions = suggestions.high;
    if (highSuggestions.length === 0) return;

    for (const suggestion of highSuggestions) {
      await handleAccept(suggestion);
    }
  };

  const totalCount = suggestions.high.length + suggestions.medium.length + suggestions.low.length + suggestions.unsure.length;

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Loader2 size={16} className="preview-spinner" style={{ color: C.text3 }} />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={14} color={C.indigo} />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>
            AI Suggestions
          </h2>
          {totalCount > 0 && (
            <Chip color="indigo">{totalCount} pending</Chip>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {suggestions.high.length > 0 && (
            <GhostBtn onClick={handleAcceptAllHigh} disabled={scanning}>
              <Check size={12} />
              Accept all high confidence
            </GhostBtn>
          )}
          <PrimaryBtn onClick={handleScanNow} disabled={scanning}>
            {scanning ? (
              <>
                <Loader2 size={12} className="preview-spinner" />
                Scanning...
              </>
            ) : (
              <>
                <Play size={12} />
                Scan now
              </>
            )}
          </PrimaryBtn>
        </div>
      </div>

      {/* No suggestions state */}
      {totalCount === 0 && (
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.text3, marginBottom: 8 }}>
            No pending suggestions
          </div>
          <div style={{ fontSize: 11, color: C.text3 }}>
            Click "Scan now" to find unmapped values that need classification
          </div>
        </div>
      )}

      {/* High Confidence */}
      {suggestions.high.length > 0 && (
        <div>
          <div style={{ padding: '12px 20px', background: C.surface, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.green, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              HIGH CONFIDENCE ({suggestions.high.length})
            </div>
          </div>
          {suggestions.high.map((s) => (
            <SuggestionRow
              key={s.id}
              suggestion={s}
              editedCanonical={editingCanonical[s.id]}
              onEditCanonical={(value) => setEditingCanonical((prev) => ({ ...prev, [s.id]: value }))}
              onAccept={() => handleAccept(s)}
              onReject={() => handleReject(s.id)}
              processing={processingIds.has(s.id)}
            />
          ))}
        </div>
      )}

      {/* Review Suggested (Medium) */}
      {suggestions.medium.length > 0 && (
        <div>
          <div style={{ padding: '12px 20px', background: C.surface, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.amber, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              REVIEW SUGGESTED ({suggestions.medium.length})
            </div>
          </div>
          {suggestions.medium.map((s) => (
            <SuggestionRow
              key={s.id}
              suggestion={s}
              editedCanonical={editingCanonical[s.id]}
              onEditCanonical={(value) => setEditingCanonical((prev) => ({ ...prev, [s.id]: value }))}
              onAccept={() => handleAccept(s)}
              onReject={() => handleReject(s.id)}
              processing={processingIds.has(s.id)}
            />
          ))}
        </div>
      )}

      {/* Unsure (Low + Unsure combined) */}
      {(suggestions.low.length > 0 || suggestions.unsure.length > 0) && (
        <div>
          <div style={{ padding: '12px 20px', background: C.surface, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              UNSURE ({suggestions.low.length + suggestions.unsure.length})
            </div>
          </div>
          {[...suggestions.low, ...suggestions.unsure].map((s) => (
            <SuggestionRow
              key={s.id}
              suggestion={s}
              editedCanonical={editingCanonical[s.id]}
              onEditCanonical={(value) => setEditingCanonical((prev) => ({ ...prev, [s.id]: value }))}
              onAccept={() => handleAccept(s)}
              onReject={() => handleReject(s.id)}
              processing={processingIds.has(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionRow({
  suggestion,
  editedCanonical,
  onEditCanonical,
  onAccept,
  onReject,
  processing,
}: {
  suggestion: Suggestion;
  editedCanonical?: string;
  onEditCanonical: (value: string) => void;
  onAccept: () => void;
  onReject: () => void;
  processing: boolean;
}) {
  const canonicalValue = editedCanonical ?? suggestion.canonical_value ?? '';

  return (
    <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontFamily: F.mono, color: C.text, marginBottom: 4 }}>
          {suggestion.raw_value}
        </div>
        {suggestion.explanation && (
          <div style={{ fontSize: 11, color: C.text3 }}>
            {suggestion.explanation}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: C.text3 }}>→</span>
        <input
          type="text"
          value={canonicalValue}
          onChange={(e) => onEditCanonical(e.target.value)}
          placeholder="Canonical value..."
          disabled={processing}
          style={{
            width: 200,
            padding: '6px 10px',
            fontSize: 13,
            fontFamily: F.mono,
            background: C.surface,
            border: `1px solid ${C.border}`,
            color: C.text,
            opacity: processing ? 0.5 : 1,
          }}
        />

        <button
          onClick={onAccept}
          disabled={processing || !canonicalValue}
          style={{
            padding: '6px 10px',
            fontSize: 12,
            color: C.green,
            background: 'transparent',
            border: `1px solid ${C.border}`,
            cursor: processing || !canonicalValue ? 'not-allowed' : 'pointer',
            opacity: processing || !canonicalValue ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {processing ? <Loader2 size={12} className="preview-spinner" /> : <Check size={12} />}
          Accept
        </button>

        <button
          onClick={onReject}
          disabled={processing}
          style={{
            padding: '6px 10px',
            fontSize: 12,
            color: C.red,
            background: 'transparent',
            border: `1px solid ${C.border}`,
            cursor: processing ? 'not-allowed' : 'pointer',
            opacity: processing ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {processing ? <Loader2 size={12} className="preview-spinner" /> : <X size={12} />}
          Reject
        </button>
      </div>
    </div>
  );
}
