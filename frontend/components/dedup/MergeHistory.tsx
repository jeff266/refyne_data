'use client';

import { useState, useEffect } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card } from '@/components/refyne';
import { Clock, ChevronDown, ChevronRight } from 'lucide-react';

interface MergeHistoryEntry {
  id: string;
  merged_by_name: string | null;
  merged_at: string;
  humanReadableTime: string;
  survivor_record_id: string;
  merged_record_id: string;
  merge_method: string;
  confidence_score: number;
  fieldDiff: Record<string, {
    survivorValue: any;
    mergedValue: any;
    resultValue: any;
    source: string;
    changed: boolean;
  }>;
}

interface MergeHistoryProps {
  clusterId: string;
}

export function MergeHistory({ clusterId }: MergeHistoryProps) {
  const [history, setHistory] = useState<MergeHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, [clusterId]);

  async function fetchHistory() {
    try {
      const res = await fetch(`/api/dedup/clusters/${clusterId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Failed to fetch merge history:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 20, color: C.text3, fontSize: 13 }}>
        Loading merge history...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
        }}
      >
        <Clock size={32} color={C.text3} style={{ margin: '0 auto 12px' }} />
        <div style={{ fontSize: 14, color: C.text2, marginBottom: 4 }}>
          No merge history
        </div>
        <div style={{ fontSize: 13, color: C.text3 }}>
          This cluster hasn't been merged yet
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>
          Merge History
        </h3>
        <p style={{ fontSize: 13, color: C.text3 }}>
          {history.length} merge{history.length !== 1 ? 's' : ''} performed
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {history.map((entry) => {
          const isExpanded = expandedEntry === entry.id;
          const changedFields = Object.entries(entry.fieldDiff).filter(
            ([_, diff]) => diff.changed
          );

          return (
            <Card key={entry.id} style={{ overflow: 'hidden' }}>
              {/* Header */}
              <div
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  background: isExpanded ? C.hover : 'transparent',
                }}
                onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Clock size={14} color={C.text3} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                      {entry.humanReadableTime}
                    </span>
                    <span
                      style={{
                        padding: '2px 6px',
                        background: C.indigoDim,
                        border: `1px solid ${C.indigoBrd}`,
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        color: C.indigo,
                        textTransform: 'uppercase',
                      }}
                    >
                      {entry.merge_method}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: C.text3 }}>
                    Merged {entry.merged_record_id.slice(0, 8)}... into{' '}
                    {entry.survivor_record_id.slice(0, 8)}...
                    {entry.merged_by_name && ` by ${entry.merged_by_name}`}
                  </div>
                  <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>
                    {changedFields.length} field{changedFields.length !== 1 ? 's' : ''} changed
                  </div>
                </div>
                <div style={{ color: C.text3 }}>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div
                  style={{
                    borderTop: `1px solid ${C.border}`,
                    background: C.bg,
                  }}
                >
                  {/* Field Comparison Table */}
                  <div style={{ padding: 20 }}>
                    <h4
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.text2,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: 12,
                      }}
                    >
                      Field Changes
                    </h4>

                    <div
                      style={{
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Table Header */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '200px 1fr 1fr 1fr 80px',
                          gap: 12,
                          padding: '10px 16px',
                          background: C.hover,
                          borderBottom: `1px solid ${C.border}`,
                          fontSize: 11,
                          fontWeight: 600,
                          color: C.text3,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        <div>Field</div>
                        <div>Before (Survivor)</div>
                        <div>Before (Merged)</div>
                        <div>After (Result)</div>
                        <div>Source</div>
                      </div>

                      {/* Table Rows */}
                      {changedFields.length === 0 ? (
                        <div
                          style={{
                            padding: 20,
                            textAlign: 'center',
                            color: C.text3,
                            fontSize: 12,
                          }}
                        >
                          No fields changed during merge
                        </div>
                      ) : (
                        changedFields.map(([field, diff]) => (
                          <div
                            key={field}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '200px 1fr 1fr 1fr 80px',
                              gap: 12,
                              padding: '12px 16px',
                              borderBottom: `1px solid ${C.border}`,
                              fontSize: 12,
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 500,
                                color: C.text,
                                fontFamily: F.mono,
                                fontSize: 11,
                              }}
                            >
                              {field}
                            </div>
                            <FieldValue value={diff.survivorValue} />
                            <FieldValue value={diff.mergedValue} />
                            <FieldValue
                              value={diff.resultValue}
                              highlight={diff.resultValue !== diff.survivorValue}
                            />
                            <SourceBadge source={diff.source} />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function FieldValue({ value, highlight }: { value: any; highlight?: boolean }) {
  const displayValue =
    value === null || value === undefined || value === ''
      ? '(empty)'
      : String(value);

  const isEmpty = value === null || value === undefined || value === '';

  return (
    <div
      style={{
        color: isEmpty ? C.text3 : C.text,
        fontStyle: isEmpty ? 'italic' : 'normal',
        fontFamily: isEmpty ? F.sans : F.mono,
        fontSize: 11,
        background: highlight ? C.amberDim : 'transparent',
        padding: highlight ? '4px 6px' : 0,
        borderRadius: highlight ? 4 : 0,
        wordBreak: 'break-word',
      }}
    >
      {displayValue}
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    survivor: { bg: C.indigoDim, border: C.indigoBrd, text: C.indigo },
    merged: { bg: C.greenDim, border: C.greenBrd, text: C.green },
    same: { bg: C.border, border: C.border, text: C.text3 },
    custom: { bg: C.amberDim, border: C.amberBrd, text: C.amber },
  };

  const color = colors[source] || colors.custom;

  return (
    <div
      style={{
        padding: '2px 6px',
        background: color.bg,
        border: `1px solid ${color.border}`,
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        color: color.text,
        textAlign: 'center',
        textTransform: 'capitalize',
      }}
    >
      {source}
    </div>
  );
}
