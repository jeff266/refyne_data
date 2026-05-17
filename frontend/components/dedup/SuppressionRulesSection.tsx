'use client';

import { useState, useCallback } from 'react';
import { GripVertical, Plus, Pencil, Trash2, X } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, PrimaryBtn, GhostBtn, Toggle, Chip } from '@/components/refyne';
import type {
  SuppressionRule,
  RuleCondition,
  SuppressionAction,
  ConditionOperator,
  RuleConditionOperator,
  ConditionScope,
  CreateSuppressionRuleRequest,
} from '@/lib/dedup/types';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface SuppressionRulesSectionProps {
  rules: SuppressionRule[];
  onRulesChange: (rules: SuppressionRule[]) => void;
}

// Default fields for condition builder
const CANONICAL_FIELDS = [
  { value: 'name', label: 'Company Name' },
  { value: 'domain', label: 'Domain' },
  { value: 'industry', label: 'Industry' },
  { value: 'phone', label: 'Phone' },
  { value: 'employees', label: 'Employee Count' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'country', label: 'Country' },
  { value: 'website', label: 'Website' },
  { value: 'linkedin_url', label: 'LinkedIn URL' },
  { value: 'annual_revenue', label: 'Annual Revenue' },
  { value: 'business_unit', label: 'Business Unit' },
  { value: 'location', label: 'Location' },
];

const OPERATORS: { value: RuleConditionOperator; label: string; needsValue: boolean }[] = [
  { value: 'is_blank', label: 'Is blank', needsValue: false },
  { value: 'is_not_blank', label: 'Is not blank', needsValue: false },
  { value: 'equals', label: 'Equals', needsValue: true },
  { value: 'not_equals', label: 'Not equals', needsValue: true },
  { value: 'differs_between', label: 'Differs between records', needsValue: false },
  { value: 'matches_between', label: 'Matches between records', needsValue: false },
  { value: 'contains', label: 'Contains', needsValue: true },
];

const SCOPES: { value: ConditionScope; label: string }[] = [
  { value: 'both', label: 'Both records' },
  { value: 'either', label: 'Either record' },
  { value: 'record_a', label: 'Record A only' },
  { value: 'record_b', label: 'Record B only' },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatConditionsSummary(conditions: RuleCondition[], operator: ConditionOperator): string {
  const parts = conditions.map((c) => {
    const fieldLabel = CANONICAL_FIELDS.find((f) => f.value === c.field)?.label || c.field;
    const opLabel = OPERATORS.find((o) => o.value === c.operator)?.label || c.operator;
    return `${fieldLabel} ${opLabel.toLowerCase()}${c.value ? ` "${c.value}"` : ''}`;
  });

  if (operator === 'OR') {
    return parts.join(' OR ');
  }
  return parts.join(' · ');
}

function getActionBadgeStyle(action: SuppressionAction): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: 4,
  };

  switch (action) {
    case 'block':
      return { ...base, background: C.redDim, color: C.red };
    case 'review':
      return { ...base, background: C.amberDim, color: C.amber };
    case 'require_approval':
      return { ...base, background: C.indigoDim, color: C.indigo };
  }
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function SuppressionRulesSection({ rules, onRulesChange }: SuppressionRulesSectionProps) {
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SuppressionRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formAction, setFormAction] = useState<SuppressionAction>('block');
  const [formApprover, setFormApprover] = useState('');
  const [formOperator, setFormOperator] = useState<ConditionOperator>('AND');
  const [formConditions, setFormConditions] = useState<RuleCondition[]>([
    { field: 'location', operator: 'differs_between', value: null, scope: 'both' },
  ]);
  const [formNote, setFormNote] = useState('');

  // Open slide-over for new rule
  const handleNewRule = () => {
    setEditingRule(null);
    setFormName('');
    setFormAction('block');
    setFormApprover('');
    setFormOperator('AND');
    setFormConditions([{ field: 'location', operator: 'differs_between', value: null, scope: 'both' }]);
    setFormNote('');
    setSlideOverOpen(true);
  };

  // Open slide-over for editing
  const handleEditRule = (rule: SuppressionRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormAction(rule.action);
    setFormApprover(rule.approverUserId || '');
    setFormOperator(rule.conditionOperator);
    setFormConditions([...rule.conditions]);
    setFormNote(rule.uiNote || '');
    setSlideOverOpen(true);
  };

  // Add a condition
  const addCondition = () => {
    setFormConditions([
      ...formConditions,
      { field: 'name', operator: 'differs_between', value: null, scope: 'both' },
    ]);
  };

  // Update a condition
  const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
    const newConditions = [...formConditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setFormConditions(newConditions);
  };

  // Remove a condition
  const removeCondition = (index: number) => {
    if (formConditions.length <= 1) return;
    setFormConditions(formConditions.filter((_, i) => i !== index));
  };

  // Save rule
  const handleSaveRule = async () => {
    if (!formName.trim()) return;
    if (formConditions.length === 0) return;
    if (formAction === 'require_approval' && !formApprover.trim()) return;

    setSaving(true);

    try {
      const body: CreateSuppressionRuleRequest = {
        name: formName.trim(),
        action: formAction,
        approverUserId: formAction === 'require_approval' ? formApprover.trim() : undefined,
        conditionOperator: formOperator,
        conditions: formConditions,
        uiNote: formNote.trim() || undefined,
      };

      if (editingRule) {
        // Update existing rule
        const res = await fetch(`/api/dedup/suppression-rules/${editingRule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error('Failed to update rule');

        const data = await res.json();
        const updatedRules = rules.map((r) =>
          r.id === editingRule.id ? data.rule : r
        );
        onRulesChange(updatedRules);
      } else {
        // Create new rule
        const res = await fetch('/api/dedup/suppression-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error('Failed to create rule');

        const data = await res.json();
        onRulesChange([...rules, data.rule]);
      }

      setSlideOverOpen(false);
    } catch (err) {
      console.error('Failed to save rule:', err);
    } finally {
      setSaving(false);
    }
  };

  // Toggle rule enabled state
  const handleToggleEnabled = async (rule: SuppressionRule) => {
    try {
      const res = await fetch(`/api/dedup/suppression-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });

      if (!res.ok) throw new Error('Failed to toggle rule');

      const data = await res.json();
      const updatedRules = rules.map((r) =>
        r.id === rule.id ? data.rule : r
      );
      onRulesChange(updatedRules);
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  // Delete rule
  const handleDeleteRule = async (rule: SuppressionRule) => {
    if (rule.suppressedCount > 0 && deleteConfirm !== rule.id) {
      setDeleteConfirm(rule.id);
      return;
    }

    try {
      const res = await fetch(`/api/dedup/suppression-rules/${rule.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete rule');

      onRulesChange(rules.filter((r) => r.id !== rule.id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  // Drag and drop handlers (simplified - would use dnd-kit in production)
  const handleDragStart = (id: string) => {
    setDragging(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragging || dragging === targetId) return;

    const dragIdx = rules.findIndex((r) => r.id === dragging);
    const targetIdx = rules.findIndex((r) => r.id === targetId);
    if (dragIdx === -1 || targetIdx === -1) return;

    const newRules = [...rules];
    const [removed] = newRules.splice(dragIdx, 1);
    newRules.splice(targetIdx, 0, removed);
    onRulesChange(newRules);
  };

  const handleDragEnd = async () => {
    if (!dragging) return;

    // Save new order to server
    try {
      const res = await fetch('/api/dedup/suppression-rules/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: rules.map((r) => r.id) }),
      });

      if (!res.ok) throw new Error('Failed to reorder');
    } catch (err) {
      console.error('Failed to save order:', err);
      // Could revert here
    }

    setDragging(null);
  };

  return (
    <>
      <Card style={{ padding: 20, marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Suppression Rules</div>
          <GhostBtn onClick={handleNewRule} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> New rule
          </GhostBtn>
        </div>

        {rules.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: C.text3, fontSize: 13 }}>
            No suppression rules configured. Create a rule to prevent specific pairs from matching.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rules.map((rule) => (
              <div
                key={rule.id}
                draggable
                onDragStart={() => handleDragStart(rule.id)}
                onDragOver={(e) => handleDragOver(e, rule.id)}
                onDragEnd={handleDragEnd}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  background: dragging === rule.id ? C.hover : C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  cursor: 'grab',
                  opacity: dragging === rule.id ? 0.5 : 1,
                }}
              >
                <GripVertical size={14} style={{ color: C.text3 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{rule.name}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: C.text3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatConditionsSummary(rule.conditions, rule.conditionOperator)}
                  </div>
                </div>

                <span style={getActionBadgeStyle(rule.action)}>
                  {rule.action === 'require_approval' ? 'Approval' : rule.action}
                </span>

                <Toggle
                  on={rule.enabled}
                  onToggle={() => handleToggleEnabled(rule)}
                />

                <GhostBtn
                  onClick={() => handleEditRule(rule)}
                  style={{ padding: 4 }}
                >
                  <Pencil size={14} />
                </GhostBtn>

                {deleteConfirm === rule.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <GhostBtn
                      onClick={() => setDeleteConfirm(null)}
                      style={{ padding: 4, fontSize: 11 }}
                    >
                      Cancel
                    </GhostBtn>
                    <GhostBtn
                      onClick={() => handleDeleteRule(rule)}
                      style={{ padding: 4, color: C.red }}
                    >
                      <Trash2 size={14} />
                    </GhostBtn>
                  </div>
                ) : (
                  <GhostBtn
                    onClick={() => handleDeleteRule(rule)}
                    style={{ padding: 4 }}
                  >
                    <Trash2 size={14} />
                  </GhostBtn>
                )}
              </div>
            ))}
          </div>
        )}

        {deleteConfirm && rules.find((r) => r.id === deleteConfirm)?.suppressedCount ? (
          <div style={{ marginTop: 12, padding: 12, background: C.redDim, borderRadius: 6, fontSize: 12, color: C.red }}>
            This rule is currently suppressing {rules.find((r) => r.id === deleteConfirm)?.suppressedCount} pairs.
            Deleting it will return them to the review queue. Click delete again to confirm.
          </div>
        ) : null}
      </Card>

      {/* Slide-over panel */}
      {slideOverOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
          }}
        >
          {/* Backdrop */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
            }}
            onClick={() => setSlideOverOpen(false)}
          />

          {/* Panel */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 480,
              background: C.bg,
              borderLeft: `1px solid ${C.border}`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: `1px solid ${C.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
                {editingRule ? 'Edit Rule' : 'New Suppression Rule'}
              </div>
              <GhostBtn onClick={() => setSlideOverOpen(false)} style={{ padding: 4 }}>
                <X size={18} />
              </GhostBtn>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {/* Name */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, color: C.text2, marginBottom: 6 }}>
                  Rule name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Different locations"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 13,
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.text,
                  }}
                />
              </div>

              {/* Conditions */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: C.text2 }}>Conditions *</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: C.text3 }}>Match</span>
                    <select
                      value={formOperator}
                      onChange={(e) => setFormOperator(e.target.value as ConditionOperator)}
                      style={{
                        padding: '4px 8px',
                        fontSize: 12,
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderRadius: 4,
                        color: C.text,
                      }}
                    >
                      <option value="AND">All (AND)</option>
                      <option value="OR">Any (OR)</option>
                    </select>
                  </div>
                </div>

                {formConditions.map((condition, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginBottom: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <select
                      value={condition.field}
                      onChange={(e) => updateCondition(idx, { field: e.target.value })}
                      style={{
                        flex: '1 1 120px',
                        padding: '6px 8px',
                        fontSize: 12,
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderRadius: 4,
                        color: C.text,
                      }}
                    >
                      {CANONICAL_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>

                    <select
                      value={condition.operator}
                      onChange={(e) => updateCondition(idx, { operator: e.target.value as RuleConditionOperator })}
                      style={{
                        flex: '1 1 140px',
                        padding: '6px 8px',
                        fontSize: 12,
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderRadius: 4,
                        color: C.text,
                      }}
                    >
                      {OPERATORS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>

                    {OPERATORS.find((o) => o.value === condition.operator)?.needsValue && (
                      <input
                        type="text"
                        value={condition.value || ''}
                        onChange={(e) => updateCondition(idx, { value: e.target.value })}
                        placeholder="Value"
                        style={{
                          flex: '1 1 100px',
                          padding: '6px 8px',
                          fontSize: 12,
                          background: C.surface,
                          border: `1px solid ${C.border}`,
                          borderRadius: 4,
                          color: C.text,
                        }}
                      />
                    )}

                    <select
                      value={condition.scope}
                      onChange={(e) => updateCondition(idx, { scope: e.target.value as ConditionScope })}
                      style={{
                        flex: '0 0 120px',
                        padding: '6px 8px',
                        fontSize: 12,
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderRadius: 4,
                        color: C.text,
                      }}
                    >
                      {SCOPES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>

                    {formConditions.length > 1 && (
                      <GhostBtn
                        onClick={() => removeCondition(idx)}
                        style={{ padding: 4 }}
                      >
                        <X size={14} />
                      </GhostBtn>
                    )}
                  </div>
                ))}

                <GhostBtn
                  onClick={addCondition}
                  style={{ fontSize: 12, marginTop: 4 }}
                >
                  + Add condition
                </GhostBtn>
              </div>

              {/* Action */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, color: C.text2, marginBottom: 6 }}>
                  Action
                </label>
                <select
                  value={formAction}
                  onChange={(e) => setFormAction(e.target.value as SuppressionAction)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 13,
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.text,
                  }}
                >
                  <option value="block">Block merge</option>
                  <option value="review">Route to review</option>
                  <option value="require_approval">Require approval</option>
                </select>
              </div>

              {/* Approver (when action = require_approval) */}
              {formAction === 'require_approval' && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, color: C.text2, marginBottom: 6 }}>
                    Approver email *
                  </label>
                  <input
                    type="email"
                    value={formApprover}
                    onChange={(e) => setFormApprover(e.target.value)}
                    placeholder="approver@company.com"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 13,
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      color: C.text,
                    }}
                  />
                </div>
              )}

              {/* Note */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, color: C.text2, marginBottom: 6 }}>
                  Note (optional)
                </label>
                <textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="Context for reviewers..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 13,
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.text,
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: `1px solid ${C.border}`,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12,
              }}
            >
              <GhostBtn onClick={() => setSlideOverOpen(false)} disabled={saving}>
                Cancel
              </GhostBtn>
              <PrimaryBtn
                onClick={handleSaveRule}
                disabled={saving || !formName.trim() || formConditions.length === 0}
              >
                {saving ? 'Saving...' : editingRule ? 'Update rule' : 'Save rule'}
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
