'use client';

import { useState, useEffect, useCallback } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card, PrimaryBtn, GhostBtn, Toggle } from '@/components/refyne';
import type { DedupConfig, SuppressionRule } from '@/lib/dedup/types';
import { SuppressionRulesSection } from './SuppressionRulesSection';

// ─────────────────────────────────────────────────────────────
// Domain Exclusion Types
// ─────────────────────────────────────────────────────────────

interface DomainExclusion {
  id: string;
  domain: string;
  isPreset: boolean;
  createdAt: string;
}

interface ScanRun {
  id: string;
  scanType: 'full' | 'incremental';
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
  recordsScanned: number;
  newPairsFound: number;
  newClustersFound: number;
  durationMs: number | null;
  errorMessage: string | null;
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface DedupSettingsProps {
  isAdmin?: boolean;
}

type FormValues = Omit<DedupConfig, 'orgId' | 'createdAt' | 'updatedAt'>;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  marginBottom: 32,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: C.text,
  marginBottom: 16,
};

const fieldRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 0',
  borderBottom: `1px solid ${C.border}`,
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: C.text2,
};

const fieldDescStyle: React.CSSProperties = {
  fontSize: 11,
  color: C.text3,
  marginTop: 2,
};

const inputStyle: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 13,
  color: C.text,
  fontFamily: F.mono,
  width: 80,
  textAlign: 'right',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  width: 160,
  textAlign: 'left',
  cursor: 'pointer',
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function DedupSettings({ isAdmin = true }: DedupSettingsProps) {
  const [config, setConfig] = useState<DedupConfig | null>(null);
  const [formValues, setFormValues] = useState<FormValues | null>(null);
  const [rules, setRules] = useState<SuppressionRule[]>([]);
  const [exclusions, setExclusions] = useState<DomainExclusion[]>([]);
  const [scanRuns, setScanRuns] = useState<ScanRun[]>([]);
  const [loadingScans, setLoadingScans] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [removingDomain, setRemovingDomain] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [runningFullScan, setRunningFullScan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch config, rules, and exclusions on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [configRes, rulesRes, exclusionsRes] = await Promise.all([
          fetch('/api/dedup/config'),
          fetch('/api/dedup/suppression-rules'),
          fetch('/api/dedup/domain-exclusions'),
        ]);

        if (!configRes.ok) throw new Error('Failed to load config');
        if (!rulesRes.ok) throw new Error('Failed to load rules');
        if (!exclusionsRes.ok) throw new Error('Failed to load exclusions');

        const configData = await configRes.json();
        const rulesData = await rulesRes.json();
        const exclusionsData = await exclusionsRes.json();

        setConfig(configData.config);
        setFormValues(configToForm(configData.config));
        setRules(rulesData.rules);
        setExclusions(exclusionsData.exclusions);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Fetch scan runs
  const fetchScanRuns = useCallback(async () => {
    setLoadingScans(true);
    try {
      const res = await fetch('/api/dedup/scan-runs?limit=5');
      if (res.ok) {
        const data = await res.json();
        setScanRuns(data.runs);
      }
    } catch (err) {
      console.error('Failed to fetch scan runs:', err);
    } finally {
      setLoadingScans(false);
    }
  }, []);

  useEffect(() => {
    fetchScanRuns();
  }, [fetchScanRuns]);

  // Convert config to form values (strip metadata)
  function configToForm(cfg: DedupConfig): FormValues {
    const { orgId, createdAt, updatedAt, ...rest } = cfg;
    return rest;
  }

  // Check if form has changes
  const isDirty = useCallback(() => {
    if (!config || !formValues) return false;
    const original = configToForm(config);
    return JSON.stringify(original) !== JSON.stringify(formValues);
  }, [config, formValues]);

  // Update a single field
  const updateField = <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
    if (!formValues) return;
    setFormValues({ ...formValues, [field]: value });
  };

  // Save changes
  const handleSave = async () => {
    if (!formValues || !isDirty()) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/dedup/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      const data = await res.json();
      setConfig(data.config);
      setFormValues(configToForm(data.config));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Discard changes
  const handleDiscard = () => {
    if (config) {
      setFormValues(configToForm(config));
    }
  };

  // Handle rules change from SuppressionRulesSection
  const handleRulesChange = (newRules: SuppressionRule[]) => {
    setRules(newRules);
  };

  // Add new domain exclusion
  const handleAddDomain = async () => {
    if (!newDomain.trim()) {
      setDomainError('Domain is required');
      return;
    }

    setAddingDomain(true);
    setDomainError(null);

    try {
      const res = await fetch('/api/dedup/domain-exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add domain');
      }

      const data = await res.json();
      setExclusions([...exclusions, data.exclusion]);
      setNewDomain('');
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : 'Failed to add domain');
    } finally {
      setAddingDomain(false);
    }
  };

  // Remove domain exclusion
  const handleRemoveDomain = async (id: string) => {
    setRemovingDomain(id);
    setDomainError(null);

    try {
      const res = await fetch(`/api/dedup/domain-exclusions?id=${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove domain');
      }

      setExclusions(exclusions.filter(e => e.id !== id));
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : 'Failed to remove domain');
    } finally {
      setRemovingDomain(null);
    }
  };

  // Run full scan
  const handleRunFullScan = async () => {
    setRunningFullScan(true);
    try {
      const res = await fetch('/api/dedup/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceFullScan: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start scan');
      }

      // Refresh scan runs after a delay
      setTimeout(() => {
        fetchScanRuns();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scan');
    } finally {
      setRunningFullScan(false);
    }
  };

  if (!isAdmin) {
    return (
      <Card style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: C.text2 }}>
          Contact your workspace admin to configure dedup settings.
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: C.text2 }}>Loading settings...</div>
      </Card>
    );
  }

  if (!formValues) {
    return (
      <Card style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: C.red }}>{error || 'Failed to load settings'}</div>
      </Card>
    );
  }

  return (
    <div style={{ paddingBottom: isDirty() ? 80 : 0 }}>
      {/* Section 1: Confidence Bands */}
      <Card style={{ padding: 20, ...sectionStyle }}>
        <div style={sectionTitleStyle}>Confidence Bands</div>

        <div style={fieldRowStyle}>
          <div>
            <div style={fieldLabelStyle}>Auto-merge grade threshold</div>
            <div style={fieldDescStyle}>
              Pairs at or above this grade auto-merge without review
            </div>
          </div>
          <select
            style={selectStyle}
            value={formValues.autoMergeGrade}
            onChange={(e) => updateField('autoMergeGrade', e.target.value as FormValues['autoMergeGrade'])}
          >
            <option value="disabled">Disabled</option>
            <option value="A">Grade A only</option>
            <option value="AB">Grade A and B</option>
          </select>
        </div>

        <div style={fieldRowStyle}>
          <div>
            <div style={fieldLabelStyle}>Auto-merge confidence threshold</div>
            <div style={fieldDescStyle}>Minimum confidence % to auto-merge (50-100)</div>
          </div>
          <input
            type="number"
            style={inputStyle}
            value={formValues.autoMergeThreshold}
            min={50}
            max={100}
            onChange={(e) => updateField('autoMergeThreshold', parseInt(e.target.value) || 90)}
          />
        </div>

        <div style={{ ...fieldRowStyle, borderBottom: 'none' }}>
          <div>
            <div style={fieldLabelStyle}>Review floor threshold</div>
            <div style={fieldDescStyle}>Pairs below this confidence are ignored (0-89)</div>
          </div>
          <input
            type="number"
            style={inputStyle}
            value={formValues.reviewFloorThreshold}
            min={0}
            max={89}
            onChange={(e) => updateField('reviewFloorThreshold', parseInt(e.target.value) || 70)}
          />
        </div>
      </Card>

      {/* Section 2: Signal Weights */}
      <Card style={{ padding: 20, ...sectionStyle }}>
        <div style={sectionTitleStyle}>Signal Weights</div>
        <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
          Weights for probabilistic matching signals. Must sum to 1.0.
        </div>

        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>Phone match weight</div>
          <input
            type="number"
            style={inputStyle}
            value={formValues.signalPhoneWeight}
            min={0}
            max={1}
            step={0.05}
            onChange={(e) => updateField('signalPhoneWeight', parseFloat(e.target.value) || 0)}
          />
        </div>

        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>Address match weight</div>
          <input
            type="number"
            style={inputStyle}
            value={formValues.signalAddressWeight}
            min={0}
            max={1}
            step={0.05}
            onChange={(e) => updateField('signalAddressWeight', parseFloat(e.target.value) || 0)}
          />
        </div>

        <div style={{ ...fieldRowStyle, borderBottom: 'none' }}>
          <div style={fieldLabelStyle}>Name match weight</div>
          <input
            type="number"
            style={inputStyle}
            value={formValues.signalNameWeight}
            min={0}
            max={1}
            step={0.05}
            onChange={(e) => updateField('signalNameWeight', parseFloat(e.target.value) || 0)}
          />
        </div>
      </Card>

      {/* Section 3: Name Matching */}
      <Card style={{ padding: 20, ...sectionStyle }}>
        <div style={sectionTitleStyle}>Name Matching</div>

        <div style={fieldRowStyle}>
          <div>
            <div style={fieldLabelStyle}>Name similarity floor</div>
            <div style={fieldDescStyle}>Minimum Levenshtein similarity for name match (0-1)</div>
          </div>
          <input
            type="number"
            style={inputStyle}
            value={formValues.nameLevenshteinFloor}
            min={0}
            max={1}
            step={0.05}
            onChange={(e) => updateField('nameLevenshteinFloor', parseFloat(e.target.value) || 0.85)}
          />
        </div>

        <div style={fieldRowStyle}>
          <div>
            <div style={fieldLabelStyle}>Name divergence guard</div>
            <div style={fieldDescStyle}>
              Require review when names differ significantly despite other matches
            </div>
          </div>
          <Toggle
            on={formValues.nameDivergenceGuard}
            onToggle={() => updateField('nameDivergenceGuard', !formValues.nameDivergenceGuard)}
          />
        </div>

        <div style={{ ...fieldRowStyle, borderBottom: 'none' }}>
          <div>
            <div style={fieldLabelStyle}>Divergence floor</div>
            <div style={fieldDescStyle}>Below this similarity, guard triggers (0-1)</div>
          </div>
          <input
            type="number"
            style={inputStyle}
            value={formValues.nameDivergenceFloor}
            min={0}
            max={1}
            step={0.05}
            onChange={(e) => updateField('nameDivergenceFloor', parseFloat(e.target.value) || 0.40)}
          />
        </div>
      </Card>

      {/* Section 4: Parent-Child Behavior */}
      <Card style={{ padding: 20, ...sectionStyle }}>
        <div style={sectionTitleStyle}>Parent-Child Behavior</div>

        <div style={fieldRowStyle}>
          <div>
            <div style={fieldLabelStyle}>Direct parent-child action</div>
            <div style={fieldDescStyle}>Action when one record is direct parent of the other</div>
          </div>
          <select
            style={selectStyle}
            value={formValues.parentDirectAction}
            onChange={(e) => updateField('parentDirectAction', e.target.value as FormValues['parentDirectAction'])}
          >
            <option value="block">Block merge</option>
            <option value="review">Route to review</option>
          </select>
        </div>

        <div style={fieldRowStyle}>
          <div>
            <div style={fieldLabelStyle}>Same parent action</div>
            <div style={fieldDescStyle}>Action when both records share a parent</div>
          </div>
          <select
            style={selectStyle}
            value={formValues.parentSameAction}
            onChange={(e) => updateField('parentSameAction', e.target.value as FormValues['parentSameAction'])}
          >
            <option value="block">Block merge</option>
            <option value="review">Route to review</option>
            <option value="score">Apply score multiplier</option>
          </select>
        </div>

        <div style={fieldRowStyle}>
          <div>
            <div style={fieldLabelStyle}>One-parent score multiplier</div>
            <div style={fieldDescStyle}>Multiply score when one record has a parent (0-1)</div>
          </div>
          <input
            type="number"
            style={inputStyle}
            value={formValues.parentOneMultiplier}
            min={0}
            max={1}
            step={0.05}
            onChange={(e) => updateField('parentOneMultiplier', parseFloat(e.target.value) || 0.75)}
          />
        </div>

        <div style={{ ...fieldRowStyle, borderBottom: 'none' }}>
          <div>
            <div style={fieldLabelStyle}>Different parent score</div>
            <div style={fieldDescStyle}>Score when records have different parents (0-1)</div>
          </div>
          <input
            type="number"
            style={inputStyle}
            value={formValues.parentDifferentScore}
            min={0}
            max={1}
            step={0.05}
            onChange={(e) => updateField('parentDifferentScore', parseFloat(e.target.value) || 0)}
          />
        </div>
      </Card>

      {/* Section 5: Survivorship Defaults */}
      <Card style={{ padding: 20, ...sectionStyle }}>
        <div style={sectionTitleStyle}>Survivorship Defaults</div>

        <div style={fieldRowStyle}>
          <div>
            <div style={fieldLabelStyle}>Default survivorship</div>
            <div style={fieldDescStyle}>How to pick the surviving record in single merges</div>
          </div>
          <select
            style={selectStyle}
            value={formValues.survivorshipDefault}
            onChange={(e) => updateField('survivorshipDefault', e.target.value as FormValues['survivorshipDefault'])}
          >
            <option value="most_associated">Most associated</option>
            <option value="oldest">Oldest record</option>
            <option value="most_complete">Most complete</option>
            <option value="highest_score">Highest match score</option>
          </select>
        </div>

        <div style={{ ...fieldRowStyle, borderBottom: 'none' }}>
          <div>
            <div style={fieldLabelStyle}>Bulk approve survivorship</div>
            <div style={fieldDescStyle}>How to pick survivors during bulk approve</div>
          </div>
          <select
            style={selectStyle}
            value={formValues.bulkSurvivorship}
            onChange={(e) => updateField('bulkSurvivorship', e.target.value as FormValues['bulkSurvivorship'])}
          >
            <option value="most_associated">Most associated</option>
            <option value="oldest">Oldest record</option>
            <option value="most_complete">Most complete</option>
            <option value="highest_score">Highest match score</option>
          </select>
        </div>
      </Card>

      {/* Section 6: Suppression Rules */}
      <SuppressionRulesSection
        rules={rules}
        onRulesChange={handleRulesChange}
      />

      {/* Section 6.5: Domain Exclusions */}
      <Card style={{ padding: 20, ...sectionStyle }}>
        <div style={sectionTitleStyle}>Domain Exclusions</div>
        <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
          Domains excluded from duplicate matching. These domains appear on many records and
          would create false positive matches if used as a signal.
        </div>

        {/* Exclusion list */}
        <div style={{ marginBottom: 16 }}>
          {exclusions.map((exclusion) => (
            <div
              key={exclusion.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: C.hover,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: exclusion.isPreset ? C.indigo : C.text3,
                  }}
                />
                <span style={{ fontSize: 13, color: C.text, fontFamily: F.mono }}>
                  {exclusion.domain}
                </span>
              </div>
              <div>
                {exclusion.isPreset ? (
                  <span style={{ fontSize: 11, color: C.text3, fontWeight: 500 }}>
                    Preset
                  </span>
                ) : (
                  <button
                    onClick={() => handleRemoveDomain(exclusion.id)}
                    disabled={removingDomain === exclusion.id}
                    style={{
                      fontSize: 11,
                      color: C.red,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: 4,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = C.redDim;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {removingDomain === exclusion.id ? 'Removing...' : 'Remove'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add new domain */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              placeholder="example.com"
              value={newDomain}
              onChange={(e) => {
                setNewDomain(e.target.value);
                setDomainError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddDomain();
                }
              }}
              style={{
                width: '100%',
                background: C.surface,
                border: `1px solid ${domainError ? C.red : C.border}`,
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 13,
                color: C.text,
                fontFamily: F.mono,
              }}
            />
            {domainError && (
              <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>
                {domainError}
              </div>
            )}
          </div>
          <button
            onClick={handleAddDomain}
            disabled={addingDomain || !newDomain.trim()}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: C.text,
              background: C.hover,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              cursor: addingDomain || !newDomain.trim() ? 'not-allowed' : 'pointer',
              opacity: addingDomain || !newDomain.trim() ? 0.5 : 1,
            }}
          >
            {addingDomain ? 'Adding...' : '+ Add domain'}
          </button>
        </div>

        <div style={{ fontSize: 11, color: C.text3, marginTop: 12 }}>
          Preset list maintained by Refyne. Add domains specific to your industry as needed.
        </div>
      </Card>

      {/* Section 6.7: Scan History */}
      <Card style={{ padding: 20, ...sectionStyle }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={sectionTitleStyle}>Scan History</div>
          <button
            onClick={handleRunFullScan}
            disabled={runningFullScan}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              color: runningFullScan ? C.text3 : C.text,
              background: C.hover,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              cursor: runningFullScan ? 'not-allowed' : 'pointer',
              opacity: runningFullScan ? 0.5 : 1,
            }}
          >
            {runningFullScan ? 'Starting...' : 'Run full scan now'}
          </button>
        </div>

        {loadingScans ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: C.text3 }}>
            Loading scan history...
          </div>
        ) : scanRuns.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: C.text3 }}>
            No scans yet. Run your first scan to see history.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3 }}>
                    Type
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3 }}>
                    Date
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: C.text3 }}>
                    Scanned
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: C.text3 }}>
                    New Clusters
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: C.text3 }}>
                    Duration
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: C.text3 }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {scanRuns.map((run) => {
                  const scanDate = new Date(run.startedAt);
                  const isToday = scanDate.toDateString() === new Date().toDateString();
                  const isSunday = scanDate.getUTCDay() === 0;

                  return (
                    <tr key={run.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: C.text }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            fontFamily: F.mono,
                            background: run.scanType === 'full' ? C.indigoDim : C.hover,
                            color: run.scanType === 'full' ? C.indigo : C.text2,
                            border: `1px solid ${run.scanType === 'full' ? C.indigoBrd : C.border}`,
                          }}
                        >
                          {run.scanType === 'full' ? 'Full' : 'Incremental'}
                          {run.scanType === 'full' && isSunday && (
                            <span style={{ fontSize: 10, opacity: 0.7 }}>(Sunday)</span>
                          )}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: C.text2 }}>
                        {isToday
                          ? scanDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                          : scanDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: C.text2, textAlign: 'right', fontFamily: F.mono }}>
                        {run.recordsScanned.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: C.text2, textAlign: 'right', fontFamily: F.mono }}>
                        {run.newClustersFound > 0 ? (
                          <span style={{ color: '#f59e0b', fontWeight: 600 }}>{run.newClustersFound}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: C.text2, textAlign: 'right', fontFamily: F.mono }}>
                        {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'center' }}>
                        {run.status === 'completed' ? (
                          <span style={{ color: C.green }}>✓</span>
                        ) : run.status === 'failed' ? (
                          <span style={{ color: C.red }} title={run.errorMessage || 'Failed'}>✗</span>
                        ) : (
                          <span style={{ color: C.text3 }}>…</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ fontSize: 11, color: C.text3, marginTop: 12 }}>
          Full scans run automatically every Sunday. Incremental scans check only modified records.
        </div>
      </Card>

      {/* Section 7: Post-Merge Behavior */}
      <Card style={{ padding: 20, ...sectionStyle }}>
        <div style={sectionTitleStyle}>Post-Merge Behavior</div>

        <div style={fieldRowStyle}>
          <div>
            <div style={fieldLabelStyle}>Archive losing record</div>
            <div style={fieldDescStyle}>Archive (not delete) the non-surviving record</div>
          </div>
          <Toggle
            on={formValues.archiveLosingRecord}
            onToggle={() => updateField('archiveLosingRecord', !formValues.archiveLosingRecord)}
          />
        </div>

        <div style={fieldRowStyle}>
          <div>
            <div style={fieldLabelStyle}>Transfer associations</div>
            <div style={fieldDescStyle}>Move deals, contacts, etc. to surviving record</div>
          </div>
          <Toggle
            on={formValues.transferAssociations}
            onToggle={() => updateField('transferAssociations', !formValues.transferAssociations)}
          />
        </div>

        <div style={fieldRowStyle}>
          <div>
            <div style={fieldLabelStyle}>Rollback window (hours)</div>
            <div style={fieldDescStyle}>Time window to undo a merge (1-168)</div>
          </div>
          <input
            type="number"
            style={inputStyle}
            value={formValues.rollbackWindowHours}
            min={1}
            max={168}
            onChange={(e) => updateField('rollbackWindowHours', parseInt(e.target.value) || 48)}
          />
        </div>

        <div style={{ ...fieldRowStyle, borderBottom: 'none' }}>
          <div>
            <div style={fieldLabelStyle}>Notify on auto-merge</div>
            <div style={fieldDescStyle}>Send notification when auto-merge executes</div>
          </div>
          <Toggle
            on={formValues.notifyOnAutoMerge}
            onToggle={() => updateField('notifyOnAutoMerge', !formValues.notifyOnAutoMerge)}
          />
        </div>
      </Card>

      {/* Scan Trigger (bonus from config) */}
      <Card style={{ padding: 20, ...sectionStyle }}>
        <div style={sectionTitleStyle}>Scan Trigger</div>

        <div style={{ ...fieldRowStyle, borderBottom: 'none' }}>
          <div>
            <div style={fieldLabelStyle}>When to scan for duplicates</div>
          </div>
          <select
            style={selectStyle}
            value={formValues.scanTrigger}
            onChange={(e) => updateField('scanTrigger', e.target.value as FormValues['scanTrigger'])}
          >
            <option value="on_sync">On HubSpot sync</option>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="manual">Manual only</option>
          </select>
        </div>
      </Card>

      {/* Sticky save bar */}
      {isDirty() && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 200, // sidebar width
            right: 0,
            padding: '12px 24px',
            background: C.surface,
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            zIndex: 100,
          }}
        >
          {error && (
            <span style={{ fontSize: 13, color: C.red, marginRight: 'auto' }}>
              {error}
            </span>
          )}
          <span style={{ fontSize: 13, color: C.text2 }}>
            You have unsaved changes
          </span>
          <GhostBtn onClick={handleDiscard} disabled={saving}>
            Discard
          </GhostBtn>
          <PrimaryBtn onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </PrimaryBtn>
        </div>
      )}
    </div>
  );
}
