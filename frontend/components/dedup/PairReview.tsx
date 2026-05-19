'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, ExternalLink, AlertCircle } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, GhostBtn, PrimaryBtn } from '@/components/refyne';
import type { DedupPair, FiredSignal, FieldSelection } from '@/lib/dedup/types';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface CompanyRecord {
  id: string;
  properties: {
    name?: string;
    domain?: string;
    phone?: string;
    industry?: string;
    city?: string;
    state?: string;
    hubspot_owner_id?: string;
    createdate?: string;
    hs_lastmodifieddate?: string;
    num_associated_contacts?: string;
    num_associated_deals?: string;
  };
}

interface PairReviewData {
  pair: DedupPair;
  recordA: CompanyRecord | null;
  recordB: CompanyRecord | null;
}

type FieldType = 'text' | 'date' | 'count';

interface FieldConfig {
  key: keyof CompanyRecord['properties'];
  label: string;
  type: FieldType;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const HUBSPOT_PORTAL_ID = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID || '49169539';

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: '#10b98115', text: '#10b981', border: '#10b98130' },
  B: { bg: '#3b82f615', text: '#3b82f6', border: '#3b82f630' },
  C: { bg: '#f59e0b15', text: '#f59e0b', border: '#f59e0b30' },
  D: { bg: '#ef444415', text: '#ef4444', border: '#ef444430' },
};

const FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'domain', label: 'Domain', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'industry', label: 'Industry', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'state', label: 'State', type: 'text' },
  { key: 'hubspot_owner_id', label: 'Owner', type: 'text' },
  { key: 'createdate', label: 'Created Date', type: 'date' },
  { key: 'hs_lastmodifieddate', label: 'Last Activity', type: 'date' },
  { key: 'num_associated_contacts', label: '# Contacts', type: 'count' },
  { key: 'num_associated_deals', label: '# Deals', type: 'count' },
];

// ─────────────────────────────────────────────────────────────
// Utility Components
// ─────────────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade: string }) {
  const colors = GRADE_COLORS[grade];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 32,
      height: 32,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 700,
      fontFamily: F.mono,
      background: colors.bg,
      color: colors.text,
      border: `1px solid ${colors.border}`,
    }}>
      {grade}
    </span>
  );
}

function SignalTag({ signal }: { signal: FiredSignal }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 10,
      fontFamily: F.mono,
      color: signal.deterministic ? C.green : C.text3,
      background: signal.deterministic ? `${C.green}15` : C.hover,
      padding: '3px 8px',
      borderRadius: 4,
      border: `1px solid ${signal.deterministic ? `${C.green}30` : C.border}`,
    }}>
      {signal.type}
      {signal.deterministic && <Check size={8} />}
    </span>
  );
}

function RecordLink({ hubspotId }: { hubspotId: string }) {
  const url = `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-2/${hubspotId}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: F.mono,
        fontSize: 11,
        color: C.indigoLt,
        textDecoration: 'none',
        padding: '2px 6px',
        background: C.indigoDim,
        borderRadius: 4,
        border: `1px solid ${C.indigoBrd}`,
      }}
    >
      {hubspotId}
      <ExternalLink size={9} />
    </a>
  );
}

// ─────────────────────────────────────────────────────────────
// Auto-select Logic
// ─────────────────────────────────────────────────────────────

function autoSelectField(
  valueA: string | undefined,
  valueB: string | undefined,
  fieldType: FieldType
): FieldSelection {
  // 1. Prefer non-empty
  if (!valueA && valueB) return 'record_b';
  if (valueA && !valueB) return 'record_a';

  // 2. For dates, prefer more recent
  if (fieldType === 'date' && valueA && valueB) {
    return new Date(valueA) > new Date(valueB) ? 'record_a' : 'record_b';
  }

  // 3. For counts, prefer higher
  if (fieldType === 'count' && valueA && valueB) {
    return Number(valueA) > Number(valueB) ? 'record_a' : 'record_b';
  }

  // 4. Default to record_a
  return 'record_a';
}

function determineRicherRecord(
  recordA: CompanyRecord | null,
  recordB: CompanyRecord | null
): 'record_a' | 'record_b' {
  if (!recordA) return 'record_b';
  if (!recordB) return 'record_a';

  const scoreA =
    (Number(recordA.properties.num_associated_contacts) || 0) +
    (Number(recordA.properties.num_associated_deals) || 0);
  const scoreB =
    (Number(recordB.properties.num_associated_contacts) || 0) +
    (Number(recordB.properties.num_associated_deals) || 0);

  if (scoreA !== scoreB) {
    return scoreA > scoreB ? 'record_a' : 'record_b';
  }

  // Tie-breaker: more recent activity
  const dateA = recordA.properties.hs_lastmodifieddate
    ? new Date(recordA.properties.hs_lastmodifieddate)
    : new Date(0);
  const dateB = recordB.properties.hs_lastmodifieddate
    ? new Date(recordB.properties.hs_lastmodifieddate)
    : new Date(0);

  return dateA >= dateB ? 'record_a' : 'record_b';
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

interface PairReviewProps {
  pairId: string;
  orgId?: string;
}

export function PairReview({ pairId, orgId = 'default' }: PairReviewProps) {
  const router = useRouter();
  const [data, setData] = useState<PairReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Field selections state
  const [fieldSelections, setFieldSelections] = useState<Record<string, FieldSelection>>({});
  const [survivingRecord, setSurvivingRecord] = useState<'record_a' | 'record_b'>('record_a');

  // ─────────────────────────────────────────────────────────────
  // Fetch pair data
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/dedup/pairs/${pairId}`, {
          headers: { 'x-org-id': orgId },
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to fetch pair');
        }

        const result = await res.json();
        setData(result);

        // Auto-select fields
        if (result.recordA && result.recordB) {
          const selections: Record<string, FieldSelection> = {};
          FIELDS.forEach(({ key, type }) => {
            selections[key] = autoSelectField(
              result.recordA.properties[key],
              result.recordB.properties[key],
              type
            );
          });
          setFieldSelections(selections);

          // Determine richer record for survivorship
          const richer = determineRicherRecord(result.recordA, result.recordB);
          setSurvivingRecord(richer);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch pair');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [pairId, orgId]);

  // ─────────────────────────────────────────────────────────────
  // Action handlers
  // ─────────────────────────────────────────────────────────────

  const handleApprove = async () => {
    if (!data) return;
    setActionLoading(true);
    try {
      const survivingRecordId =
        survivingRecord === 'record_a' ? data.pair.recordAId : data.pair.recordBId;

      const res = await fetch(`/api/dedup/pairs/${pairId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': orgId,
        },
        body: JSON.stringify({ fieldSelections, survivingRecordId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to approve pair');
      }

      // Navigate back to queue
      router.push('/dedup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve pair');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/dedup/pairs/${pairId}/reject`, {
        method: 'POST',
        headers: { 'x-org-id': orgId },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reject pair');
      }

      router.push('/dedup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject pair');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSkip = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/dedup/pairs/${pairId}/skip`, {
        method: 'POST',
        headers: { 'x-org-id': orgId },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to skip pair');
      }

      router.push('/dedup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to skip pair');
    } finally {
      setActionLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Format helpers
  // ─────────────────────────────────────────────────────────────

  const formatValue = (value: string | undefined, type: FieldType): string => {
    if (!value) return '—';
    if (type === 'date') {
      return new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    return value;
  };

  const valuesAreDifferent = (valueA: string | undefined, valueB: string | undefined): boolean => {
    if (!valueA && !valueB) return false;
    return valueA !== valueB;
  };

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.text3 }}>
        Loading pair details...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: 16,
        background: `${C.red}15`,
        border: `1px solid ${C.red}30`,
        borderRadius: 8,
        color: C.red,
        fontSize: 13,
      }}>
        <AlertCircle size={14} />
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.text3 }}>
        Pair not found
      </div>
    );
  }

  const { pair, recordA, recordB } = data;

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => router.push('/dedup')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: C.text3,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          marginBottom: 16,
          padding: '4px 0',
        }}
      >
        <ArrowLeft size={14} />
        Back to queue
      </button>

      <Card>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: 16, marginBottom: 16 }}>
            <GradeBadge grade={pair.grade} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: 0 }}>
                  {recordA?.properties.name || `Record ${pair.recordAId}`}
                </h2>
                <span style={{ fontSize: 14, color: C.text3 }}>vs</span>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text2, margin: 0 }}>
                  {recordB?.properties.name || `Record ${pair.recordBId}`}
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  fontFamily: F.mono,
                  fontSize: 13,
                  color: pair.confidence >= 90 ? C.green : pair.confidence >= 75 ? C.amber : C.red,
                  fontWeight: 600,
                }}>
                  {pair.confidence}% confidence
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {pair.signalsFired.map((sig, i) => (
                    <SignalTag key={i} signal={sig} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Field comparison table */}
        <div style={{ padding: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{
                  textAlign: 'left',
                  fontSize: 11,
                  color: C.text3,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  paddingBottom: 12,
                  width: '20%',
                }}>
                  Field
                </th>
                <th style={{
                  textAlign: 'left',
                  fontSize: 11,
                  color: C.text3,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  paddingBottom: 12,
                  width: '40%',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    Record A
                    <RecordLink hubspotId={pair.recordAId} />
                  </div>
                </th>
                <th style={{
                  textAlign: 'left',
                  fontSize: 11,
                  color: C.text3,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  paddingBottom: 12,
                  width: '40%',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    Record B
                    <RecordLink hubspotId={pair.recordBId} />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(({ key, label, type }) => {
                const valueA = recordA?.properties[key];
                const valueB = recordB?.properties[key];
                const isDifferent = valuesAreDifferent(valueA, valueB);

                return (
                  <tr key={key}>
                    <td style={{
                      fontSize: 12,
                      color: C.text2,
                      paddingTop: 12,
                      paddingBottom: 12,
                      borderTop: `1px solid ${C.border}`,
                    }}>
                      {label}
                    </td>
                    <td style={{
                      paddingTop: 12,
                      paddingBottom: 12,
                      borderTop: `1px solid ${C.border}`,
                    }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: fieldSelections[key] === 'record_a' ? C.indigoDim : 'transparent',
                        border: `1px solid ${fieldSelections[key] === 'record_a' ? C.indigoBrd : C.border}`,
                      }}>
                        <input
                          type="radio"
                          name={key}
                          checked={fieldSelections[key] === 'record_a'}
                          onChange={() =>
                            setFieldSelections((prev) => ({ ...prev, [key]: 'record_a' }))
                          }
                          style={{ width: 14, height: 14, cursor: 'pointer' }}
                        />
                        <span style={{
                          fontFamily: F.mono,
                          fontSize: 12,
                          color: isDifferent && fieldSelections[key] === 'record_a' ? C.text : C.text2,
                        }}>
                          {formatValue(valueA, type)}
                        </span>
                      </label>
                    </td>
                    <td style={{
                      paddingTop: 12,
                      paddingBottom: 12,
                      borderTop: `1px solid ${C.border}`,
                    }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: fieldSelections[key] === 'record_b' ? C.indigoDim : 'transparent',
                        border: `1px solid ${fieldSelections[key] === 'record_b' ? C.indigoBrd : C.border}`,
                      }}>
                        <input
                          type="radio"
                          name={key}
                          checked={fieldSelections[key] === 'record_b'}
                          onChange={() =>
                            setFieldSelections((prev) => ({ ...prev, [key]: 'record_b' }))
                          }
                          style={{ width: 14, height: 14, cursor: 'pointer' }}
                        />
                        <span style={{
                          fontFamily: F.mono,
                          fontSize: 12,
                          color: isDifferent && fieldSelections[key] === 'record_b' ? C.text : C.text2,
                        }}>
                          {formatValue(valueB, type)}
                        </span>
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Surviving record indicator */}
          <div style={{
            marginTop: 24,
            padding: 16,
            background: C.surface,
            borderRadius: 8,
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 11, color: C.text3, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>
              Merge strategy
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setSurvivingRecord('record_a')}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  fontSize: 12,
                  fontWeight: 500,
                  color: survivingRecord === 'record_a' ? C.indigo : C.text3,
                  background: survivingRecord === 'record_a' ? C.indigoDim : 'transparent',
                  border: `1px solid ${survivingRecord === 'record_a' ? C.indigoBrd : C.border}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Record A survives · Record B absorbed
              </button>
              <button
                onClick={() => setSurvivingRecord('record_b')}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  fontSize: 12,
                  fontWeight: 500,
                  color: survivingRecord === 'record_b' ? C.indigo : C.text3,
                  background: survivingRecord === 'record_b' ? C.indigoDim : 'transparent',
                  border: `1px solid ${survivingRecord === 'record_b' ? C.indigoBrd : C.border}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Record B survives · Record A absorbed
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: 10,
          padding: '16px 24px',
          borderTop: `1px solid ${C.border}`,
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <GhostBtn onClick={handleReject} disabled={actionLoading}>
              Not a Duplicate
            </GhostBtn>
            <GhostBtn onClick={handleSkip} disabled={actionLoading}>
              Skip
            </GhostBtn>
          </div>
          <PrimaryBtn onClick={handleApprove} disabled={actionLoading}>
            {actionLoading ? 'Processing...' : 'Merge →'}
          </PrimaryBtn>
        </div>
      </Card>
    </div>
  );
}
