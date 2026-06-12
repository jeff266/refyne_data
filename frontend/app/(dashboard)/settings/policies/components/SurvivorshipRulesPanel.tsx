'use client';

/**
 * Survivorship Rules Panel
 *
 * Main panel in Settings → Policies showing default and org-specific survivorship rules.
 * Includes table view, add/edit/delete controls, and integration with AddRuleModal.
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';
import { Plus, Settings as SettingsIcon, X, ChevronUp, ChevronDown } from 'lucide-react';
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
  priority?: number;
}

interface FieldOption {
  key: string;
  label: string;
  type: string;
}

export function SurvivorshipRulesPanel() {
  const searchParams = useSearchParams();
  const objectType = (searchParams.get('object') as 'company' | 'contact') || 'company';

  const [rules, setRules] = useState<SurvivorshipRule[]>([]);
  const [fieldOptions, setFieldOptions] = useState<FieldOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadRules();
  }, [objectType]);

  const loadRules = async () => {
    try {
      const response = await fetch(`/api/settings/survivorship-rules?objectType=${objectType}`);
      const data = await response.json();
      setRules(data.rules || []);
      setFieldOptions(data.field_options || []);
    } catch (error) {
      console.error('Failed to load survivorship rules:', error);
      addToast('error', 'Failed to load survivorship rules');
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

      addToast('success', 'Survivorship rule created');
      await loadRules();
    } catch (error) {
      console.error('Failed to create rule:', error);
      addToast('error', 'Failed to create rule');
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

      addToast('success', `Rule ${!currentActive ? 'activated' : 'deactivated'}`);
      await loadRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
      addToast('error', 'Failed to update rule');
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

      addToast('success', 'Rule deleted');
      await loadRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
      addToast('error', 'Failed to delete rule');
    }
  };

  const handleReorderRule = async (ruleId: string, direction: 'up' | 'down') => {
    const sortedOrgRules = [...orgRules].sort((a, b) => (a.priority || 999) - (b.priority || 999));
    const currentIndex = sortedOrgRules.findIndex(r => r.id === ruleId);

    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === sortedOrgRules.length - 1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    // Get new priority values (swap them)
    const currentPriority = sortedOrgRules[currentIndex].priority || currentIndex + 1;
    const swapPriority = sortedOrgRules[swapIndex].priority || swapIndex + 1;

    try {
      // Update both rules' priorities
      await Promise.all([
        fetch(`/api/settings/survivorship-rules/${sortedOrgRules[currentIndex].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priority: swapPriority }),
        }),
        fetch(`/api/settings/survivorship-rules/${sortedOrgRules[swapIndex].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priority: currentPriority }),
        }),
      ]);

      await loadRules();
      addToast('success', 'Rule order updated');
    } catch (error) {
      console.error('Failed to reorder rule:', error);
      addToast('error', 'Failed to reorder rule');
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
      case 'specific_value':
        const valueOrder = rule.rule_config.value_order;
        const preferredValue = rule.rule_config.preferred_value;
        if (valueOrder && valueOrder.length > 0) {
          return `Prefer: ${valueOrder[0]} first`;
        } else if (preferredValue) {
          return `Always prefer: ${preferredValue}`;
        }
        return 'Always prefer specific value';
      case 'prefer_if_populated':
        return 'Prefer record with non-zero value';
      case 'rollup':
        const aggregation = rule.rule_config.method || 'maximum';
        return `${aggregation.charAt(0).toUpperCase() + aggregation.slice(1)} of values`;
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
      specific_value: 'Specific value',
      rollup: 'Rollup',
      prefer_if_populated: 'Prefer if populated',
    };
    return labels[ruleType] || ruleType;
  };

  const getFieldLabel = (fieldKey: string, ruleType?: string): string => {
    // Special case: TLD disqualifier always shows "Domain matching"
    if (ruleType === 'tld_disqualifier') {
      return 'Domain matching';
    }

    if (fieldKey === '*') return 'All fields';

    // Look up human-readable label from field options
    const field = fieldOptions.find((f) => f.key === fieldKey);
    return field?.label || fieldKey;
  };

  // Filter rules to only show those applicable to the current object type
  const isRuleApplicable = (rule: SurvivorshipRule): boolean => {
    // Wildcard rules apply to all object types
    if (rule.field_key === '*') return true;

    // TLD disqualifier is special case (applies to domain matching)
    if (rule.rule_type === 'tld_disqualifier') return true;

    // Check if the field exists in current object type's field options
    return fieldOptions.some((f) => f.key === rule.field_key);
  };

  const defaultRules = rules.filter((r) => r.is_default && isRuleApplicable(r));
  const orgRules = rules
    .filter((r) => !r.is_default && isRuleApplicable(r))
    .sort((a, b) => (a.priority || 999) - (b.priority || 999));

  if (isLoading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: C.text3 }}>Loading rules...</div>
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
            fontFamily: F.sans,
          }}
        >
          SURVIVORSHIP RULES
        </h2>
        <p style={{ fontSize: 13, color: C.text3, lineHeight: 1.6, maxWidth: 800 }}>
          Define which field values survive when duplicate records are merged. Default rules apply first, then your rules
          in the order shown below.
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
          <div style={{ fontSize: 11, color: C.text3 }}>cannot be deleted</div>
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
              color: C.text3,
              textTransform: 'uppercase',
            }}
          >
            <div>Field</div>
            <div>Rule</div>
            <div>Behavior</div>
            <div></div>
          </div>

          {/* Table rows */}
          {(defaultRules ?? []).map((rule) => (
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
              <div>{getFieldLabel(rule.field_key, rule.rule_type)}</div>
              <div>{getRuleTypeLabel(rule.rule_type)}</div>
              <div style={{ color: C.text3 }}>{getRuleBehaviorText(rule)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    padding: '2px 8px',
                    fontSize: 11,
                    background: rule.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
                    color: rule.is_active ? '#22C55E' : C.text3,
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
            <div style={{ fontSize: 13, color: C.text3, marginBottom: 16 }}>
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
                gridTemplateColumns: '40px 150px 180px 1fr 120px 80px',
                padding: '12px 16px',
                borderBottom: `1px solid ${C.border}`,
                fontSize: 11,
                fontWeight: 500,
                color: C.text3,
                textTransform: 'uppercase',
              }}
            >
              <div>#</div>
              <div>Field</div>
              <div>Rule</div>
              <div>Behavior</div>
              <div></div>
              <div></div>
            </div>

            {/* Table rows */}
            {(orgRules ?? []).map((rule, index) => (
              <div
                key={rule.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 150px 180px 1fr 120px 80px',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: C.text2, fontFamily: F.mono }}>{index + 1}</span>
                </div>
                <div>{getFieldLabel(rule.field_key, rule.rule_type)}</div>
                <div>{getRuleTypeLabel(rule.rule_type)}</div>
                <div style={{ color: C.text3 }}>{getRuleBehaviorText(rule)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      fontSize: 11,
                      background: rule.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
                      color: rule.is_active ? '#22C55E' : C.text3,
                      borderRadius: 2,
                    }}
                  >
                    ● {rule.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button
                      onClick={() => handleReorderRule(rule.id, 'up')}
                      disabled={index === 0}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        color: index === 0 ? C.border : C.text3,
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        opacity: index === 0 ? 0.3 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (index !== 0) e.currentTarget.style.color = C.text;
                      }}
                      onMouseLeave={(e) => {
                        if (index !== 0) e.currentTarget.style.color = C.text3;
                      }}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => handleReorderRule(rule.id, 'down')}
                      disabled={index === orgRules.length - 1}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: index === orgRules.length - 1 ? 'not-allowed' : 'pointer',
                        color: index === orgRules.length - 1 ? C.border : C.text3,
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        opacity: index === orgRules.length - 1 ? 0.3 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (index !== orgRules.length - 1) e.currentTarget.style.color = C.text;
                      }}
                      onMouseLeave={(e) => {
                        if (index !== orgRules.length - 1) e.currentTarget.style.color = C.text3;
                      }}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: C.text3,
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = C.text;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = C.text3;
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
