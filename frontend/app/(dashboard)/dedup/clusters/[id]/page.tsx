'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2, X } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, GhostBtn, PrimaryBtn } from '@/components/refyne';
import type { ClusterWithRecords } from '@/lib/dedup/cluster-types';
import type { HubSpotCompany } from '@/lib/dedup/select-master';
import { autoSelectFields } from '@/lib/dedup/select-master';

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
  const [merging, setMerging] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [excludingRecordId, setExcludingRecordId] = useState<string | null>(null);
  const [excludedRecords, setExcludedRecords] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  // Handle merge
  const handleMerge = async () => {
    if (!masterId) return;

    setMerging(true);
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

      router.push('/dedup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge cluster');
    } finally {
      setMerging(false);
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
      setExcludedRecords((prev) => new Set([...prev, recordId]));

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

      {/* Error state */}
      {error && (
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
          style={{
            padding: '8px 12px',
            fontSize: 13,
            color: C.text,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            cursor: 'pointer',
            outline: 'none',
            width: '100%',
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
              {visibleRecords.map((record) => (
                <th
                  key={record.id}
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontWeight: 500,
                    color: C.text3,
                    fontSize: 11,
                    background: record.id === masterId ? C.indigoDim : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      {record.properties.name || record.id}
                      {record.id === masterId && (
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
                    {record.id !== masterId && (
                      <button
                        onClick={() => handleExcludeRecord(record.id, record.properties.name || record.id)}
                        disabled={excludingRecordId === record.id}
                        style={{
                          padding: '4px 8px',
                          fontSize: 10,
                          fontWeight: 500,
                          color: excludingRecordId === record.id ? C.text3 : C.red,
                          background: 'transparent',
                          border: `1px solid ${excludingRecordId === record.id ? C.border : C.red}`,
                          borderRadius: 4,
                          cursor: excludingRecordId === record.id ? 'not-allowed' : 'pointer',
                          opacity: excludingRecordId === record.id ? 0.5 : 1,
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => {
                          if (excludingRecordId !== record.id) {
                            e.currentTarget.style.background = C.redDim;
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        {excludingRecordId === record.id ? 'Excluding...' : '× Exclude'}
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FIELDS_TO_DISPLAY.map((field) => (
              <tr key={field} style={{ borderBottom: `1px solid ${C.border}` }}>
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

                  // Get human-readable label for enum values
                  const displayValue = value
                    ? propertyLabels[`${field}:${value}`] || value
                    : '(empty)';

                  return (
                    <td
                      key={record.id}
                      style={{
                        padding: '12px 16px',
                        background: record.id === masterId ? C.indigoDim : 'transparent',
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="radio"
                          name={`field_${field}`}
                          checked={isSelected}
                          onChange={() =>
                            setFieldSelections((prev) => ({
                              ...prev,
                              [field]: record.id,
                            }))
                          }
                          style={{ cursor: 'pointer' }}
                        />
                        <span
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
            ))}
          </tbody>
        </table>
      </Card>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <GhostBtn onClick={handleSkip} disabled={skipping || merging || rejecting}>
          {skipping ? 'Skipping...' : 'Skip'}
        </GhostBtn>
        <GhostBtn onClick={handleReject} disabled={rejecting || merging || skipping}>
          {rejecting ? 'Rejecting...' : 'Not duplicates'}
        </GhostBtn>
        <PrimaryBtn onClick={handleMerge} disabled={!masterId || merging || rejecting || skipping}>
          {merging ? 'Merging...' : 'Merge cluster'}
        </PrimaryBtn>
      </div>

      {/* Toast notification */}
      {toastMessage && (
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
