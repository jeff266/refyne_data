'use client';

/**
 * Survivorship Rules Panel
 *
 * Main panel in Settings → Policies showing default and org-specific survivorship rules.
 * Includes table view, add/edit/delete controls, and integration with AddRuleModal.
 */

import { useState, useEffect } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Plus, Settings as SettingsIcon, X } from 'lucide-react';
import { AddRuleModal } from './AddRuleModal';
import { addToast } from '@/components/ui/toast';

interface SurvivorshipRule {
  id: string;
  org_id: string;
  field_key: string;
  rule_type: string;
  rule_config: Record<string, any>;
  is_active: boolean;
  is_default: boolean;
}

interface FieldOption {
  key: string;
  label: string;
  type: string;
}

export function SurvivorshipRulesPanel() {
  const [rules, setRules] = useState<SurvivorshipRule[]>([]);
  const [fieldOptions, setFieldOptions] = useState<FieldOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const response = await fetch('/api/settings/survivorship-rules');
      const data = await response.json();
      setRules(data.rules || []);
      setFieldOptions(data.field_options || []);
    } catch (error) {
      console.error('Failed to load survivorship rules:', error);
      addToast('Failed to load survivorship rules', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRule = async (rule: {
    field_key: string;
    rule_type: string;
    rule_config: Record<string, any>;
  }) => {
    try {
      const response = await fetch('/api/settings/survivorship-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });

      if (!response.ok) {
        throw new Error('Failed to create rule');
      }

      addToast('Survivorship rule created', 'success');
      await loadRules();
    } catch (error) {
      console.error('Failed to create rule:', error);
      addToast('Failed to create rule', 'error');
      throw error;
    }
  };

  const handleToggleActive = async (ruleId: string, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/settings/survivorship-rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      });

      if (!response.ok) {
        throw new Error('Failed to update rule');
      }

      addToast(`Rule ${!currentActive ? 'activated' : 'deactivated'}`, 'success');
      await loadRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
      addToast('Failed to update rule', 'error');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      const response = await fetch(`/api/settings/survivorship-rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete rule');
      }

      addToast('Rule deleted', 'success');
      await loadRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
      addToast('Failed to delete rule', 'error');
    }
  };

  const getRuleBehaviorText = (rule: SurvivorshipRule): string => {
    switch (rule.rule_type) {
      case 'prefer_nonempty':
        return 'Keep any value over an empty field';
      case 'source_preference':
        const sources = rule.rule_config.source_rank || [];
        return `${sources.slice(0, 3).join(' > ')} > ...`;
      case 'tld_disqualifier':
        return '.com vs .com.au reduces confidence';
      case 'never_downgrade':
        const order = rule.rule_config.order || [];
        return `${order.slice(0, 2).join(' > ')} > ...`;
      case 'most_recent':
        return 'Keep most recently updated value';
      default:
        return '';
    }
  };

  const getRuleTypeLabel = (ruleType: string): string => {
    const labels: Record<string, string> = {
      prefer_nonempty: 'Prefer nonempty',
      source_preference: 'Source preference',
      tld_disqualifier: 'TLD disqualifier',
      never_downgrade: 'Never downgrade',
      most_recent: 'Most recent',
    };
    return labels[ruleType] || ruleType;
  };

  const getFieldLabel = (fieldKey: string): string => {
    if (fieldKey === '*') return 'All fields';
    const field = fieldOptions.find((f) => f.key === fieldKey);
    return field?.label || fieldKey;
  };

  const defaultRules = rules.filter((r) => r.is_default);
  const orgRules = rules.filter((r) => !r.is_default);

  if (isLoading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: C.muted }}>Loading rules...</div>
    );
  }

  return (
    <div style={{ fontFamily: F.sans }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: C.text,
            marginBottom: 8,
            fontFamily: F.serif,
          }}
        >
          SURVIVORSHIP RULES
        </h2>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, maxWidth: 800 }}>
          Define which field values survive when duplicate records are merged. Rules apply in priority order. Default
          rules apply to all fields unless overridden.
        </p>
      </div>

      {/* Default Rules Table */}
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>DEFAULT RULES</div>
          <div style={{ fontSize: 11, color: C.muted }}>cannot be deleted</div>
        </div>

        <div
          style={{
            border: `1px solid ${C.border}`,
            background: C.surface,
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '150px 180px 1fr 120px',
              padding: '12px 16px',
              borderBottom: `1px solid ${C.border}`,
              fontSize: 11,
              fontWeight: 500,
              color: C.muted,
              textTransform: 'uppercase',
            }}
          >
            <div>Field</div>
            <div>Rule</div>
            <div>Behavior</div>
            <div></div>
          </div>

          {/* Table rows */}
          {defaultRules.map((rule) => (
            <div
              key={rule.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '150px 180px 1fr 120px',
                padding: '12px 16px',
                borderBottom: `1px solid ${C.border}`,
                fontSize: 13,
                color: C.text,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div>{getFieldLabel(rule.field_key)}</div>
              <div>{getRuleTypeLabel(rule.rule_type)}</div>
              <div style={{ color: C.muted }}>{getRuleBehaviorText(rule)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    padding: '2px 8px',
                    fontSize: 11,
                    background: rule.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
                    color: rule.is_active ? '#22C55E' : C.muted,
                    borderRadius: 2,
                  }}
                >
                  ● {rule.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Org Rules Table */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>YOUR RULES</div>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              background: C.indigo,
              color: C.text,
              border: `1px solid ${C.indigo}`,
              borderRadius: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Plus size={14} /> Add rule
          </button>
        </div>

        {orgRules.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              border: `1px solid ${C.border}`,
              background: C.surface,
            }}
          >
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              No custom rules yet. Default rules apply to all merges.
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                background: C.indigo,
                color: C.text,
                border: `1px solid ${C.indigo}`,
                borderRadius: 0,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Plus size={14} /> Add rule
            </button>
          </div>
        ) : (
          <div
            style={{
              border: `1px solid ${C.border}`,
              background: C.surface,
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '150px 180px 1fr 120px 60px',
                padding: '12px 16px',
                borderBottom: `1px solid ${C.border}`,
                fontSize: 11,
                fontWeight: 500,
                color: C.muted,
                textTransform: 'uppercase',
              }}
            >
              <div>Field</div>
              <div>Rule</div>
              <div>Behavior</div>
              <div></div>
              <div></div>
            </div>

            {/* Table rows */}
            {orgRules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '150px 180px 1fr 120px 60px',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 13,
                  color: C.text,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div>{getFieldLabel(rule.field_key)}</div>
                <div>{getRuleTypeLabel(rule.rule_type)}</div>
                <div style={{ color: C.muted }}>{getRuleBehaviorText(rule)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      fontSize: 11,
                      background: rule.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
                      color: rule.is_active ? '#22C55E' : C.muted,
                      borderRadius: 2,
                    }}
                  >
                    ● {rule.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: C.muted,
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = C.text;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = C.muted;
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Rule Modal */}
      <AddRuleModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddRule}
        fieldOptions={fieldOptions}
      />
    </div>
  );
}
