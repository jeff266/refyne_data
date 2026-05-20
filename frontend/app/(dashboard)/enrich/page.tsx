'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';
import { PrimaryBtn } from '@/components/refyne';

interface FieldGap {
  field: string;
  missing: number;
  coverage: number; // 0-100 percentage
}

interface GapAnalysis {
  total_companies: number;
  field_gaps: FieldGap[];
  scanned_at: string;
}

const ENRICHABLE_FIELDS = [
  { key: 'industry', label: 'Industry' },
  { key: 'numberofemployees', label: 'Employee count' },
  { key: 'linkedin_company_page', label: 'LinkedIn URL' },
  { key: 'phone', label: 'Phone' },
  { key: 'domain', label: 'Domain' },
  { key: 'annualrevenue', label: 'Revenue' },
];

const PROVIDER_REGISTRY = [
  { key: 'apollo', label: 'Apollo' },
  { key: 'zoominfo', label: 'ZoomInfo' },
  { key: 'clearbit', label: 'Clearbit' },
  { key: 'hunter', label: 'Hunter' },
  { key: 'people-data-labs', label: 'People Data Labs' },
];

const LIFECYCLE_STAGES = [
  'subscriber',
  'lead',
  'marketingqualifiedlead',
  'salesqualifiedlead',
  'opportunity',
  'customer',
  'evangelist',
  'other',
];

export default function EnrichPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [running, setRunning] = useState(false);

  // Configuration state
  const [companyScope, setCompanyScope] = useState<'all' | 'list' | 'filter'>('all');
  const [selectedList, setSelectedList] = useState<string>('');
  const [lifecycleStage, setLifecycleStage] = useState<string>('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [writePolicy, setWritePolicy] = useState<'fill_empty' | 'overwrite'>('fill_empty');
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);

  // Fetch gap analysis on mount
  useEffect(() => {
    async function fetchGaps() {
      try {
        const res = await fetch('/api/enrich/gaps');
        if (res.ok) {
          const data = await res.json();
          setGapAnalysis(data);

          // Pre-select fields with most missing values
          const topGaps = data.field_gaps
            .sort((a: FieldGap, b: FieldGap) => b.missing - a.missing)
            .slice(0, 3)
            .map((g: FieldGap) => g.field);
          setSelectedFields(topGaps);
        }
      } catch (error) {
        console.error('Failed to fetch gap analysis:', error);
      } finally {
        setLoading(false);
      }
    }

    async function fetchConnections() {
      try {
        const res = await fetch('/api/providers/connections');
        if (res.ok) {
          const data = await res.json();
          const providerKeys = data.connections.map((c: any) => c.provider);
          setConnectedProviders(providerKeys);
          // Pre-select Apollo if connected
          if (providerKeys.includes('apollo')) {
            setSelectedProviders(['apollo']);
          }
        }
      } catch (error) {
        console.error('Failed to fetch provider connections:', error);
      }
    }

    fetchGaps();
    fetchConnections();
  }, []);

  // Run enrichment
  async function handleRunEnrichment() {
    if (selectedFields.length === 0) {
      alert('Please select at least one field to enrich');
      return;
    }
    if (selectedProviders.length === 0) {
      alert('Please select at least one provider');
      return;
    }

    setRunning(true);
    try {
      const response = await fetch('/api/arrangements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Enrich missing fields - ${new Date().toLocaleDateString()}`,
          type: 'enrichment',
          source: {
            type: companyScope === 'all' ? 'hubspot_all' : companyScope === 'list' ? 'hubspot_list' : 'hubspot_filter',
            list_id: companyScope === 'list' ? selectedList : undefined,
            filter: companyScope === 'filter' ? { lifecycle_stage: lifecycleStage } : undefined,
          },
          field_configs: selectedFields.map(field => ({
            field,
            providers: selectedProviders,
            write_policy: writePolicy,
          })),
          auto_activate: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create enrichment arrangement');
      }

      const data = await response.json();
      router.push(`/arrangements/${data.arrangement_id}`);
    } catch (error) {
      console.error('Failed to create enrichment:', error);
      alert('Failed to create enrichment. Please try again.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', fontFamily: F.sans }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4, color: C.text }}>
          Enrich
        </h1>
        <p style={{ color: C.text2, fontSize: 14 }}>
          Fill gaps in your existing HubSpot company records
        </p>
      </div>

      {/* Gap Analysis */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.text3 }}>
          <p>Scanning your HubSpot companies...</p>
        </div>
      ) : !gapAnalysis ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.red }}>
          <p>Failed to load gap analysis. Please refresh the page.</p>
        </div>
      ) : (
        <>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
              Data gaps in your HubSpot
            </div>

            <div style={{ fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 20 }}>
              {gapAnalysis.total_companies.toLocaleString()} companies scanned
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ padding: '8px 0', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Field
                  </th>
                  <th style={{ padding: '8px 0', textAlign: 'right', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Missing
                  </th>
                  <th style={{ padding: '8px 0', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 16 }}>
                    Coverage
                  </th>
                </tr>
              </thead>
              <tbody>
                {gapAnalysis.field_gaps.map((gap) => (
                  <tr key={gap.field} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '12px 0', fontSize: 14, color: C.text }}>
                      {ENRICHABLE_FIELDS.find(f => f.key === gap.field)?.label || gap.field}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right', fontSize: 14, fontFamily: F.mono, color: C.text2 }}>
                      {gap.missing.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 0', paddingLeft: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: C.hover, borderRadius: 3, overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${gap.coverage}%`,
                              background: gap.coverage >= 80 ? C.green : gap.coverage >= 50 ? C.amber : C.red,
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 12, fontFamily: F.mono, color: C.text3, minWidth: 40 }}>
                          {gap.coverage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 20 }}>
              <PrimaryBtn onClick={() => setShowConfig(!showConfig)}>
                {showConfig ? 'Hide configuration' : 'Enrich missing fields →'}
              </PrimaryBtn>
            </div>
          </div>

          {/* Configuration Panel */}
          {showConfig && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 20 }}>
                Configure enrichment
              </div>

              {/* Which companies */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>
                  Which companies?
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={companyScope === 'all'}
                      onChange={() => setCompanyScope('all')}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, color: C.text2 }}>
                      All companies with missing fields ({gapAnalysis.field_gaps.reduce((sum, g) => Math.max(sum, g.missing), 0).toLocaleString()})
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={companyScope === 'list'}
                      onChange={() => setCompanyScope('list')}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, color: C.text2 }}>Specific HubSpot list</span>
                    {companyScope === 'list' && (
                      <input
                        type="text"
                        placeholder="Enter list ID..."
                        value={selectedList}
                        onChange={(e) => setSelectedList(e.target.value)}
                        style={{ marginLeft: 8, padding: '4px 8px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 12 }}
                      />
                    )}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={companyScope === 'filter'}
                      onChange={() => setCompanyScope('filter')}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, color: C.text2 }}>Filter by lifecycle stage</span>
                    {companyScope === 'filter' && (
                      <select
                        value={lifecycleStage}
                        onChange={(e) => setLifecycleStage(e.target.value)}
                        style={{ marginLeft: 8, padding: '4px 8px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 12 }}
                      >
                        <option value="">Select stage...</option>
                        {LIFECYCLE_STAGES.map(stage => (
                          <option key={stage} value={stage}>{stage}</option>
                        ))}
                      </select>
                    )}
                  </label>
                </div>
              </div>

              {/* Which fields */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>
                  Which fields to fill?
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ENRICHABLE_FIELDS.map(field => (
                    <label key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedFields.includes(field.key)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFields(prev => [...prev, field.key]);
                          } else {
                            setSelectedFields(prev => prev.filter(f => f !== field.key));
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 13, color: C.text2 }}>{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Providers */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>
                  Using providers:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {PROVIDER_REGISTRY.filter(p => connectedProviders.includes(p.key)).map(provider => (
                    <label key={provider.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedProviders.includes(provider.key)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProviders(prev => [...prev, provider.key]);
                          } else {
                            setSelectedProviders(prev => prev.filter(p => p !== provider.key));
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 13, color: C.text2 }}>{provider.label}</span>
                    </label>
                  ))}
                  {connectedProviders.length === 0 && (
                    <span style={{ fontSize: 13, color: C.text3 }}>No providers connected. Go to Connections to add providers.</span>
                  )}
                </div>
              </div>

              {/* Write policy */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>
                  Write policy:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={writePolicy === 'fill_empty'}
                      onChange={() => setWritePolicy('fill_empty')}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, color: C.text2 }}>
                      Fill empty only — never overwrite existing values
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={writePolicy === 'overwrite'}
                      onChange={() => setWritePolicy('overwrite')}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, color: C.text2 }}>
                      Overwrite — use provider value even if field has data
                    </span>
                  </label>
                </div>
              </div>

              {/* Run button */}
              <PrimaryBtn onClick={handleRunEnrichment} disabled={running}>
                {running ? 'Creating enrichment...' : 'Run enrichment →'}
              </PrimaryBtn>
            </div>
          )}
        </>
      )}
    </div>
  );
}
