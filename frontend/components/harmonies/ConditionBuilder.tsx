'use client';

/**
 * ConditionBuilder
 *
 * Reusable component for building condition groups that restrict which records a harmony applies to.
 * Used in both the New Harmony wizard and the Harmony detail page.
 *
 * Features:
 * - Nested AND/OR logic (top-level match + per-group match)
 * - Field picker with type detection from HubSpot cache
 * - Operator dropdown filtered by field type
 * - Value input that adapts by operator type
 * - Deleted field warnings
 */

import { useState, useEffect } from 'react';
import { Plus, X, AlertTriangle } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { CloseIcon } from '@/components/ui/icons/CloseIcon';
import { HubSpotPropertyPicker } from './HubSpotPropertyPicker';
import {
  OPERATORS_BY_TYPE,
  type ConditionGroups,
  type ConditionGroup,
  type Condition,
  type FieldType,
  type Operator,
} from '@/lib/harmonies/condition-evaluator';

export interface ConditionBuilderProps {
  value: ConditionGroups | null;
  onChange: (groups: ConditionGroups | null) => void;
  objectType: 'company' | 'contact';
}

interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
}

/**
 * Map HubSpot fieldType to our FieldType enum
 */
function mapHubSpotFieldType(hsFieldType: string): FieldType {
  const lower = hsFieldType.toLowerCase();

  if (lower.includes('number') || lower === 'number') return 'number';
  if (lower.includes('bool') || lower === 'bool' || lower === 'booleancheckbox') return 'bool';
  if (lower.includes('date') || lower === 'date') return 'date';
  if (lower.includes('enum') || lower === 'enumeration' || lower === 'select' || lower === 'radio' || lower === 'checkbox') return 'enumeration';

  return 'string'; // Default to string
}

export function ConditionBuilder({ value, onChange, objectType }: ConditionBuilderProps) {
  const [properties, setProperties] = useState<HubSpotProperty[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch HubSpot properties for field type detection
  useEffect(() => {
    async function fetchProperties() {
      try {
        const response = await fetch(`/api/hubspot/properties?objectType=${objectType}`);
        const data = await response.json();

        if (response.ok && data.properties) {
          const allProps = [...(data.properties.standard || []), ...(data.properties.custom || [])];
          setProperties(allProps);
        }
      } catch (error) {
        console.error('[ConditionBuilder] Failed to fetch properties:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProperties();
  }, [objectType]);

  // Initialize with empty group if null
  const groups = value || {
    match: 'all',
    groups: [
      {
        match: 'all',
        conditions: [createEmptyCondition()],
      },
    ],
  };

  function createEmptyCondition(): Condition {
    return {
      field: '',
      fieldLabel: '',
      fieldType: 'string',
      operator: 'equals',
      value: null,
    };
  }

  function handleTopLevelMatchChange(match: 'all' | 'any') {
    onChange({
      ...groups,
      match,
    });
  }

  function handleAddGroup() {
    onChange({
      ...groups,
      groups: [
        ...groups.groups,
        {
          match: 'all',
          conditions: [createEmptyCondition()],
        },
      ],
    });
  }

  function handleRemoveGroup(groupIndex: number) {
    // Don't allow removing the last group
    if (groups.groups.length === 1) return;

    onChange({
      ...groups,
      groups: groups.groups.filter((_, i) => i !== groupIndex),
    });
  }

  function handleGroupMatchChange(groupIndex: number, match: 'all' | 'any') {
    const newGroups = [...groups.groups];
    newGroups[groupIndex] = {
      ...newGroups[groupIndex],
      match,
    };
    onChange({
      ...groups,
      groups: newGroups,
    });
  }

  function handleAddCondition(groupIndex: number) {
    const newGroups = [...groups.groups];
    newGroups[groupIndex] = {
      ...newGroups[groupIndex],
      conditions: [...newGroups[groupIndex].conditions, createEmptyCondition()],
    };
    onChange({
      ...groups,
      groups: newGroups,
    });
  }

  function handleRemoveCondition(groupIndex: number, conditionIndex: number) {
    const group = groups.groups[groupIndex];

    // Don't allow removing the last condition in the last group
    if (groups.groups.length === 1 && group.conditions.length === 1) return;

    const newGroups = [...groups.groups];
    newGroups[groupIndex] = {
      ...newGroups[groupIndex],
      conditions: group.conditions.filter((_, i) => i !== conditionIndex),
    };

    // If group now has no conditions, remove the group
    if (newGroups[groupIndex].conditions.length === 0) {
      newGroups.splice(groupIndex, 1);
    }

    onChange({
      ...groups,
      groups: newGroups,
    });
  }

  function handleConditionFieldChange(
    groupIndex: number,
    conditionIndex: number,
    fieldName: string,
    fieldLabel: string
  ) {
    // Look up field type from properties
    const property = properties.find(p => p.name === fieldName);
    const fieldType = property ? mapHubSpotFieldType(property.fieldType) : 'string';

    // Get default operator for this field type
    const operators = OPERATORS_BY_TYPE[fieldType];
    const defaultOperator = operators[0]?.value || 'equals';

    const newGroups = [...groups.groups];
    const condition = newGroups[groupIndex].conditions[conditionIndex];

    newGroups[groupIndex].conditions[conditionIndex] = {
      ...condition,
      field: fieldName,
      fieldLabel: fieldLabel,
      fieldType: fieldType,
      operator: defaultOperator as Operator,
      value: null, // Reset value when field changes
    };

    onChange({
      ...groups,
      groups: newGroups,
    });
  }

  function handleConditionOperatorChange(
    groupIndex: number,
    conditionIndex: number,
    operator: string
  ) {
    const newGroups = [...groups.groups];
    const condition = newGroups[groupIndex].conditions[conditionIndex];

    newGroups[groupIndex].conditions[conditionIndex] = {
      ...condition,
      operator: operator as Operator,
      value: null, // Reset value when operator changes
    };

    onChange({
      ...groups,
      groups: newGroups,
    });
  }

  function handleConditionValueChange(
    groupIndex: number,
    conditionIndex: number,
    value: any
  ) {
    const newGroups = [...groups.groups];
    newGroups[groupIndex].conditions[conditionIndex] = {
      ...newGroups[groupIndex].conditions[conditionIndex],
      value,
    };

    onChange({
      ...groups,
      groups: newGroups,
    });
  }

  if (loading) {
    return (
      <div style={{ padding: 20, fontSize: 13, color: C.text3 }}>
        Loading properties...
      </div>
    );
  }

  return (
    <div style={{ fontSize: 13 }}>
      {/* Top-level match selector */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: C.text3, fontSize: 12 }}>Match</span>
        <select
          value={groups.match}
          onChange={e => handleTopLevelMatchChange(e.target.value as 'all' | 'any')}
          style={{
            padding: '4px 24px 4px 8px',
            border: `1px solid ${C.border2}`,
            background: C.surface,
            color: C.text,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: F.mono,
            cursor: 'pointer',
          }}
        >
          <option value="all">ALL</option>
          <option value="any">ANY</option>
        </select>
        <span style={{ color: C.text3, fontSize: 12 }}>of the following groups:</span>
      </div>

      {/* Condition groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {groups.groups.map((group, groupIndex) => (
          <div key={groupIndex}>
            {/* AND/OR separator (not shown before first group) */}
            {groupIndex > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  margin: '12px 0',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, height: 1, background: C.border }} />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.text3,
                    fontFamily: F.mono,
                  }}
                >
                  {groups.match === 'all' ? 'AND' : 'OR'}
                </span>
                <div style={{ flex: 1, height: 1, background: C.border }} />
              </div>
            )}

            {/* Group */}
            <ConditionGroupComponent
              group={group}
              groupIndex={groupIndex}
              totalGroups={groups.groups.length}
              properties={properties}
              onMatchChange={match => handleGroupMatchChange(groupIndex, match)}
              onAddCondition={() => handleAddCondition(groupIndex)}
              onRemoveCondition={conditionIndex =>
                handleRemoveCondition(groupIndex, conditionIndex)
              }
              onRemoveGroup={() => handleRemoveGroup(groupIndex)}
              onFieldChange={(conditionIndex, fieldName, fieldLabel) =>
                handleConditionFieldChange(groupIndex, conditionIndex, fieldName, fieldLabel)
              }
              onOperatorChange={(conditionIndex, operator) =>
                handleConditionOperatorChange(groupIndex, conditionIndex, operator)
              }
              onValueChange={(conditionIndex, value) =>
                handleConditionValueChange(groupIndex, conditionIndex, value)
              }
              objectType={objectType}
            />
          </div>
        ))}
      </div>

      {/* Add group button */}
      <button
        onClick={handleAddGroup}
        style={{
          marginTop: 16,
          padding: '8px 12px',
          border: `1px dashed ${C.border2}`,
          background: 'transparent',
          color: C.text2,
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Plus size={14} />
        Add group
      </button>
    </div>
  );
}

// ============================================================================
// ConditionGroupComponent
// ============================================================================

interface ConditionGroupComponentProps {
  group: ConditionGroup;
  groupIndex: number;
  totalGroups: number;
  properties: HubSpotProperty[];
  objectType: 'company' | 'contact';
  onMatchChange: (match: 'all' | 'any') => void;
  onAddCondition: () => void;
  onRemoveCondition: (conditionIndex: number) => void;
  onRemoveGroup: () => void;
  onFieldChange: (conditionIndex: number, fieldName: string, fieldLabel: string) => void;
  onOperatorChange: (conditionIndex: number, operator: string) => void;
  onValueChange: (conditionIndex: number, value: any) => void;
}

function ConditionGroupComponent({
  group,
  groupIndex,
  totalGroups,
  properties,
  objectType,
  onMatchChange,
  onAddCondition,
  onRemoveCondition,
  onRemoveGroup,
  onFieldChange,
  onOperatorChange,
  onValueChange,
}: ConditionGroupComponentProps) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: 16,
        marginBottom: 12,
      }}
    >
      {/* Group header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 12,
          marginBottom: 12,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              color: C.text3,
              fontSize: 10,
              fontWeight: 600,
              fontFamily: F.sans,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            GROUP {groupIndex + 1}
          </span>
          <span style={{ color: C.text3, fontSize: 11 }}>Match</span>
          <select
            value={group.match}
            onChange={e => onMatchChange(e.target.value as 'all' | 'any')}
            style={{
              padding: '2px 20px 2px 6px',
              border: `1px solid ${C.border2}`,
              background: C.bg,
              color: C.text,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: F.mono,
              cursor: 'pointer',
            }}
          >
            <option value="all">ALL</option>
            <option value="any">ANY</option>
          </select>
          <span style={{ color: C.text3, fontSize: 11 }}>of:</span>
        </div>

        {/* Remove group button (only show if more than 1 group) */}
        {totalGroups > 1 && (
          <button
            onClick={onRemoveGroup}
            style={{
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: C.text3,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = C.text)}
            onMouseLeave={e => (e.currentTarget.style.color = C.text3)}
            title="Remove group"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Conditions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {group.conditions.map((condition, conditionIndex) => (
          <ConditionRow
            key={conditionIndex}
            condition={condition}
            conditionIndex={conditionIndex}
            totalConditionsInGroup={group.conditions.length}
            totalGroups={totalGroups}
            properties={properties}
            objectType={objectType}
            onRemove={() => onRemoveCondition(conditionIndex)}
            onFieldChange={(fieldName, fieldLabel) =>
              onFieldChange(conditionIndex, fieldName, fieldLabel)
            }
            onOperatorChange={operator => onOperatorChange(conditionIndex, operator)}
            onValueChange={value => onValueChange(conditionIndex, value)}
          />
        ))}
      </div>

      {/* Add condition button */}
      <button
        onClick={onAddCondition}
        style={{
          marginTop: 12,
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: C.indigo,
          fontSize: 13,
          fontFamily: F.sans,
          cursor: 'pointer',
        }}
        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
      >
        + Add condition
      </button>
    </div>
  );
}

// ============================================================================
// ConditionRow
// ============================================================================

interface ConditionRowProps {
  condition: Condition;
  conditionIndex: number;
  totalConditionsInGroup: number;
  totalGroups: number;
  properties: HubSpotProperty[];
  objectType: 'company' | 'contact';
  onRemove: () => void;
  onFieldChange: (fieldName: string, fieldLabel: string) => void;
  onOperatorChange: (operator: string) => void;
  onValueChange: (value: any) => void;
}

function ConditionRow({
  condition,
  conditionIndex,
  totalConditionsInGroup,
  totalGroups,
  properties,
  objectType,
  onRemove,
  onFieldChange,
  onOperatorChange,
  onValueChange,
}: ConditionRowProps) {
  // Check if field still exists in HubSpot
  const fieldExists = properties.some(p => p.name === condition.field);
  const canRemove = totalGroups > 1 || totalConditionsInGroup > 1;

  // Get available operators for this field type
  const operators = OPERATORS_BY_TYPE[condition.fieldType] || OPERATORS_BY_TYPE.string;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      {/* Field picker */}
      <div style={{ flex: '0 0 200px' }}>
        <HubSpotPropertyPicker
          objectType={objectType}
          value={condition.field}
          onChange={onFieldChange}
          placeholder="Select field..."
        />
        {/* Deleted field warning */}
        {condition.field && !fieldExists && (
          <div
            style={{
              marginTop: 4,
              padding: '4px 8px',
              background: '#FEF3C7',
              border: '1px solid #F59E0B',
              fontSize: 11,
              color: '#92400E',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <AlertTriangle size={12} />
            Field not found in HubSpot
          </div>
        )}
      </div>

      {/* Operator picker */}
      <div style={{ flex: '0 0 140px' }}>
        <select
          value={condition.operator}
          onChange={e => onOperatorChange(e.target.value)}
          disabled={!condition.field}
          style={{
            width: '100%',
            padding: '8px 24px 8px 10px',
            border: `1px solid ${C.border2}`,
            background: condition.field ? C.bg : C.surface,
            color: condition.field ? C.text : C.text3,
            fontSize: 12,
            cursor: condition.field ? 'pointer' : 'not-allowed',
          }}
        >
          {operators.map(op => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>

      {/* Value input */}
      <div style={{ flex: 1 }}>
        <ValueInput
          condition={condition}
          onChange={onValueChange}
          disabled={!condition.field}
        />
      </div>

      {/* Remove button */}
      <button
        onClick={onRemove}
        disabled={!canRemove}
        style={{
          padding: 8,
          border: 'none',
          background: 'transparent',
          color: canRemove ? C.text3 : C.border2,
          cursor: canRemove ? 'pointer' : 'not-allowed',
          flexShrink: 0,
        }}
        title={canRemove ? 'Remove condition' : 'Cannot remove last condition'}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ============================================================================
// ValueInput
// ============================================================================

interface ValueInputProps {
  condition: Condition;
  onChange: (value: any) => void;
  disabled: boolean;
}

function ValueInput({ condition, onChange, disabled }: ValueInputProps) {
  const { operator, fieldType, value } = condition;

  // No input for these operators
  const noInputOperators = ['is_empty', 'is_not_empty', 'is_true', 'is_false'];
  if (noInputOperators.includes(operator)) {
    return (
      <div
        style={{
          padding: 8,
          fontSize: 11,
          color: C.text3,
          fontStyle: 'italic',
        }}
      >
        (no value needed)
      </div>
    );
  }

  // Between operator: two inputs
  if (operator === 'between') {
    const [min, max] = Array.isArray(value) ? value : [null, null];

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'}
          value={min || ''}
          onChange={e => {
            const newMin = fieldType === 'number' ? Number(e.target.value) : e.target.value;
            onChange([newMin, max]);
          }}
          disabled={disabled}
          placeholder="Min"
          style={{
            flex: 1,
            padding: '8px 10px',
            border: `1px solid ${C.border2}`,
            background: disabled ? C.surface : C.bg,
            color: C.text,
            fontSize: 12,
          }}
        />
        <span style={{ color: C.text3, fontSize: 11 }}>and</span>
        <input
          type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'}
          value={max || ''}
          onChange={e => {
            const newMax = fieldType === 'number' ? Number(e.target.value) : e.target.value;
            onChange([min, newMax]);
          }}
          disabled={disabled}
          placeholder="Max"
          style={{
            flex: 1,
            padding: '8px 10px',
            border: `1px solid ${C.border2}`,
            background: disabled ? C.surface : C.bg,
            color: C.text,
            fontSize: 12,
          }}
        />
      </div>
    );
  }

  // Multi-select operators: tag input
  if (operator === 'is_any_of' || operator === 'is_none_of') {
    const tags = Array.isArray(value) ? value : [];
    const [inputValue, setInputValue] = useState('');

    return (
      <div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            padding: '6px 8px',
            border: `1px solid ${C.border2}`,
            background: disabled ? C.surface : C.bg,
            minHeight: 38,
          }}
        >
          {tags.map((tag, index) => (
            <span
              key={index}
              style={{
                padding: '4px 8px',
                background: C.border,
                fontSize: 11,
                color: C.text,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {tag}
              <button
                onClick={() => onChange(tags.filter((_, i) => i !== index))}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: C.text3,
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && inputValue.trim()) {
                e.preventDefault();
                onChange([...tags, inputValue.trim()]);
                setInputValue('');
              }
            }}
            disabled={disabled}
            placeholder={tags.length === 0 ? 'Type and press Enter' : ''}
            style={{
              flex: 1,
              minWidth: 120,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 12,
              color: C.text,
            }}
          />
        </div>
        <div style={{ marginTop: 4, fontSize: 10, color: C.text3 }}>
          Type a value and press Enter to add
        </div>
      </div>
    );
  }

  // in_last_n_days: number input + "days" suffix
  if (operator === 'in_last_n_days') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="number"
          value={value || ''}
          onChange={e => onChange(Number(e.target.value))}
          disabled={disabled}
          placeholder="30"
          style={{
            width: 80,
            padding: '8px 10px',
            border: `1px solid ${C.border2}`,
            background: disabled ? C.surface : C.bg,
            color: C.text,
            fontSize: 12,
          }}
        />
        <span style={{ color: C.text2, fontSize: 12 }}>days</span>
      </div>
    );
  }

  // Date operators: date input
  if (fieldType === 'date' && ['equals', 'before', 'after'].includes(operator)) {
    return (
      <input
        type="date"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '8px 10px',
          border: `1px solid ${C.border2}`,
          background: disabled ? C.surface : C.bg,
          color: C.text,
          fontSize: 12,
        }}
      />
    );
  }

  // Number operators: number input
  if (fieldType === 'number') {
    return (
      <input
        type="number"
        value={value || ''}
        onChange={e => onChange(Number(e.target.value))}
        disabled={disabled}
        placeholder="Enter number..."
        style={{
          width: '100%',
          padding: '8px 10px',
          border: `1px solid ${C.border2}`,
          background: disabled ? C.surface : C.bg,
          color: C.text,
          fontSize: 12,
        }}
      />
    );
  }

  // Default: text input
  return (
    <input
      type="text"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      placeholder="Enter value..."
      style={{
        width: '100%',
        padding: '8px 10px',
        border: `1px solid ${C.border2}`,
        background: disabled ? C.surface : C.bg,
        color: C.text,
        fontSize: 12,
      }}
    />
  );
}
