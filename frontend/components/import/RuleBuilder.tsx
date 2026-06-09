'use client';

/**
 * RuleBuilder Component
 *
 * Visual rule builder for owner assignment with drag-and-drop reordering
 */

import { useState } from 'react';
import { Plus, X, GripVertical } from 'lucide-react';
import type {
  AssignmentRule,
  RuleCondition,
  RuleField,
  RuleOperator,
} from '@/lib/import/rule-types';
import {
  FIELD_LABELS,
  FIELD_OPERATORS,
  OPERATOR_LABELS,
  JOB_TITLE_LEVELS,
  BUCKET_OPTIONS,
} from '@/lib/import/rule-types';

interface RuleBuilderProps {
  rules: AssignmentRule[];
  owners: Array<{ id: string; name: string; email: string | null }>;
  onChange: (rules: AssignmentRule[]) => void;
}

export function RuleBuilder({ rules, owners, onChange }: RuleBuilderProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const addRule = () => {
    const newRule: AssignmentRule = {
      id: crypto.randomUUID(),
      conditions: [
        {
          field: 'job_title_level',
          operator: 'is_one_of',
          values: [],
        },
      ],
      owner_id: '',
      owner_name: '',
      priority: rules.length + 1,
    };
    onChange([...rules, newRule]);
  };

  const removeRule = (ruleId: string) => {
    const filtered = rules.filter((r) => r.id !== ruleId);
    // Reindex priorities
    const reindexed = filtered.map((r, i) => ({ ...r, priority: i + 1 }));
    onChange(reindexed);
  };

  const updateRule = (ruleId: string, updates: Partial<AssignmentRule>) => {
    onChange(
      rules.map((r) => {
        if (r.id === ruleId) {
          // If owner_id changed, update owner_name too
          if (updates.owner_id !== undefined) {
            const owner = owners.find((o) => o.id === updates.owner_id);
            return {
              ...r,
              ...updates,
              owner_name: owner ? owner.name : '',
            };
          }
          return { ...r, ...updates };
        }
        return r;
      })
    );
  };

  const addCondition = (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;

    const newCondition: RuleCondition = {
      field: 'job_title_level',
      operator: 'is_one_of',
      values: [],
    };

    updateRule(ruleId, {
      conditions: [...rule.conditions, newCondition],
    });
  };

  const removeCondition = (ruleId: string, conditionIndex: number) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;

    const conditions = rule.conditions.filter((_, i) => i !== conditionIndex);
    updateRule(ruleId, { conditions });
  };

  const updateCondition = (
    ruleId: string,
    conditionIndex: number,
    updates: Partial<RuleCondition>
  ) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;

    const conditions = rule.conditions.map((c, i) => {
      if (i === conditionIndex) {
        const newCondition = { ...c, ...updates };
        // Reset values and operator when field changes
        if (updates.field !== undefined && updates.field !== c.field) {
          newCondition.values = [];
          newCondition.operator = FIELD_OPERATORS[updates.field][0];
        }
        return newCondition;
      }
      return c;
    });

    updateRule(ruleId, { conditions });
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newRules = [...rules];
    const [removed] = newRules.splice(draggedIndex, 1);
    newRules.splice(index, 0, removed);

    // Reindex priorities
    const reindexed = newRules.map((r, i) => ({ ...r, priority: i + 1 }));
    onChange(reindexed);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-zinc-400">
          Rules are evaluated in order. First match wins.
        </div>
      </div>

      {rules.length === 0 && (
        <div className="text-sm text-zinc-500 mb-4">
          No rules defined. All contacts will use fallback assignment.
        </div>
      )}

      {/* Rule rows */}
      <div className="space-y-3 mb-4">
        {rules.map((rule, ruleIndex) => (
          <div
            key={rule.id}
            draggable
            onDragStart={() => handleDragStart(ruleIndex)}
            onDragOver={(e) => handleDragOver(e, ruleIndex)}
            onDragEnd={handleDragEnd}
            className="p-4 bg-zinc-900 border border-zinc-700"
          >
            {/* Rule header */}
            <div className="flex items-center gap-3 mb-3">
              <GripVertical className="w-4 h-4 text-zinc-600 cursor-move" />
              <div className="flex-1 text-sm font-medium text-white">
                Rule {rule.priority}
              </div>
              <select
                value={rule.owner_id}
                onChange={(e) => updateRule(rule.id, { owner_id: e.target.value })}
                className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-white text-sm"
              >
                <option value="">Select owner...</option>
                {owners.filter((o) => o.id !== '').map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name} {owner.email ? `(${owner.email})` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeRule(rule.id)}
                className="p-1.5 text-zinc-400 hover:text-red-400 transition-colors"
                title="Remove rule"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conditions */}
            <div className="space-y-2">
              {rule.conditions.map((condition, conditionIndex) => (
                <ConditionRow
                  key={conditionIndex}
                  condition={condition}
                  showRemove={rule.conditions.length > 1}
                  prefix={conditionIndex === 0 ? 'IF' : 'AND'}
                  onUpdate={(updates) => updateCondition(rule.id, conditionIndex, updates)}
                  onRemove={() => removeCondition(rule.id, conditionIndex)}
                />
              ))}
            </div>

            {/* Add condition button */}
            <button
              onClick={() => addCondition(rule.id)}
              className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm border border-zinc-700 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add condition
            </button>
          </div>
        ))}
      </div>

      {/* Add rule button */}
      <button
        onClick={addRule}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm border border-zinc-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add rule
      </button>
    </div>
  );
}

interface ConditionRowProps {
  condition: RuleCondition;
  showRemove: boolean;
  prefix: string;
  onUpdate: (updates: Partial<RuleCondition>) => void;
  onRemove: () => void;
}

function ConditionRow({ condition, showRemove, prefix, onUpdate, onRemove }: ConditionRowProps) {
  const addValue = (value: string) => {
    if (value && !condition.values.includes(value)) {
      onUpdate({ values: [...condition.values, value] });
    }
  };

  const removeValue = (value: string) => {
    onUpdate({ values: condition.values.filter((v) => v !== value) });
  };

  return (
    <div className="flex items-start gap-2">
      <div className="text-xs font-medium text-zinc-500 pt-2 w-10">{prefix}</div>

      {/* Field selector */}
      <select
        value={condition.field}
        onChange={(e) => onUpdate({ field: e.target.value as RuleField })}
        className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-white text-sm"
      >
        <optgroup label="Contact info">
          <option value="job_title_level">Job title level</option>
          <option value="job_title_contains">Job title contains</option>
          <option value="email_domain">Email domain</option>
          <option value="location_contains">Location contains</option>
        </optgroup>
        <optgroup label="Import data">
          <option value="bucket">Bucket</option>
          <option value="company_name">Company name</option>
        </optgroup>
      </select>

      {/* Operator selector */}
      <select
        value={condition.operator}
        onChange={(e) => onUpdate({ operator: e.target.value as RuleOperator })}
        className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-white text-sm"
      >
        {FIELD_OPERATORS[condition.field].map((op) => (
          <option key={op} value={op}>
            {OPERATOR_LABELS[op]}
          </option>
        ))}
      </select>

      {/* Value input */}
      <div className="flex-1">
        <ValueInput
          field={condition.field}
          values={condition.values}
          onAdd={addValue}
          onRemove={removeValue}
        />
      </div>

      {/* Remove button */}
      {showRemove && (
        <button
          onClick={onRemove}
          className="p-1.5 text-zinc-400 hover:text-red-400 transition-colors"
          title="Remove condition"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

interface ValueInputProps {
  field: RuleField;
  values: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}

function ValueInput({ field, values, onAdd, onRemove }: ValueInputProps) {
  const [textInput, setTextInput] = useState('');

  // Multi-select pill picker for job_title_level and bucket
  if (field === 'job_title_level') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {JOB_TITLE_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => {
              if (values.includes(level)) {
                onRemove(level);
              } else {
                onAdd(level);
              }
            }}
            className={`px-2 py-1 text-xs transition-colors ${
              values.includes(level)
                ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
            }`}
          >
            {level}
          </button>
        ))}
      </div>
    );
  }

  if (field === 'bucket') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {BUCKET_OPTIONS.map((bucket) => (
          <button
            key={bucket}
            onClick={() => {
              if (values.includes(bucket)) {
                onRemove(bucket);
              } else {
                onAdd(bucket);
              }
            }}
            className={`px-2 py-1 text-xs transition-colors ${
              values.includes(bucket)
                ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
            }`}
          >
            {bucket}
          </button>
        ))}
      </div>
    );
  }

  // Tag input for email_domain and other text fields
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <div
            key={value}
            className="flex items-center gap-1 px-2 py-1 bg-zinc-800 border border-zinc-700 text-xs text-white"
          >
            <span>{value}</span>
            <button
              onClick={() => onRemove(value)}
              className="text-zinc-400 hover:text-red-400"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <input
        type="text"
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && textInput.trim()) {
            e.preventDefault();
            onAdd(textInput.trim());
            setTextInput('');
          }
        }}
        placeholder={`Enter ${FIELD_LABELS[field].toLowerCase()} and press Enter`}
        className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-white text-sm placeholder-zinc-500"
      />
    </div>
  );
}
