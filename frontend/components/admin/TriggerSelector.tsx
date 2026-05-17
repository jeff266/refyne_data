'use client';

import { useState } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';
import type { CascadeTrigger } from '@/types';

interface TriggerConfig {
  field?: string;
  operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';
  value?: string | number;
}

interface TriggerSelectorProps {
  trigger: CascadeTrigger;
  triggerConfig: TriggerConfig;
  availableFields: string[];
  onChange: (trigger: CascadeTrigger, config: TriggerConfig) => void;
  disabled?: boolean;
}

const TRIGGER_OPTIONS: { value: CascadeTrigger; label: string; description: string; needsConfig: boolean }[] = [
  { value: 'always', label: 'Always', description: 'Run this provider every time', needsConfig: false },
  { value: 'on_error', label: 'On Error', description: 'Run if previous provider fails', needsConfig: false },
  { value: 'on_empty', label: 'On Empty', description: 'Run if previous provider returns empty', needsConfig: false },
  { value: 'on_missing_field', label: 'On Missing Field', description: 'Run if a specific field is missing', needsConfig: true },
  { value: 'on_field_present', label: 'On Field Present', description: 'Run if a specific field exists', needsConfig: true },
  { value: 'on_condition', label: 'On Condition', description: 'Run based on field value condition', needsConfig: true },
];

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'exists', label: 'Exists' },
  { value: 'not_exists', label: 'Not Exists' },
];

export default function TriggerSelector({
  trigger,
  triggerConfig,
  availableFields,
  onChange,
  disabled = false,
}: TriggerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedTrigger = TRIGGER_OPTIONS.find((t) => t.value === trigger);
  const needsFieldConfig = trigger === 'on_missing_field' || trigger === 'on_field_present';
  const needsConditionConfig = trigger === 'on_condition';

  const handleTriggerChange = (newTrigger: CascadeTrigger) => {
    const option = TRIGGER_OPTIONS.find((t) => t.value === newTrigger);
    if (option?.needsConfig) {
      onChange(newTrigger, { field: availableFields[0] || '', operator: 'equals', value: '' });
    } else {
      onChange(newTrigger, {});
    }
    setIsOpen(false);
  };

  const handleFieldChange = (field: string) => {
    onChange(trigger, { ...triggerConfig, field });
  };

  const handleOperatorChange = (operator: TriggerConfig['operator']) => {
    onChange(trigger, { ...triggerConfig, operator });
  };

  const handleValueChange = (value: string) => {
    onChange(trigger, { ...triggerConfig, value });
  };

  return (
    <div className="space-y-3">
      {/* Trigger Dropdown */}
      <div>
        <label className="block text-xs font-medium text-mplc-gray-500 mb-1.5">
          Trigger Condition
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className={`w-full flex items-center justify-between px-3 py-2 bg-mplc-white border rounded-lg text-sm text-left transition-colors ${
              disabled
                ? 'border-mplc-gray-200 bg-mplc-gray-50 cursor-not-allowed text-mplc-gray-400'
                : 'border-mplc-gray-300 hover:border-mplc-gray-400 cursor-pointer'
            }`}
          >
            <div>
              <span className="font-medium text-mplc-black">{selectedTrigger?.label}</span>
              <span className="ml-2 text-mplc-gray-500">{selectedTrigger?.description}</span>
            </div>
            <ChevronDown
              size={16}
              className={`text-mplc-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isOpen && (
            <div className="absolute z-20 w-full mt-1 bg-mplc-white border border-mplc-gray-200 rounded-lg shadow-lg overflow-hidden">
              {TRIGGER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleTriggerChange(option.value)}
                  className={`w-full flex flex-col px-3 py-2.5 text-left hover:bg-mplc-gray-50 transition-colors ${
                    option.value === trigger ? 'bg-mplc-gray-50' : ''
                  }`}
                >
                  <span className="font-medium text-sm text-mplc-black">{option.label}</span>
                  <span className="text-xs text-mplc-gray-500">{option.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Field Selector for on_missing_field and on_field_present */}
      {needsFieldConfig && (
        <div>
          <label className="block text-xs font-medium text-mplc-gray-500 mb-1.5">
            Target Field
          </label>
          <select
            value={triggerConfig.field || ''}
            onChange={(e) => handleFieldChange(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 border border-mplc-gray-300 rounded-lg text-sm bg-mplc-white focus:outline-none focus:ring-2 focus:ring-mplc-black focus:border-transparent disabled:bg-mplc-gray-50 disabled:cursor-not-allowed"
          >
            {availableFields.length === 0 ? (
              <option value="">No fields available</option>
            ) : (
              availableFields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))
            )}
          </select>
        </div>
      )}

      {/* Condition Config for on_condition */}
      {needsConditionConfig && (
        <div className="space-y-3 p-3 bg-mplc-gray-50 rounded-lg border border-mplc-gray-200">
          <div className="flex items-center gap-2 text-xs text-mplc-gray-600 mb-2">
            <AlertCircle size={14} />
            <span>Configure the condition that must be met</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Field */}
            <div>
              <label className="block text-xs font-medium text-mplc-gray-500 mb-1">Field</label>
              <select
                value={triggerConfig.field || ''}
                onChange={(e) => handleFieldChange(e.target.value)}
                disabled={disabled}
                className="w-full px-2 py-1.5 border border-mplc-gray-300 rounded-md text-sm bg-mplc-white focus:outline-none focus:ring-2 focus:ring-mplc-black focus:border-transparent"
              >
                {availableFields.length === 0 ? (
                  <option value="">No fields</option>
                ) : (
                  availableFields.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Operator */}
            <div>
              <label className="block text-xs font-medium text-mplc-gray-500 mb-1">Operator</label>
              <select
                value={triggerConfig.operator || 'equals'}
                onChange={(e) => handleOperatorChange(e.target.value as TriggerConfig['operator'])}
                disabled={disabled}
                className="w-full px-2 py-1.5 border border-mplc-gray-300 rounded-md text-sm bg-mplc-white focus:outline-none focus:ring-2 focus:ring-mplc-black focus:border-transparent"
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Value */}
            <div>
              <label className="block text-xs font-medium text-mplc-gray-500 mb-1">Value</label>
              <input
                type="text"
                value={triggerConfig.value || ''}
                onChange={(e) => handleValueChange(e.target.value)}
                disabled={disabled || triggerConfig.operator === 'exists' || triggerConfig.operator === 'not_exists'}
                placeholder="Enter value"
                className="w-full px-2 py-1.5 border border-mplc-gray-300 rounded-md text-sm bg-mplc-white focus:outline-none focus:ring-2 focus:ring-mplc-black focus:border-transparent disabled:bg-mplc-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
