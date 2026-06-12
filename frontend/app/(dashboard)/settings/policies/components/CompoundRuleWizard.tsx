'use client';

/**
 * Compound Rule Wizard
 *
 * 3-step wizard for creating compound survivorship rule groups:
 * 1. Name the group
 * 2. Add conditions (field/operator/value builder)
 * 3. Plain-English summary
 */

import { useState, useEffect } from 'react';
import { C, F } from '@/lib/design-tokens';
import { X } from 'lucide-react';
import { PrimaryBtn, GhostBtn } from '@/components/refyne';
import { FieldSearchCombobox } from '@/components/ui/FieldSearchCombobox';

interface Condition {
  field_key: string;
  operator: string;
  value?: string | null;
}

interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  options?: Array<{ label: string; value: string }>;
}

interface CompoundRuleWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (group: { id?: string; name: string; conditions: Condition[] }) => Promise<void>;
  initialGroup?: { id: string; name: string; conditions: Condition[] } | null;
}

export function CompoundRuleWizard({ isOpen, onClose, onSave, initialGroup }: CompoundRuleWizardProps) {
  const [step, setStep] = useState(1);
  const [groupName, setGroupName] = useState('');
  const [conditions, setConditions] = useState<Condition[]>([
    { field_key: '', operator: '', value: '' },
  ]);
  const [properties, setProperties] = useState<HubSpotProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load HubSpot properties when wizard opens
  useEffect(() => {
    if (isOpen) {
      loadProperties();
    }
  }, [isOpen]);

  // Populate initial values when editing
  useEffect(() => {
    if (isOpen && initialGroup) {
      setStep(1);
      setGroupName(initialGroup.name);
      setConditions(initialGroup.conditions.length > 0 ? initialGroup.conditions : [{ field_key: '', operator: '', value: '' }]);
    } else if (isOpen && !initialGroup) {
      // Reset for new group
      setStep(1);
      setGroupName('');
      setConditions([{ field_key: '', operator: '', value: '' }]);
    }
  }, [isOpen, initialGroup]);

  const loadProperties = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hubspot/properties?objectType=company');
      if (res.ok) {
        const data = await res.json();
        // API returns {standard: [...], custom: [...]}, flatten to array
        const props = data.properties || {};
        const allProperties = [
          ...(Array.isArray(props.standard) ? props.standard : []),
          ...(Array.isArray(props.custom) ? props.custom : []),
        ];
        setProperties(allProperties);
      }
    } catch (error) {
      console.error('Failed to load properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOperatorOptions = (fieldKey: string) => {
    const property = properties.find(p => p.name === fieldKey);
    if (!property) return [];

    const type = property.type;

    if (type === 'number') {
      return [
        { value: 'gt', label: 'greater than' },
        { value: 'gte', label: 'greater than or equal to' },
        { value: 'lt', label: 'less than' },
        { value: 'lte', label: 'less than or equal to' },
        { value: 'eq', label: 'equals' },
        { value: 'is_populated', label: 'is populated' },
        { value: 'is_empty', label: 'is empty' },
      ];
    } else if (type === 'enumeration') {
      return [
        { value: 'eq', label: 'equals' },
        { value: 'is_populated', label: 'is populated' },
        { value: 'is_empty', label: 'is empty' },
      ];
    } else {
      // text, string, etc.
      return [
        { value: 'eq', label: 'equals' },
        { value: 'contains', label: 'contains' },
        { value: 'is_populated', label: 'is populated' },
        { value: 'is_empty', label: 'is empty' },
      ];
    }
  };

  const needsValue = (operator: string) => {
    return operator !== 'is_populated' && operator !== 'is_empty';
  };

  const getFieldOptions = (fieldKey: string) => {
    const property = properties.find(p => p.name === fieldKey);
    return property?.options || [];
  };

  const addCondition = () => {
    setConditions([...conditions, { field_key: '', operator: '', value: '' }]);
  };

  const removeCondition = (index: number) => {
    if (conditions.length === 1) return; // Must have at least one condition
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, field: keyof Condition, value: string) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: value };

    // Reset operator and value if field changes
    if (field === 'field_key') {
      updated[index].operator = '';
      updated[index].value = '';
    }

    // Reset value if operator changes to is_populated/is_empty
    if (field === 'operator' && !needsValue(value)) {
      updated[index].value = '';
    }

    setConditions(updated);
  };

  const canProceedToStep2 = () => {
    return groupName.trim().length > 0;
  };

  const canProceedToStep3 = () => {
    return conditions.every(c => {
      return c.field_key && c.operator && (needsValue(c.operator) ? c.value : true);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...(initialGroup?.id && { id: initialGroup.id }),
        name: groupName,
        conditions
      });
      resetAndClose();
    } catch (error) {
      console.error('Failed to save group:', error);
    } finally {
      setSaving(false);
    }
  };

  const resetAndClose = () => {
    setStep(1);
    setGroupName('');
    setConditions([{ field_key: '', operator: '', value: '' }]);
    onClose();
  };

  const getPlainEnglishOperator = (operator: string) => {
    const map: Record<string, string> = {
      gt: 'is greater than',
      gte: 'is greater than or equal to',
      lt: 'is less than',
      lte: 'is less than or equal to',
      eq: 'equals',
      neq: 'does not equal',
      is_populated: 'is populated',
      is_empty: 'is empty',
      contains: 'contains',
    };
    return map[operator] || operator;
  };

  const getFieldLabel = (fieldKey: string) => {
    const property = properties.find(p => p.name === fieldKey);
    return property?.label || fieldKey;
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        width: '100%',
        maxWidth: 600,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, color: C.text, fontFamily: F.serif }}>
            {step === 1 && 'Name the rule group'}
            {step === 2 && 'Add conditions'}
            {step === 3 && 'Confirm rule group'}
          </h2>
          <button
            onClick={resetAndClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: C.text3,
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
        }}>
          {step === 1 && (
            <div>
              <p style={{ fontSize: 13, color: C.text3, marginBottom: 16 }}>
                Groups are evaluated in order. First group where all conditions match for one record wins.
              </p>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: C.text2 }}>
                Group name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. High-value enterprise accounts"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: 14,
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                  fontFamily: F.sans,
                }}
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <p style={{ fontSize: 13, color: C.text3, marginBottom: 16 }}>
                AND logic: ALL conditions must match for this group to select a survivor.
              </p>

              {(conditions ?? []).map((condition, index) => (
                <div key={index} style={{
                  display: 'grid',
                  gridTemplateColumns: needsValue(condition.operator) ? '1fr 1fr 1fr 32px' : '1fr 1fr 32px',
                  gap: 8,
                  marginBottom: 12,
                }}>
                  {/* Field */}
                  <FieldSearchCombobox
                    properties={properties}
                    value={condition.field_key}
                    onChange={(fieldKey) => updateCondition(index, 'field_key', fieldKey)}
                    placeholder="Search fields..."
                  />

                  {/* Operator */}
                  <select
                    value={condition.operator}
                    onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                    disabled={!condition.field_key}
                    style={{
                      padding: '8px 10px',
                      fontSize: 13,
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      color: C.text,
                      fontFamily: F.sans,
                      opacity: condition.field_key ? 1 : 0.5,
                    }}
                  >
                    <option value="">Select operator</option>
                    {(getOperatorOptions(condition.field_key) ?? []).map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {/* Value (if needed) */}
                  {needsValue(condition.operator) && (() => {
                    const fieldOptions = getFieldOptions(condition.field_key);
                    const hasOptions = fieldOptions.length > 0;

                    if (hasOptions) {
                      // Enum field - show dropdown
                      return (
                        <select
                          value={condition.value ?? ''}
                          onChange={(e) => updateCondition(index, 'value', e.target.value)}
                          style={{
                            padding: '8px 10px',
                            fontSize: 13,
                            background: C.bg,
                            border: `1px solid ${C.border}`,
                            color: C.text,
                            fontFamily: F.sans,
                          }}
                        >
                          <option value="">Select value...</option>
                          {fieldOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      );
                    } else {
                      // Non-enum field - show text input
                      return (
                        <input
                          type="text"
                          value={condition.value ?? ''}
                          onChange={(e) => updateCondition(index, 'value', e.target.value)}
                          placeholder="Value"
                          style={{
                            padding: '8px 10px',
                            fontSize: 13,
                            background: C.bg,
                            border: `1px solid ${C.border}`,
                            color: C.text,
                            fontFamily: F.sans,
                          }}
                        />
                      );
                    }
                  })()}

                  {/* Remove button */}
                  <button
                    onClick={() => removeCondition(index)}
                    disabled={conditions.length === 1}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: conditions.length === 1 ? 'not-allowed' : 'pointer',
                      color: conditions.length === 1 ? C.border : C.text3,
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}

              <button
                onClick={addCondition}
                style={{
                  padding: '8px 12px',
                  fontSize: 13,
                  color: C.indigo,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: F.sans,
                }}
              >
                + Add condition
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              <p style={{ fontSize: 13, color: C.text2, marginBottom: 12 }}>
                When ALL of these are true about a record:
              </p>

              <ul style={{ listStyle: 'none', padding: 0, marginBottom: 16 }}>
                {(conditions ?? []).map((condition, index) => (
                  <li key={index} style={{
                    fontSize: 13,
                    color: C.text,
                    marginBottom: 8,
                    paddingLeft: 20,
                    position: 'relative',
                  }}>
                    <span style={{ position: 'absolute', left: 0, color: C.indigo }}>✓</span>
                    {getFieldLabel(condition.field_key)} {getPlainEnglishOperator(condition.operator)}
                    {needsValue(condition.operator) && ` ${condition.value}`}
                  </li>
                ))}
              </ul>

              <p style={{ fontSize: 13, color: C.text2 }}>
                That record will survive the merge.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: `1px solid ${C.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ fontSize: 12, color: C.text3 }}>
            Step {step} of 3
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {step > 1 && (
              <GhostBtn onClick={() => setStep(step - 1)}>
                Back
              </GhostBtn>
            )}
            {step < 3 ? (
              <PrimaryBtn
                onClick={() => setStep(step + 1)}
                disabled={(step === 1 && !canProceedToStep2()) || (step === 2 && !canProceedToStep3())}
              >
                Next
              </PrimaryBtn>
            ) : (
              <PrimaryBtn onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save rule group'}
              </PrimaryBtn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
