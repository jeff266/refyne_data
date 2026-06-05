'use client';

import { useState, useEffect } from 'react';
import { addToast } from '@/components/ui/toast';
import { C } from '@/lib/design-tokens';

interface FieldRule {
  field: string;
  rule: string;
  config: Record<string, any>;
}

interface DedupPolicy {
  id: string;
  org_id: string;
  name: string;
  block_if_different_parent: boolean;
  block_if_closed_won_deals: boolean;
  compliance_fields: string[];
  field_rules: FieldRule[];
}

const RULE_TYPES = [
  { value: 'fill_empty', label: 'Fill empty', description: 'Use duplicate value if master is blank' },
  { value: 'keep_master', label: 'Keep master', description: 'Always use master value' },
  { value: 'append_both', label: 'Append both', description: 'Concatenate both values with separator' },
  { value: 'keep_highest', label: 'Keep highest', description: 'Use highest numeric value' },
  { value: 'keep_lowest', label: 'Keep lowest', description: 'Use lowest numeric value' },
  { value: 'keep_newest', label: 'Keep newest', description: 'Use most recently modified value' },
  { value: 'keep_oldest', label: 'Keep oldest', description: 'Use oldest record\'s value' },
  { value: 'keep_most_advanced', label: 'Keep most advanced', description: 'Use value furthest in funnel order' },
];

const DEFAULT_COMPLIANCE_FIELDS = [
  'hs_email_optout',
  'hs_email_bounce',
  'hs_email_hardbounce_reason',
  'hs_legal_basis',
];

// Map HubSpot field names to human-readable labels
const COMPLIANCE_FIELD_LABELS: Record<string, string> = {
  'hs_email_optout': 'Email Opt-out',
  'hs_email_bounce': 'Email Bounce',
  'hs_email_hardbounce_reason': 'Email Hard Bounce Reason',
  'hs_legal_basis': 'Legal Basis',
};

function getComplianceFieldLabel(field: string): string {
  return COMPLIANCE_FIELD_LABELS[field] || field;
}

export default function DedupPoliciesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState<DedupPolicy | null>(null);
  const [isDefault, setIsDefault] = useState(false);

  // Form state
  const [policyName, setPolicyName] = useState('Default Policy');
  const [blockDifferentParent, setBlockDifferentParent] = useState(false);
  const [blockClosedWonDeals, setBlockClosedWonDeals] = useState(false);
  const [complianceFields, setComplianceFields] = useState<string[]>(DEFAULT_COMPLIANCE_FIELDS);
  const [fieldRules, setFieldRules] = useState<FieldRule[]>([]);
  const [newComplianceField, setNewComplianceField] = useState('');

  // Load policy on mount
  useEffect(() => {
    loadPolicy();
  }, []);

  async function loadPolicy() {
    try {
      const res = await fetch('/api/settings/dedup-policies');
      if (!res.ok) throw new Error('Failed to load policy');

      const data = await res.json();
      setPolicy(data.policy);
      setIsDefault(data.isDefault);

      if (data.policy) {
        setPolicyName(data.policy.name);
        setBlockDifferentParent(data.policy.block_if_different_parent);
        setBlockClosedWonDeals(data.policy.block_if_closed_won_deals);
        setComplianceFields(data.policy.compliance_fields || DEFAULT_COMPLIANCE_FIELDS);
        setFieldRules(data.policy.field_rules || []);
      }
    } catch (error) {
      console.error('Failed to load policy:', error);
      addToast('error', 'Failed to load dedup policy');
    } finally {
      setLoading(false);
    }
  }

  async function savePolicy() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/dedup-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: policyName,
          block_if_different_parent: blockDifferentParent,
          block_if_closed_won_deals: blockClosedWonDeals,
          compliance_fields: complianceFields,
          field_rules: fieldRules,
        }),
      });

      if (!res.ok) throw new Error('Failed to save policy');

      const data = await res.json();
      setPolicy(data.policy);
      setIsDefault(false);

      addToast('success', data.created ? 'Policy created' : 'Policy updated');
    } catch (error) {
      console.error('Failed to save policy:', error);
      addToast('error', 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  }

  function addFieldRule() {
    setFieldRules([
      ...fieldRules,
      { field: '', rule: 'fill_empty', config: {} },
    ]);
  }

  function updateFieldRule(index: number, updates: Partial<FieldRule>) {
    const updated = [...fieldRules];
    updated[index] = { ...updated[index], ...updates };
    setFieldRules(updated);
  }

  function removeFieldRule(index: number) {
    setFieldRules(fieldRules.filter((_, i) => i !== index));
  }

  function moveFieldRule(index: number, direction: 'up' | 'down') {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === fieldRules.length - 1)
    ) {
      return;
    }

    const updated = [...fieldRules];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
    setFieldRules(updated);
  }

  function addComplianceField() {
    if (newComplianceField && !complianceFields.includes(newComplianceField)) {
      setComplianceFields([...complianceFields, newComplianceField]);
      setNewComplianceField('');
    }
  }

  function removeComplianceField(field: string) {
    setComplianceFields(complianceFields.filter(f => f !== field));
  }

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 14, color: C.text2 }}>Loading policy...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          Dedup Merge Policies
        </h1>
        <div style={{ fontSize: 14, color: C.text2 }}>
          Configure how duplicate companies are merged together.
        </div>
        {isDefault && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              background: '#FEF3C7',
              border: '1px solid #FCD34D',
              fontSize: 13,
              color: '#92400E',
            }}
          >
            Using default policy. Save changes to create your own org-specific policy.
          </div>
        )}
      </div>

      {/* Section 1: Policy Name */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 12 }}>
          Policy Name
        </h2>
        <input
          type="text"
          value={policyName}
          onChange={(e) => setPolicyName(e.target.value)}
          style={{
            width: '100%',
            maxWidth: 400,
            padding: '8px 12px',
            fontSize: 14,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
          }}
          placeholder="Default Policy"
        />
      </div>

      {/* Section 2: Exclusion Rules */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 12 }}>
          Exclusion Rules
        </h2>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
          Block merges if these conditions are detected:
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={blockDifferentParent}
              onChange={(e) => setBlockDifferentParent(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ color: C.text }}>Block if records have different parent companies</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={blockClosedWonDeals}
              onChange={(e) => setBlockClosedWonDeals(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ color: C.text }}>Block if any record has closed-won deals</span>
          </label>
        </div>
      </div>

      {/* Section 3: Compliance Fields */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 12 }}>
          Compliance Fields
        </h2>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
          These fields always use the most restrictive value across all records:
        </div>

        <div style={{ marginBottom: 12 }}>
          {complianceFields.map((field) => (
            <div
              key={field}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: C.surface,
                border: `1px solid ${C.border}`,
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 13, color: C.text }}>
                  {getComplianceFieldLabel(field)}
                </div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: C.text3 }}>
                  {field}
                </div>
              </div>
              <button
                onClick={() => removeComplianceField(field)}
                style={{
                  padding: '4px 8px',
                  fontSize: 12,
                  color: C.red,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={newComplianceField}
            onChange={(e) => setNewComplianceField(e.target.value)}
            placeholder="hs_email_optout"
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 14,
              fontFamily: 'monospace',
              border: `1px solid ${C.border}`,
              borderRadius: 4,
            }}
          />
          <button
            onClick={addComplianceField}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              color: C.indigo,
              background: 'white',
              border: `1px solid ${C.indigo}`,
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Add Field
          </button>
        </div>
      </div>

      {/* Section 4: Field Merge Rules */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 12 }}>
          Field Merge Rules
        </h2>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
          Define how specific fields should be merged. Rules are applied in order (top to bottom).
          Use <code>*</code> for wildcard to match all fields.
        </div>

        {fieldRules.length === 0 && (
          <div
            style={{
              padding: 24,
              background: C.surface,
              border: `1px solid ${C.border}`,
              textAlign: 'center',
              fontSize: 13,
              color: C.text3,
              marginBottom: 16,
            }}
          >
            No field rules defined. Click "Add Rule" to create one.
          </div>
        )}

        {fieldRules.map((rule, index) => (
          <div
            key={index}
            style={{
              padding: 20,
              background: C.surface,
              border: `1px solid ${C.border}`,
              marginBottom: 16,
              borderRadius: 0,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 16 }}>
              {/* Field name */}
              <div>
                <div style={{ fontSize: 11, color: C.text3, marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Field
                </div>
                <input
                  type="text"
                  value={rule.field}
                  onChange={(e) =>
                    updateFieldRule(index, { field: e.target.value })
                  }
                  placeholder="lifecyclestage"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 13,
                    fontFamily: 'monospace',
                    border: `1px solid ${C.border}`,
                    borderRadius: 0,
                    background: C.bg,
                    color: C.text,
                  }}
                />
              </div>

              {/* Rule type */}
              <div>
                <div style={{ fontSize: 11, color: C.text3, marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Rule
                </div>
                <select
                  value={rule.rule}
                  onChange={(e) =>
                    updateFieldRule(index, { rule: e.target.value })
                  }
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 13,
                    border: `1px solid ${C.border}`,
                    borderRadius: 0,
                    background: C.bg,
                    color: C.text,
                    cursor: 'pointer',
                  }}
                >
                  {RULE_TYPES.map((rt) => (
                    <option key={rt.value} value={rt.value}>
                      {rt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Rule description */}
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 16, fontStyle: 'italic' }}>
              {RULE_TYPES.find((rt) => rt.value === rule.rule)?.description}
            </div>

            {/* Config for keep_most_advanced */}
            {rule.rule === 'keep_most_advanced' && (
              <div style={{ marginBottom: 16, padding: 12, background: C.bg, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.text3, marginBottom: 6, fontWeight: 500 }}>
                  Funnel Order (comma-separated)
                </div>
                <input
                  type="text"
                  value={rule.config.order?.join(', ') || ''}
                  onChange={(e) =>
                    updateFieldRule(index, {
                      config: { order: e.target.value.split(',').map(s => s.trim()) },
                    })
                  }
                  placeholder="lead, marketingqualifiedlead, salesqualifiedlead, opportunity, customer"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    border: `1px solid ${C.border}`,
                    borderRadius: 0,
                    background: C.surface,
                    color: C.text,
                  }}
                />
              </div>
            )}

            {/* Config for append_both */}
            {rule.rule === 'append_both' && (
              <div style={{ marginBottom: 16, padding: 12, background: C.bg, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.text3, marginBottom: 6, fontWeight: 500 }}>
                  Separator
                </div>
                <input
                  type="text"
                  value={rule.config.separator || '; '}
                  onChange={(e) =>
                    updateFieldRule(index, {
                      config: { separator: e.target.value },
                    })
                  }
                  placeholder="; "
                  style={{
                    width: 200,
                    padding: '8px 12px',
                    fontSize: 13,
                    border: `1px solid ${C.border}`,
                    borderRadius: 0,
                    background: C.surface,
                    color: C.text,
                  }}
                />
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
              <button
                onClick={() => moveFieldRule(index, 'up')}
                disabled={index === 0}
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  background: 'transparent',
                  color: index === 0 ? C.text3 : C.text,
                  border: `1px solid ${C.border}`,
                  borderRadius: 0,
                  cursor: index === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                ↑ Move up
              </button>
              <button
                onClick={() => moveFieldRule(index, 'down')}
                disabled={index === fieldRules.length - 1}
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  background: 'transparent',
                  color: index === fieldRules.length - 1 ? C.text3 : C.text,
                  border: `1px solid ${C.border}`,
                  borderRadius: 0,
                  cursor: index === fieldRules.length - 1 ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                ↓ Move down
              </button>
              <button
                onClick={() => removeFieldRule(index)}
                style={{
                  marginLeft: 'auto',
                  padding: '6px 12px',
                  fontSize: 11,
                  color: C.red,
                  background: 'transparent',
                  border: `1px solid ${C.red}`,
                  borderRadius: 0,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addFieldRule}
          style={{
            padding: '10px 20px',
            fontSize: 13,
            color: C.text,
            background: C.indigo,
            border: `1px solid ${C.indigo}`,
            borderRadius: 0,
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          + Add Rule
        </button>
      </div>

      {/* Save button */}
      <div
        style={{
          borderTop: `1px solid ${C.border}`,
          paddingTop: 24,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <button
          onClick={savePolicy}
          disabled={saving}
          style={{
            padding: '12px 24px',
            fontSize: 14,
            fontWeight: 500,
            color: 'white',
            background: saving ? C.text3 : C.indigo,
            border: 'none',
            borderRadius: 4,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : 'Save Policy'}
        </button>
      </div>
    </div>
  );
}
