'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2, X } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, GhostBtn, PrimaryBtn } from '@/components/refyne';
import type { ClusterWithRecords } from '@/lib/dedup/cluster-types';
import type { HubSpotCompany } from '@/lib/dedup/select-master';
import { autoSelectFields } from '@/lib/dedup/select-master';
import { MergeHistory } from '@/components/dedup/MergeHistory';

const FIELD_LABELS: Record<string, string> = {
  name: 'Company Name',
  domain: 'Domain',
  phone: 'Phone',
  industry: 'Industry',
  city: 'City',
  state: 'State',
  country: 'Country',
  address: 'Address',
  linkedin_company_page: 'LinkedIn',
  lifecyclestage: 'Lifecycle Stage',
  type: 'Company Type',
};

const FIELDS_TO_DISPLAY = [
  'name',
  'domain',
  'phone',
  'industry',
  'city',
  'state',
  'country',
  'address',
  'linkedin_company_page',
  'lifecyclestage',
  'type',
];

// Animation state machine
type MergeAnimationState =
  | 'idle'          // default, no merge in progress
  | 'merging'       // API call in flight, buttons disabled
  | 'collapsing'    // non-master columns exiting
  | 'absorbing'     // master column pulsing
  | 'highlighting'  // rescued fields glowing
  | 'complete';     // toast visible, about to navigate

// Calculate which fields will be rescued (master empty, non-master has value)
function calculateRescuedFields(
  masterRecord: HubSpotCompany,
  nonMasterRecords: HubSpotCompany[]
): { count: number; fieldKeys: string[] } {
  const rescued: string[] = [];

  const fieldsToCheck = [
    'phone',
    'linkedin_company_page',
    'website',
    'industry',
    'city',
    'state',
    'country',
    'address',
    'type',
  ];

  fieldsToCheck.forEach((field) => {
    const masterVal = masterRecord.properties[field];
    const masterEmpty = masterVal === null || masterVal === '' || masterVal === undefined;

    if (masterEmpty) {
      const anyNonMasterHasValue = nonMasterRecords.some((rec) => {
        const val = rec.properties[field];
        return val !== null && val !== '' && val !== undefined;
      });
      if (anyNonMasterHasValue) rescued.push(field);
    }
  });

  return { count: rescued.length, fieldKeys: rescued };
}

export default function ClusterReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [data, setData] = useState<ClusterWithRecords | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propertyLabels, setPropertyLabels] = useState<Record<string, string>>({});

  // Selection state
  const [masterId, setMasterId] = useState<string | null>(null);
  const [fieldSelections, setFieldSelections] = useState<Record<string, string>>({});

  // Action state
  const [rejecting, setRejecting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [excludingRecordId, setExcludingRecordId] = useState<string | null>(null);
  const [excludedRecords, setExcludedRecords] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Animation state
  const [mergeState, setMergeState] = useState<MergeAnimationState>('idle');
  const [rescuedFieldKeys, setRescuedFieldKeys] = useState<string[]>([]);
  const [mergeToastData, setMergeToastData] = useState<{
    masterName: string;
    recordsConsolidated: number;
    fieldsRescued: number;
  } | null>(null);

  // Fetch cluster data
  useEffect(() => {
    const fetchCluster = async () => {
      try {
        const res = await fetch(`/api/dedup/clusters/${params.id}`, {
          headers: { 'x-org-id': 'default' },
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to fetch cluster');
        }

        const clusterData = await res.json();
        setData(clusterData);

        // Auto-select master and fields
        setMasterId(clusterData.suggestedMasterId);

        const master = clusterData.records.find(
          (r: HubSpotCompany) => r.id === clusterData.suggestedMasterId
        );
        const others = clusterData.records.filter(
          (r: HubSpotCompany) => r.id !== clusterData.suggestedMasterId
        );

        if (master) {
          const autoSelections = autoSelectFields(FIELDS_TO_DISPLAY, master, others);
          setFieldSelections(autoSelections);
        }

        // Fetch HubSpot property definitions for enum field labels
        try {
          const propsRes = await fetch('/api/hubspot/properties/companies');
          if (propsRes.ok) {
            const propsData = await propsRes.json();
            const labelMap: Record<string, string> = {};

            propsData.properties.forEach((prop: any) => {
              if (prop.options && Array.isArray(prop.options)) {
                prop.options.forEach((opt: any) => {
                  labelMap[`${prop.name}:${opt.value}`] = opt.label;
                });
              }
            });

            setPropertyLabels(labelMap);
          }
        } catch (err) {
          console.error('Failed to fetch property definitions:', err);
          // Continue without labels - will show raw values
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch cluster');
      } finally {
        setLoading(false);
      }
    };

    fetchCluster();
  }, [params.id]);

  // Handle merge with animation
  const handleMerge = async () => {
    if (!masterId || !data) return;

    const masterRecord = data.records.find((r) => r.id === masterId);
    const nonMasterRecords = data.records.filter((r) => r.id !== masterId && !excludedRecords.has(r.id));

    if (!masterRecord) return;

    // Calculate rescued fields before merge
    const { count: rescuedCount, fieldKeys } = calculateRescuedFields(masterRecord, nonMasterRecords);
    setRescuedFieldKeys(fieldKeys);

    // Check for reduced motion preference
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setMergeState('merging');

    try {
      const res = await fetch(`/api/dedup/clusters/${params.id}/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': 'default',
        },
        body: JSON.stringify({
          masterId,
          fieldSelections,
          absorb: false,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to merge cluster');
      }

      // Prepare toast data
      const recordsConsolidated = data.cluster.recordIds.length - excludedRecords.size;
      setMergeToastData({
        masterName: masterRecord.properties.name || 'Unknown Company',
        recordsConsolidated,
        fieldsRescued: rescuedCount,
      });

      if (prefersReducedMotion) {
        // Skip animations, go straight to toast
        setMergeState('complete');
        setTimeout(() => {
          router.push(
            `/dedup?merged=true&rescued=${rescuedCount}&name=${encodeURIComponent(
              masterRecord.properties.name || 'Unknown Company'
            )}`
          );
        }, 800);
        return;
      }

      // Start animation sequence
      setMergeState('collapsing');

      setTimeout(() => setMergeState('absorbing'), 300);
      setTimeout(() => setMergeState('highlighting'), 500);
      setTimeout(() => {
        setMergeState('complete');
      }, 600);

      setTimeout(() => {
        router.push(
          `/dedup?merged=true&rescued=${rescuedCount}&name=${encodeURIComponent(
            masterRecord.properties.name || 'Unknown Company'
          )}`
        );
      }, 1400);
    } catch (err) {
      setMergeState('idle');
      setError(err instanceof Error ? err.message : 'Failed to merge cluster');
      setToastMessage('Merge failed. Please try again.');
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Handle reject
  const handleReject = async () => {
    setRejecting(true);
    try {
      const res = await fetch(`/api/dedup/clusters/${params.id}/reject`, {
        method: 'POST',
        headers: { 'x-org-id': 'default' },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reject cluster');
      }

      router.push('/dedup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject cluster');
    } finally {
      setRejecting(false);
    }
  };

  // Handle skip
  const handleSkip = async () => {
    setSkipping(true);
    try {
      const res = await fetch(`/api/dedup/clusters/${params.id}/skip`, {
        method: 'POST',
        headers: { 'x-org-id': 'default' },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to skip cluster');
      }

      router.push('/dedup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to skip cluster');
    } finally {
      setSkipping(false);
    }
  };

  // Handle exclude record
  const handleExcludeRecord = async (recordId: string, recordName: string) => {
    setExcludingRecordId(recordId);
    try {
      const res = await fetch(`/api/dedup/clusters/${params.id}/exclude-record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': 'default',
        },
        body: JSON.stringify({ recordId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to exclude record');
      }

      const result = await res.json();

      // Add to excluded set (for UI filtering)
      setExcludedRecords((prev) => {
        const next = new Set(prev);
        next.add(recordId);
        return next;
      });

      // Show toast
      setToastMessage(`${recordName} excluded from this merge`);
      setTimeout(() => setToastMessage(null), 5000);

      // If cluster was auto-rejected, redirect to queue
      if (result.clusterRejected) {
        setTimeout(() => {
          router.push('/dedup');
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to exclude record');
    } finally {
      setExcludingRecordId(null);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
        }}
      >
        <Loader2 size={32} color={C.indigo} className="animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ fontSize: 14, color: C.red, marginBottom: 16 }}>{error || 'Cluster not found'}</div>
        <GhostBtn onClick={() => router.push('/dedup')}>Back to queue</GhostBtn>
      </div>
    );
  }

  const { cluster, records } = data;

  // Filter out excluded records
  const visibleRecords = records.filter((r) => !excludedRecords.has(r.id));

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
      <style>{`
        @keyframes mergeExit {
          0%   {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
          70%  {
            transform: translateX(32px) scale(0.95);
            opacity: 0.2;
          }
          100% {
            transform: translateX(48px) scale(0.88);
            opacity: 0;
          }
        }

        @keyframes mergeAbsorb {
          0%   {
            box-shadow: 0 0 0 0 rgba(46, 204, 138, 0);
            border-color: rgba(255, 255, 255, 0.08);
          }
          40%  {
            box-shadow: 0 0 0 6px rgba(46, 204, 138, 0.18);
            border-color: rgba(46, 204, 138, 0.6);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(46, 204, 138, 0);
            border-color: rgba(255, 255, 255, 0.08);
          }
        }

        @keyframes fieldRescued {
          0%   { background: transparent; }
          20%  { background: rgba(46, 204, 138, 0.10); }
          60%  { background: rgba(46, 204, 138, 0.08); }
          100% { background: transparent; }
        }

        @keyframes rescuedValue {
          0%   { color: ${C.text}; }
          20%  { color: #2ecc8a; font-weight: 600; }
          100% { color: ${C.text}; }
        }

        @keyframes toastSlideUp {
          from { transform: translateY(48px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .merge-exit {
          animation: mergeExit 400ms ease-in forwards;
        }

        .merge-absorb {
          animation: mergeAbsorb 400ms ease-out forwards;
        }

        .field-rescued {
          animation: fieldRescued 1200ms ease-out forwards;
        }

        .field-rescued .master-value {
          animation: rescuedValue 1200ms ease-out forwards;
        }

        .toast-slide-up {
          animation: toastSlideUp 200ms ease-out forwards;
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <GhostBtn onClick={() => router.push('/dedup')}>
          <ArrowLeft size={14} style={{ marginRight: 4 }} />
          Back to queue
        </GhostBtn>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          Review Cluster
        </h1>
        <p style={{ fontSize: 14, color: C.text3 }}>
          {cluster.recordIds.length} duplicate companies
        </p>
      </div>

      {/* Merge History (for merged clusters) */}
      {cluster.status === 'merged' && (
        <div style={{ marginBottom: 32 }}>
          <MergeHistory clusterId={params.id} />
        </div>
      )}

      {/* Error state */}
      {error && mergeState === 'idle' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            marginBottom: 16,
            background: `${C.red}15`,
            border: `1px solid ${C.red}30`,
            borderRadius: 8,
            color: C.red,
            fontSize: 13,
          }}
        >
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: C.red,
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Master selector */}
      <Card style={{ marginBottom: 16, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 12 }}>
          Master Record
        </div>
        <select
          value={masterId || ''}
          onChange={(e) => setMasterId(e.target.value)}
          disabled={mergeState !== 'idle'}
          style={{
            padding: '8px 12px',
            fontSize: 13,
            color: C.text,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            cursor: mergeState !== 'idle' ? 'not-allowed' : 'pointer',
            outline: 'none',
            width: '100%',
            opacity: mergeState !== 'idle' ? 0.6 : 1,
          }}
        >
          {visibleRecords.map((record) => (
            <option key={record.id} value={record.id}>
              {record.properties.name || record.id} (ID: {record.id})
            </option>
          ))}
        </select>
      </Card>

      {/* Field comparison table */}
      <Card style={{ marginBottom: 16, padding: 0, overflow: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
          }}
        >
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  fontWeight: 500,
                  color: C.text3,
                  fontSize: 11,
                  position: 'sticky',
                  left: 0,
                  background: C.surface,
                  zIndex: 1,
                }}
              >
                Field
              </th>
              {visibleRecords.map((record, idx) => {
                const isMaster = record.id === masterId;
                const isNonMaster = !isMaster;
                const shouldAnimate =
                  mergeState === 'collapsing' ||
                  mergeState === 'absorbing' ||
                  mergeState === 'highlighting' ||
                  mergeState === 'complete';

                return (
                  <th
                    key={record.id}
                    className={
                      isNonMaster && shouldAnimate
                        ? 'merge-exit'
                        : isMaster && mergeState === 'absorbing'
                        ? 'merge-absorb'
                        : ''
                    }
                    style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      fontWeight: 500,
                      color: C.text3,
                      fontSize: 11,
                      background: isMaster ? C.indigoDim : 'transparent',
                      border: isMaster ? `1px solid ${C.border}` : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        {record.properties.name || record.id}
                        {isMaster && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 10,
                              fontWeight: 600,
                              color: C.indigo,
                              textTransform: 'uppercase',
                            }}
                          >
                            Master
                          </span>
                        )}
                      </div>
                      {!isMaster && (
                        <button
                          onClick={() => handleExcludeRecord(record.id, record.properties.name || record.id)}
                          disabled={excludingRecordId === record.id || mergeState !== 'idle'}
                          title="Mark this record as not a duplicate. It will remain in HubSpot as a separate company."
                          style={{
                            padding: '4px 8px',
                            fontSize: 10,
                            fontWeight: 500,
                            color: excludingRecordId === record.id || mergeState !== 'idle' ? C.text3 : C.red,
                            background: 'transparent',
                            border: `1px solid ${excludingRecordId === record.id || mergeState !== 'idle' ? C.border : C.red}`,
                            borderRadius: 4,
                            cursor: excludingRecordId === record.id || mergeState !== 'idle' ? 'not-allowed' : 'pointer',
                            opacity: excludingRecordId === record.id || mergeState !== 'idle' ? 0.5 : 1,
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={(e) => {
                            if (excludingRecordId !== record.id && mergeState === 'idle') {
                              e.currentTarget.style.background = C.redDim;
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          {excludingRecordId === record.id ? 'Excluding...' : 'Not a duplicate'}
                        </button>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {FIELDS_TO_DISPLAY.map((field) => {
              const isRescuedField =
                (mergeState === 'highlighting' || mergeState === 'complete') &&
                rescuedFieldKeys.includes(field);

              return (
                <tr
                  key={field}
                  className={isRescuedField ? 'field-rescued' : ''}
                  style={{ borderBottom: `1px solid ${C.border}` }}
                >
                  <td
                    style={{
                      padding: '12px 16px',
                      fontWeight: 500,
                      color: C.text2,
                      position: 'sticky',
                      left: 0,
                      background: C.surface,
                      zIndex: 1,
                    }}
                  >
                    {FIELD_LABELS[field] || field}
                  </td>
                  {visibleRecords.map((record) => {
                    const value = record.properties[field];
                    const isSelected = fieldSelections[field] === record.id;
                    const isMaster = record.id === masterId;
                    const isNonMaster = !isMaster;
                    const shouldAnimateExit =
                      mergeState === 'collapsing' ||
                      mergeState === 'absorbing' ||
                      mergeState === 'highlighting' ||
                      mergeState === 'complete';

                    // Get human-readable label for enum values
                    const displayValue = value
                      ? propertyLabels[`${field}:${value}`] || value
                      : '(empty)';

                    return (
                      <td
                        key={record.id}
                        className={isNonMaster && shouldAnimateExit ? 'merge-exit' : ''}
                        style={{
                          padding: '12px 16px',
                          background: isMaster ? C.indigoDim : 'transparent',
                        }}
                      >
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            cursor: mergeState === 'idle' ? 'pointer' : 'not-allowed',
                          }}
                        >
                          <input
                            type="radio"
                            name={`field_${field}`}
                            checked={isSelected}
                            disabled={mergeState !== 'idle'}
                            onChange={() =>
                              setFieldSelections((prev) => ({
                                ...prev,
                                [field]: record.id,
                              }))
                            }
                            style={{ cursor: mergeState === 'idle' ? 'pointer' : 'not-allowed' }}
                          />
                          <span
                            className={isMaster && isRescuedField ? 'master-value' : ''}
                            style={{
                              color: value ? C.text : C.text3,
                              fontStyle: value ? 'normal' : 'italic',
                            }}
                          >
                            {displayValue}
                          </span>
                        </label>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <GhostBtn onClick={handleSkip} disabled={skipping || mergeState !== 'idle' || rejecting}>
          {skipping ? 'Skipping...' : 'Skip'}
        </GhostBtn>
        <GhostBtn onClick={handleReject} disabled={rejecting || mergeState !== 'idle' || skipping}>
          {rejecting ? 'Rejecting...' : 'Not duplicates'}
        </GhostBtn>
        <PrimaryBtn onClick={handleMerge} disabled={!masterId || mergeState !== 'idle' || rejecting || skipping}>
          {mergeState === 'merging' ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={12} className="animate-spin" />
              Merging...
            </span>
          ) : (
            'Merge cluster'
          )}
        </PrimaryBtn>
      </div>

      {/* Merge success toast */}
      {mergeState === 'complete' && mergeToastData && (
        <div
          className="toast-slide-up"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            padding: '12px 16px',
            background: '#162944',
            border: '0.5px solid rgba(46, 204, 138, 0.5)',
            borderRadius: 0,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 1000,
            minWidth: 380,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Check size={16} color="#2ecc8a" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: '#2ecc8a', fontWeight: 500, marginBottom: 4 }}>
                Merged into {mergeToastData.masterName}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(249, 248, 245, 0.65)' }}>
                {mergeToastData.recordsConsolidated} records consolidated
              </div>
              {mergeToastData.fieldsRescued > 0 && (
                <div style={{ fontSize: 12, color: 'rgba(249, 248, 245, 0.65)' }}>
                  {mergeToastData.fieldsRescued} fields rescued from duplicates
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error toast */}
      {toastMessage && mergeState === 'idle' && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            padding: '12px 16px',
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            zIndex: 1000,
            minWidth: 300,
          }}
        >
          <Check size={16} color={C.green} />
          <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: C.text3,
              padding: 4,
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
