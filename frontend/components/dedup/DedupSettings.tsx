'use client';

import { useState, useEffect, useCallback } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card, PrimaryBtn, GhostBtn, Toggle } from '@/components/refyne';
import type { DedupConfig, SuppressionRule } from '@/lib/dedup/types';
import { SuppressionRulesSection } from './SuppressionRulesSection';

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch config and rules on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [configRes, rulesRes] = await Promise.all([
          fetch('/api/dedup/config'),
          fetch('/api/dedup/suppression-rules'),
        ]);

        if (!configRes.ok) throw new Error('Failed to load config');
        if (!rulesRes.ok) throw new Error('Failed to load rules');

        const configData = await configRes.json();
        const rulesData = await rulesRes.json();

        setConfig(configData.config);
        setFormValues(configToForm(configData.config));
        setRules(rulesData.rules);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

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
