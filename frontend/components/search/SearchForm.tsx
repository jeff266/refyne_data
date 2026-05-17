'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, FlaskConical } from 'lucide-react';

// Industry taxonomy for the dropdown
const INDUSTRY_TAXONOMY = [
  { value: 'restaurants', label: 'Restaurants' },
  { value: 'retail', label: 'Retail Stores' },
  { value: 'healthcare', label: 'Healthcare & Medical' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'construction', label: 'Construction' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'accounting', label: 'Accounting & Finance' },
  { value: 'technology', label: 'Technology' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'hospitality', label: 'Hospitality & Hotels' },
  { value: 'fitness', label: 'Fitness & Gyms' },
  { value: 'beauty', label: 'Beauty & Salons' },
  { value: 'education', label: 'Education' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'home_services', label: 'Home Services' },
  { value: 'food_beverage', label: 'Food & Beverage' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'transportation', label: 'Transportation & Logistics' },
  { value: 'agriculture', label: 'Agriculture' },
];

const EMPLOYEE_RANGES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1000 employees' },
  { value: '1001+', label: '1001+ employees' },
];

export interface InputField {
  id: string;
  type: 'text' | 'select' | 'slider' | 'textarea' | 'radio';
  label: string;
  placeholder?: string;
  required?: boolean;
  source?: string;
  options?: string[];
  horizontal?: boolean;
  min?: number;
  max?: number;
  default?: string | number;
  height?: number;
  show_when?: Record<string, string>;
}

export interface FormValues {
  [key: string]: string | number;
}

interface SearchFormProps {
  fields: InputField[];
  segmentId: string;
  onSearch: (values: FormValues, sandboxMode: boolean) => Promise<void>;
  loading?: boolean;
  sandboxMode?: boolean;
  onSandboxModeChange?: (enabled: boolean) => void;
}

export default function SearchForm({
  fields,
  segmentId,
  onSearch,
  loading = false,
  sandboxMode = false,
  onSandboxModeChange,
}: SearchFormProps) {
  const [values, setValues] = useState<FormValues>({});

  // Initialize default values
  useEffect(() => {
    const defaults: FormValues = {};
    fields.forEach((field) => {
      if (field.default !== undefined) {
        defaults[field.id] = field.default;
      }
    });
    setValues(defaults);
  }, [fields, segmentId]);

  const handleChange = (fieldId: string, value: string | number) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSearch(values, sandboxMode);
  };

  const shouldShowField = (field: InputField): boolean => {
    if (!field.show_when) return true;
    return Object.entries(field.show_when).every(
      ([key, expectedValue]) => values[key] === expectedValue
    );
  };

  const renderField = (field: InputField) => {
    if (!shouldShowField(field)) return null;

    const baseInputClass =
      'w-full px-4 py-2.5 bg-mplc-white border border-mplc-gray-300 rounded-lg text-sm text-mplc-black placeholder-mplc-gray-400 focus:outline-none focus:ring-2 focus:ring-mplc-black focus:border-transparent transition-colors';

    switch (field.type) {
      case 'text':
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="block text-sm font-medium text-mplc-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={String(values[field.id] || '')}
              onChange={(e) => handleChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              className={baseInputClass}
            />
          </div>
        );

      case 'select':
        const options =
          field.source === 'industry_taxonomy'
            ? INDUSTRY_TAXONOMY
            : field.source === 'employee_range'
            ? EMPLOYEE_RANGES
            : (field.options || []).map((o) => ({ value: o, label: o }));

        return (
          <div key={field.id} className="space-y-1.5">
            <label className="block text-sm font-medium text-mplc-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={String(values[field.id] || '')}
              onChange={(e) => handleChange(field.id, e.target.value)}
              required={field.required}
              className={`${baseInputClass} bg-mplc-white`}
            >
              <option value="">Select {field.label.toLowerCase()}...</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'radio':
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="block text-sm font-medium text-mplc-gray-700">
              {field.label}
            </label>
            <div
              className={`flex ${field.horizontal ? 'flex-row space-x-4' : 'flex-col space-y-2'}`}
            >
              {(field.options || []).map((option) => (
                <label key={option} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name={field.id}
                    value={option}
                    checked={values[field.id] === option}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    className="w-4 h-4 border-mplc-gray-300 text-mplc-black focus:ring-mplc-black"
                  />
                  <span className="text-sm text-mplc-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 'slider':
        const min = field.min || 5;
        const max = field.max || 50;
        const currentValue = Number(values[field.id] || field.default || min);

        return (
          <div key={field.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-mplc-gray-700">
                {field.label}
              </label>
              <span className="text-sm font-medium text-mplc-black bg-mplc-gray-100 px-2 py-0.5 rounded">
                {currentValue}
              </span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              value={currentValue}
              onChange={(e) => handleChange(field.id, Number(e.target.value))}
              className="w-full h-2 bg-mplc-gray-200 rounded-lg appearance-none cursor-pointer accent-mplc-black"
            />
            <div className="flex justify-between text-xs text-mplc-gray-400">
              <span>{min}</span>
              <span>{max}</span>
            </div>
          </div>
        );

      case 'textarea':
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="block text-sm font-medium text-mplc-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={String(values[field.id] || '')}
              onChange={(e) => handleChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              rows={field.height ? Math.ceil(field.height / 24) : 4}
              className={`${baseInputClass} resize-none`}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Sandbox Mode Toggle */}
      {onSandboxModeChange && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <input
            type="checkbox"
            id="sandbox-mode"
            checked={sandboxMode}
            onChange={(e) => onSandboxModeChange(e.target.checked)}
            className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 focus:ring-offset-0"
          />
          <label htmlFor="sandbox-mode" className="flex items-center gap-2 cursor-pointer">
            <FlaskConical className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">Sandbox Mode</span>
          </label>
          <span className="text-amber-600 text-xs ml-auto">Limits to 3 results using sample data</span>
        </div>
      )}

      {fields.map(renderField)}

      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary py-3 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Searching...</span>
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              <span>Search Prospects</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
