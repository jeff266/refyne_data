'use client';

import { useState, useEffect } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card, PrimaryBtn, GhostBtn } from '@/components/refyne';
import * as Sentry from '@sentry/nextjs';

interface QuarantineRecord {
  id: string;
  record_data: any;
  duplicate_of: string | null;
  confidence: number | null;
  portalId?: string;
}

interface ExistingRecord {
  name?: string;
  domain?: string;
  industry?: string;
  employeeCount?: number;
  linkedinUrl?: string;
  createdDaysAgo?: number;
}

interface AIAnalysis {
  explanation: string;
  recommendation: 'approve' | 'reject' | 'needs_review';
  keySignal: string;
  confidence_plain: string;
}

interface QuarantineDetailSlideOverProps {
  record: QuarantineRecord;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function QuarantineDetailSlideOver({
  record,
  isOpen,
  onClose,
  onApprove,
  onReject,
}: QuarantineDetailSlideOverProps) {
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState(false);
  const [existingRecord, setExistingRecord] = useState<ExistingRecord | null>(null);

  useEffect(() => {
    if (isOpen && record.id) {
      loadAIAnalysis();
    }
  }, [isOpen, record.id]);

  async function loadAIAnalysis() {
    try {
      const res = await fetch(`/api/ai/quarantine-triage/${record.id}`);
      if (!res.ok) throw new Error('Failed to fetch AI analysis');
      const data = await res.json();
      setAiAnalysis(data.analysis);
      setExistingRecord(data.existingRecord || null);
      setAiLoading(false);
    } catch (err) {
      console.error('AI analysis error:', err);
      Sentry.captureException(err, { level: 'warning' });
      setAiError(true);
      setAiLoading(false);
    }
  }

  if (!isOpen) return null;

  const recommendationColors = {
    approve: { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)', text: C.green },
    reject: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: C.red },
    needs_review: { bg: C.amberDim, border: C.amberBrd, text: C.amber },
  };

  const rec = aiAnalysis?.recommendation || 'needs_review';
  const recColors = recommendationColors[rec];

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 998,
        }}
        onClick={onClose}
      />

      {/* Slide-over */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '600px',
          maxWidth: '90vw',
          background: C.bg,
          borderLeft: `1px solid ${C.border}`,
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 12px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              Quarantine Review
            </div>
            <div style={{ fontSize: 12, color: C.text3 }}>
              {record.record_data?.name || record.record_data?.domain || 'Unknown company'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: 6,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: C.text3,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* AI Analysis Section */}
          {!aiError && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>
                AI Analysis
              </div>

              {aiLoading ? (
                <div
                  style={{
                    padding: '16px',
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ height: 12, background: C.border, borderRadius: 4, width: '100%' }} />
                    <div style={{ height: 12, background: C.border, borderRadius: 4, width: '85%' }} />
                    <div style={{ height: 12, background: C.border, borderRadius: 4, width: '60%' }} />
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '16px',
                    background: recColors.bg,
                    border: `1px solid ${recColors.border}`,
                    borderRadius: 8,
                  }}
                >
                  {/* Recommendation Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: recColors.text,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        padding: '4px 8px',
                        background: recColors.bg,
                        border: `1.5px solid ${recColors.border}`,
                        borderRadius: 4,
                      }}
                    >
                      {rec === 'needs_review' ? 'Needs Review' : rec}
                    </div>
                    <div style={{ fontSize: 11, color: C.text3 }}>
                      {aiAnalysis?.confidence_plain}
                    </div>
                  </div>

                  {/* Explanation */}
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 12 }}>
                    {aiAnalysis?.explanation}
                  </div>

                  {/* Key Signal */}
                  {aiAnalysis?.keySignal && (
                    <div
                      style={{
                        fontSize: 12,
                        color: C.text3,
                        fontStyle: 'italic',
                        paddingTop: 12,
                        borderTop: `1px solid ${recColors.border}`,
                      }}
                    >
                      Key signal: {aiAnalysis.keySignal}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Field Comparison Table */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>
              Field Comparison
            </div>

            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th
                      style={{
                        padding: '10px 12px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.text3,
                        textTransform: 'uppercase',
                      }}
                    >
                      Field
                    </th>
                    <th
                      style={{
                        padding: '10px 12px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.text3,
                        textTransform: 'uppercase',
                      }}
                    >
                      New Record
                    </th>
                    <th
                      style={{
                        padding: '10px 12px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.text3,
                        textTransform: 'uppercase',
                      }}
                    >
                      Existing
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <ComparisonRow
                    field="Company Name"
                    newValue={record.record_data?.name}
                    existingValue={existingRecord?.name}
                  />
                  <ComparisonRow
                    field="Domain"
                    newValue={record.record_data?.domain}
                    existingValue={existingRecord?.domain}
                  />
                  <ComparisonRow
                    field="Industry"
                    newValue={record.record_data?.industry}
                    existingValue={existingRecord?.industry}
                  />
                  <ComparisonRow
                    field="Employee Count"
                    newValue={record.record_data?.employeeCount}
                    existingValue={existingRecord?.employeeCount}
                  />
                  <ComparisonRow
                    field="LinkedIn URL"
                    newValue={record.record_data?.linkedinUrl}
                    existingValue={existingRecord?.linkedinUrl}
                  />
                </tbody>
              </table>
            </div>

            {existingRecord?.createdDaysAgo !== undefined && (
              <div style={{ fontSize: 11, color: C.text3, marginTop: 8 }}>
                Existing record created {existingRecord.createdDaysAgo} days ago
              </div>
            )}
          </div>

          {/* Duplicate Info */}
          {record.duplicate_of && (
            <div
              style={{
                padding: '12px 16px',
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                marginBottom: 24,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 4 }}>
                Potential Duplicate
              </div>
              <div style={{ fontSize: 11, fontFamily: F.mono, color: C.text3 }}>
                {record.duplicate_of}
              </div>
              {record.confidence && (
                <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>
                  Confidence: {Math.round(record.confidence)}%
                </div>
              )}
              {record.portalId && record.record_data?.hubspot_id && (
                <a
                  href={`https://app.hubspot.com/contacts/${record.portalId}/company/${record.record_data.hubspot_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 12,
                    color: C.indigo,
                    textDecoration: 'none',
                    marginTop: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  View in HubSpot
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M10 6.5V10C10 10.2652 9.89464 10.5196 9.70711 10.7071C9.51957 10.8946 9.26522 11 9 11H2C1.73478 11 1.48043 10.8946 1.29289 10.7071C1.10536 10.5196 1 10.2652 1 10V3C1 2.73478 1.10536 2.48043 1.29289 2.29289C1.48043 2.10536 1.73478 2 2 2H5.5M8 1H11M11 1V4M11 1L5.5 6.5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            gap: 12,
            justifyContent: 'flex-end',
          }}
        >
          <GhostBtn onClick={() => onReject(record.id)}>Reject</GhostBtn>
          <div style={{ position: 'relative' }}>
            <PrimaryBtn
              onClick={() => onApprove(record.id)}
              style={{
                background:
                  aiAnalysis?.recommendation === 'approve'
                    ? C.green
                    : aiAnalysis?.recommendation === 'reject'
                    ? C.surface
                    : C.indigo,
                color:
                  aiAnalysis?.recommendation === 'approve'
                    ? '#000'
                    : aiAnalysis?.recommendation === 'reject'
                    ? C.text3
                    : '#fff',
              }}
            >
              Approve & Push
            </PrimaryBtn>
            {aiAnalysis?.recommendation === 'approve' && (
              <div
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: C.green,
                  border: `2px solid ${C.bg}`,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ComparisonRow({
  field,
  newValue,
  existingValue,
}: {
  field: string;
  newValue: any;
  existingValue: any;
}) {
  const newVal = newValue?.toString() || '—';
  const existingVal = existingValue?.toString() || '—';
  const isDifferent = newVal !== existingVal && newVal !== '—' && existingVal !== '—';

  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      <td style={{ padding: '10px 12px', fontSize: 12, color: C.text3 }}>{field}</td>
      <td
        style={{
          padding: '10px 12px',
          fontSize: 12,
          fontFamily: F.mono,
          color: isDifferent ? C.indigo : C.text,
          fontWeight: isDifferent ? 500 : 400,
        }}
      >
        {newVal}
      </td>
      <td
        style={{
          padding: '10px 12px',
          fontSize: 12,
          fontFamily: F.mono,
          color: C.text3,
        }}
      >
        {existingVal}
      </td>
    </tr>
  );
}
