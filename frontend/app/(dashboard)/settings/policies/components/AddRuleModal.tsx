'use client';

/**
 * Add Rule Modal
 *
 * 3-step wizard for creating a new survivorship rule:
 * 1. Select field
 * 2. Select rule type
 * 3. Configure rule
 */

import { useState, useEffect } from 'react';
import { C, F } from '@/lib/design-tokens';
import { X } from 'lucide-react';
import { SourceRankEditor } from './SourceRankEditor';
import { OrderEditor } from './OrderEditor';

interface AddRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: {
    field_key: string;
    rule_type: string;
    rule_config: Record<string, any>;
  }) => Promise<void>;
  fieldOptions: Array<{ key: string; label: string; type: string }>;
}

type RuleType =
  | 'most_recent'
  | 'source_preference'
  | 'never_downgrade'
  | 'prefer_nonempty'
  | 'specific_value'
  | 'rollup';

const DEFAULT_SOURCE_RANK = [
  'graphiq',
  'apollo',
  'zoominfo',
  'cognism',
  'refyne_search',
  'clearbit',
  'user_entered',
  'hubspot_import',
  'unknown',
];

const DEFAULT_LIFECYCLE_ORDER = [
  'Opportunity',
  'Sales Qualified Lead',
  'Marketing Qualified Lead',
  'Lead',
  'Subscriber',
  'Other',
];

/**
 * SpecificValueConfig - Step 3 configuration for specific_value rule type
 */
function SpecificValueConfig({
  fieldKey,
  fieldLabel,
  valueOrder,
  onChange,
}: {
  fieldKey: string;
  fieldLabel: string;
  valueOrder: string[];
  onChange: (values: string[]) => void;
}) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');

    fetch(`/api/hubspot/properties/${fieldKey}/options`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch options');
        return r.json();
      })
      .then((data) => {
        if (data.options && data.options.length > 0) {
          setOptions(data.options);
          // Initialize value order with fetched options
          onChange(data.options.map((o: any) => o.value));
        } else {
          setError('No options found for this field');
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch field options:', err);
        setError('Failed to load field values from HubSpot');
        setLoading(false);
      });
  }, [fieldKey]);

  if (loading) {
    return (
      <div style={{ color: C.text3, fontSize: 13 }}>
        Loading {fieldLabel} values from HubSpot...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: C.text3, fontSize: 13 }}>
        {error}
      </div>
    );
  }

  // Map value order to option labels for display
  const orderedItems = valueOrder
    .map((value) => {
      const option = options.find((o) => o.value === value);
      return option ? option.label : value;
    })
    .filter(Boolean);

  return (
    <div>
      <p style={{ color: C.text3, marginBottom: 16, fontSize: 13 }}>
        Drag to set priority order. The highest value always survives a merge.
      </p>
      <OrderEditor
        values={orderedItems}
        onChange={(ordered) => {
          // Map labels back to values
          const order = ordered.map((label) => {
            const option = options.find((o) => o.label === label);
            return option ? option.value : label;
          });
          onChange(order);
        }}
        topLabel="Always keeps"
        bottomLabel="Lowest priority"
      />
      <p style={{ color: C.text3, marginTop: 12, fontSize: 12 }}>
        Values fetched from your HubSpot property settings.
      </p>
    </div>
  );
}

/**
 * RollupConfig - Step 3 configuration for rollup rule type
 */
function RollupConfig({
  fieldLabel,
  method,
  onChange,
}: {
  fieldLabel: string;
  method: 'max' | 'min' | 'sum' | 'average';
  onChange: (method: 'max' | 'min' | 'sum' | 'average') => void;
}) {
  const options = [
    {
      value: 'max' as const,
      label: 'Keep highest value',
      description: 'Recommended for revenue, headcount',
    },
    {
      value: 'min' as const,
      label: 'Keep lowest value',
      description: 'Use when lower is more conservative',
    },
    {
      value: 'sum' as const,
      label: 'Sum all values',
      description: 'Use for cumulative metrics only',
    },
    {
      value: 'average' as const,
      label: 'Average all values',
      description: 'Use when both values are equally reliable',
    },
  ];

  return (
    <div>
      <p style={{ color: C.text3, marginBottom: 16, fontSize: 13 }}>
        For {fieldLabel}: how should values be combined when records are merged?
      </p>
      {options.map((opt) => (
        <label
          key={opt.value}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '12px 16px',
            marginBottom: 8,
            background: method === opt.value ? C.indigoDim : C.surface,
            border: `1px solid ${method === opt.value ? C.indigo : C.border}`,
            cursor: 'pointer',
          }}
        >
          <input
            type="radio"
            name="rollup_method"
            value={opt.value}
            checked={method === opt.value}
            onChange={() => onChange(opt.value)}
            style={{ marginTop: 2, cursor: 'pointer' }}
          />
          <div>
            <div style={{ color: C.text, fontWeight: 500, fontSize: 13 }}>
              {opt.label}
            </div>
            <div style={{ color: C.text3, fontSize: 12, marginTop: 2 }}>
              {opt.description}
            </div>
          </div>
        </label>
      ))}
    </div>
  );
}

export function AddRuleModal({ isOpen, onClose, onSave, fieldOptions }: AddRuleModalProps) {
  const [step, setStep] = useState(1);
  const [fieldScope, setFieldScope] = useState<'all' | 'specific'>('specific');
  const [selectedField, setSelectedField] = useState('');
  const [selectedFieldType, setSelectedFieldType] = useState<string>('text');
  const [selectedRuleType, setSelectedRuleType] = useState<RuleType | ''>('');
  const [sourceRank, setSourceRank] = useState<string[]>(DEFAULT_SOURCE_RANK);
  const [valueOrder, setValueOrder] = useState<string[]>(DEFAULT_LIFECYCLE_ORDER);
  const [rollupMethod, setRollupMethod] = useState<'max' | 'min' | 'sum' | 'average'>('max');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setStep(1);
    setFieldScope('specific');
    setSelectedField('');
    setSelectedFieldType('text');
    setSelectedRuleType('');
    setSourceRank(DEFAULT_SOURCE_RANK);
    setValueOrder(DEFAULT_LIFECYCLE_ORDER);
    setRollupMethod('max');
    onClose();
  };

  const handleFieldChange = (fieldKey: string) => {
    setSelectedField(fieldKey);
    const field = fieldOptions.find((f) => f.key === fieldKey);
    setSelectedFieldType(field?.type || 'text');
  };

  const handleNext = () => {
    if (step === 1) {
      // Validate field selection
      if (fieldScope === 'specific' && !selectedField) return;
      setStep(2);
    } else if (step === 2) {
      // Validate rule type selection
      if (!selectedRuleType) return;
      // Set appropriate default config based on rule type
      if (selectedRuleType === 'never_downgrade') {
        const field = fieldOptions.find((f) => f.key === selectedField);
        if (selectedField === 'lifecyclestage') {
          setValueOrder(DEFAULT_LIFECYCLE_ORDER);
        } else {
          setValueOrder(['Value 1', 'Value 2', 'Value 3']);
        }
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const fieldKey = fieldScope === 'all' ? '*' : selectedField;
      let ruleConfig: Record<string, any> = {};

      if (selectedRuleType === 'source_preference') {
        ruleConfig = { source_rank: sourceRank };
      } else if (selectedRuleType === 'never_downgrade') {
        ruleConfig = { order: valueOrder.map((v) => v.toLowerCase()) };
      } else if (selectedRuleType === 'specific_value') {
        ruleConfig = { value_order: valueOrder };
      } else if (selectedRuleType === 'rollup') {
        ruleConfig = { method: rollupMethod };
      }
      // most_recent and prefer_nonempty have no config

      await onSave({
        field_key: fieldKey,
        rule_type: selectedRuleType,
        rule_config: ruleConfig,
      });

      handleClose();
    } catch (error) {
      console.error('Failed to save rule:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const canProceedStep1 = fieldScope === 'all' || selectedField !== '';
  const canProceedStep2 = selectedRuleType !== '';

  const selectedFieldLabel =
    fieldOptions.find((f) => f.key === selectedField)?.label || selectedField;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        fontFamily: F.sans,
      }}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          width: '90%',
          maxWidth: 600,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 500, color: C.text, margin: 0 }}>
            Add survivorship rule
          </h2>
          <button
            onClick={handleClose}
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

        {/* Content */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          {/* Step 1: Select field */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 14, color: C.text, marginBottom: 20 }}>
                Which field does this rule apply to?
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 12,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  checked={fieldScope === 'all'}
                  onChange={() => setFieldScope('all')}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: C.text }}>
                  All fields (applies globally as fallback)
                </span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 20,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  checked={fieldScope === 'specific'}
                  onChange={() => setFieldScope('specific')}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: C.text }}>Specific field</span>
              </label>

              {fieldScope === 'specific' && (
                <div>
                  <div style={{ fontSize: 13, color: C.text, marginBottom: 8 }}>Field</div>
                  <select
                    value={selectedField}
                    onChange={(e) => handleFieldChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 13,
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      borderRadius: 0,
                      color: C.text,
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">Select a field...</option>
                    {fieldOptions
                      .filter((f) => f.key !== '*')
                      .map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.label}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select rule type */}
          {step === 2 && (
            <div>
              <div style={{ fontSize: 14, color: C.text, marginBottom: 20 }}>
                How should conflicts be resolved for {fieldScope === 'all' ? 'all fields' : selectedFieldLabel}?
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '16px',
                    background: C.surface,
                    border: `1px solid ${selectedRuleType === 'most_recent' ? C.indigo : C.border}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="radio"
                      checked={selectedRuleType === 'most_recent'}
                      onChange={() => setSelectedRuleType('most_recent')}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Most recent</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.text3, paddingLeft: 28 }}>
                    Keep the value from whichever record was most recently updated
                  </div>
                  <div style={{ fontSize: 11, color: C.text3, paddingLeft: 28 }}>
                    Best for: Phone, Email, Address
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '16px',
                    background: C.surface,
                    border: `1px solid ${selectedRuleType === 'source_preference' ? C.indigo : C.border}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="radio"
                      checked={selectedRuleType === 'source_preference'}
                      onChange={() => setSelectedRuleType('source_preference')}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Source preference</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.text3, paddingLeft: 28 }}>
                    Prefer values from more trusted data sources
                  </div>
                  <div style={{ fontSize: 11, color: C.text3, paddingLeft: 28 }}>
                    Best for: Industry, Revenue, Employee count
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '16px',
                    background: C.surface,
                    border: `1px solid ${selectedRuleType === 'never_downgrade' ? C.indigo : C.border}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="radio"
                      checked={selectedRuleType === 'never_downgrade'}
                      onChange={() => setSelectedRuleType('never_downgrade')}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Never downgrade</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.text3, paddingLeft: 28 }}>
                    Keep the most advanced value in a defined order
                  </div>
                  <div style={{ fontSize: 11, color: C.text3, paddingLeft: 28 }}>
                    Best for: Lifecycle stage, Lead status
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '16px',
                    background: C.surface,
                    border: `1px solid ${selectedRuleType === 'prefer_nonempty' ? C.indigo : C.border}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="radio"
                      checked={selectedRuleType === 'prefer_nonempty'}
                      onChange={() => setSelectedRuleType('prefer_nonempty')}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Prefer nonempty</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.text3, paddingLeft: 28 }}>
                    Keep any value over an empty field
                  </div>
                  <div style={{ fontSize: 11, color: C.text3, paddingLeft: 28 }}>
                    Best for: All fields (already a default)
                  </div>
                </label>

                {fieldScope === 'specific' && selectedFieldType === 'enum' && (
                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      padding: '16px',
                      background: C.surface,
                      border: `1px solid ${selectedRuleType === 'specific_value' ? C.indigo : C.border}`,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="radio"
                        checked={selectedRuleType === 'specific_value'}
                        onChange={() => setSelectedRuleType('specific_value')}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Specific value wins</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.text3, paddingLeft: 28 }}>
                      Always keep a particular value when it appears on either record
                    </div>
                    <div style={{ fontSize: 11, color: C.text3, paddingLeft: 28 }}>
                      Best for: Customer Type, Lead Status, custom picklist fields
                    </div>
                  </label>
                )}

                {fieldScope === 'specific' && selectedFieldType === 'number' && (
                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      padding: '16px',
                      background: C.surface,
                      border: `1px solid ${selectedRuleType === 'rollup' ? C.indigo : C.border}`,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="radio"
                        checked={selectedRuleType === 'rollup'}
                        onChange={() => setSelectedRuleType('rollup')}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Rollup</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.text3, paddingLeft: 28 }}>
                      Combine values mathematically across duplicate records
                    </div>
                    <div style={{ fontSize: 11, color: C.text3, paddingLeft: 28 }}>
                      Best for: Revenue, Employee count, numeric metrics
                    </div>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Configure */}
          {step === 3 && (
            <div>
              {selectedRuleType === 'most_recent' && (
                <div>
                  <div style={{ fontSize: 14, color: C.text, marginBottom: 12 }}>
                    For {fieldScope === 'all' ? 'all fields' : selectedFieldLabel}: keep the most recently updated
                    value.
                  </div>
                  <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.6 }}>
                    When two records are merged, the {fieldScope === 'all' ? 'field values' : selectedFieldLabel} from
                    whichever record was updated more recently will be kept, regardless of which record is selected as
                    master.
                  </div>
                </div>
              )}

              {selectedRuleType === 'source_preference' && (
                <div>
                  <div style={{ fontSize: 14, color: C.text, marginBottom: 20 }}>
                    For {fieldScope === 'all' ? 'all fields' : selectedFieldLabel}: configure trusted source order.
                  </div>
                  <SourceRankEditor sources={sourceRank} onChange={setSourceRank} />
                </div>
              )}

              {selectedRuleType === 'never_downgrade' && (
                <div>
                  <div style={{ fontSize: 14, color: C.text, marginBottom: 20 }}>
                    For {fieldScope === 'all' ? 'all fields' : selectedFieldLabel}: define the value order.
                  </div>
                  <OrderEditor
                    values={valueOrder}
                    onChange={setValueOrder}
                    fieldKey={selectedField}
                    topLabel="Most advanced"
                    bottomLabel="Least advanced"
                  />
                </div>
              )}

              {selectedRuleType === 'prefer_nonempty' && (
                <div>
                  <div style={{ fontSize: 14, color: C.text, marginBottom: 12 }}>
                    For {fieldScope === 'all' ? 'all fields' : selectedFieldLabel}: prefer any value over empty fields.
                  </div>
                  <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.6 }}>
                    When two records are merged, if the master has an empty{' '}
                    {fieldScope === 'all' ? 'field' : selectedFieldLabel} and the duplicate has a value, the
                    duplicate's value will be kept.
                  </div>
                </div>
              )}

              {selectedRuleType === 'specific_value' && (
                <div>
                  <div style={{ fontSize: 14, color: C.text, marginBottom: 20 }}>
                    For {selectedFieldLabel}: which value should always win?
                  </div>
                  <SpecificValueConfig
                    fieldKey={selectedField}
                    fieldLabel={selectedFieldLabel}
                    valueOrder={valueOrder}
                    onChange={setValueOrder}
                  />
                </div>
              )}

              {selectedRuleType === 'rollup' && (
                <div>
                  <div style={{ fontSize: 14, color: C.text, marginBottom: 20 }}>
                    For {selectedFieldLabel}: how should values be combined?
                  </div>
                  <RollupConfig
                    fieldLabel={selectedFieldLabel}
                    method={rollupMethod}
                    onChange={setRollupMethod}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={step === 1 ? handleClose : handleBack}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              background: 'none',
              color: C.text,
              border: `1px solid ${C.border}`,
              borderRadius: 0,
              cursor: 'pointer',
            }}
          >
            {step === 1 ? 'Cancel' : '← Back'}
          </button>

          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                background:
                  (step === 1 && canProceedStep1) || (step === 2 && canProceedStep2) ? C.indigo : C.surface,
                color: (step === 1 && canProceedStep1) || (step === 2 && canProceedStep2) ? C.text : C.text3,
                border: `1px solid ${
                  (step === 1 && canProceedStep1) || (step === 2 && canProceedStep2) ? C.indigo : C.border
                }`,
                borderRadius: 0,
                cursor:
                  (step === 1 && canProceedStep1) || (step === 2 && canProceedStep2) ? 'pointer' : 'not-allowed',
              }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                background: isSaving ? C.surface : C.indigo,
                color: isSaving ? C.text3 : C.text,
                border: `1px solid ${isSaving ? C.border : C.indigo}`,
                borderRadius: 0,
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? 'Saving...' : 'Save rule'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
