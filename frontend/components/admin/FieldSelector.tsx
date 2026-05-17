'use client';

import { useState, useMemo } from 'react';
import { Check, Square, CheckSquare, Search, X } from 'lucide-react';

interface FieldSelectorProps {
  availableFields: string[];
  selectedFields: string[];
  onChange: (fields: string[]) => void;
  disabled?: boolean;
  maxHeight?: string;
}

// Field category mapping for better organization
const FIELD_CATEGORIES: Record<string, string[]> = {
  'Contact Info': ['email', 'phone', 'mobile_phone', 'direct_dial', 'personal_email', 'work_email'],
  'Basic Info': ['first_name', 'last_name', 'full_name', 'title', 'job_title', 'seniority'],
  'Company': ['company_name', 'company_domain', 'company_size', 'industry', 'company_description'],
  'Location': ['city', 'state', 'country', 'address', 'postal_code', 'timezone'],
  'Social': ['linkedin_url', 'twitter_handle', 'github_url', 'facebook_url'],
  'Firmographics': ['employee_count', 'revenue', 'founded_year', 'funding_total', 'company_type'],
  'Technographics': ['technologies', 'tech_stack', 'platforms'],
  'Other': [],
};

function categorizeField(field: string): string {
  const fieldLower = field.toLowerCase();
  for (const [category, fields] of Object.entries(FIELD_CATEGORIES)) {
    if (fields.some((f) => fieldLower.includes(f) || f.includes(fieldLower))) {
      return category;
    }
  }
  return 'Other';
}

export default function FieldSelector({
  availableFields,
  selectedFields,
  onChange,
  disabled = false,
  maxHeight = '200px',
}: FieldSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Contact Info', 'Basic Info']));

  // Group fields by category
  const groupedFields = useMemo(() => {
    const groups: Record<string, string[]> = {};
    availableFields.forEach((field) => {
      const category = categorizeField(field);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(field);
    });
    return groups;
  }, [availableFields]);

  // Filter fields based on search
  const filteredFields = useMemo(() => {
    if (!searchQuery.trim()) return availableFields;
    const query = searchQuery.toLowerCase();
    return availableFields.filter((field) => field.toLowerCase().includes(query));
  }, [availableFields, searchQuery]);

  const allSelected = selectedFields.length === availableFields.length && availableFields.length > 0;
  const someSelected = selectedFields.length > 0 && selectedFields.length < availableFields.length;

  const handleSelectAll = () => {
    if (disabled) return;
    if (allSelected) {
      onChange([]);
    } else {
      onChange([...availableFields]);
    }
  };

  const handleClear = () => {
    if (disabled) return;
    onChange([]);
  };

  const handleToggleField = (field: string) => {
    if (disabled) return;
    if (selectedFields.includes(field)) {
      onChange(selectedFields.filter((f) => f !== field));
    } else {
      onChange([...selectedFields, field]);
    }
  };

  const handleToggleCategory = (category: string, fields: string[]) => {
    if (disabled) return;
    const allCategorySelected = fields.every((f) => selectedFields.includes(f));
    if (allCategorySelected) {
      onChange(selectedFields.filter((f) => !fields.includes(f)));
    } else {
      const newFields = Array.from(new Set([...selectedFields, ...fields]));
      onChange(newFields);
    }
  };

  const toggleCategoryExpand = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const formatFieldName = (field: string): string => {
    return field
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-mplc-gray-500">
          Fields to Pull ({selectedFields.length} of {availableFields.length})
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={disabled}
            className="text-xs text-mplc-gray-600 hover:text-mplc-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
          {selectedFields.length > 0 && (
            <>
              <span className="text-mplc-gray-300">|</span>
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled}
                className="text-xs text-mplc-gray-600 hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search Input */}
      {availableFields.length > 8 && (
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mplc-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search fields..."
            disabled={disabled}
            className="w-full pl-8 pr-8 py-1.5 text-sm border border-mplc-gray-200 rounded-md bg-mplc-white focus:outline-none focus:ring-2 focus:ring-mplc-black focus:border-transparent disabled:bg-mplc-gray-50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mplc-gray-400 hover:text-mplc-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Fields List */}
      <div
        className="border border-mplc-gray-200 rounded-lg overflow-y-auto bg-mplc-white"
        style={{ maxHeight }}
      >
        {searchQuery ? (
          // Flat list when searching
          <div className="p-1">
            {filteredFields.length === 0 ? (
              <div className="px-3 py-4 text-sm text-mplc-gray-500 text-center">
                No fields match "{searchQuery}"
              </div>
            ) : (
              filteredFields.map((field) => (
                <FieldItem
                  key={field}
                  field={field}
                  label={formatFieldName(field)}
                  isSelected={selectedFields.includes(field)}
                  onToggle={() => handleToggleField(field)}
                  disabled={disabled}
                />
              ))
            )}
          </div>
        ) : (
          // Grouped list
          <div className="divide-y divide-mplc-gray-100">
            {Object.entries(groupedFields).map(([category, fields]) => {
              if (fields.length === 0) return null;
              const isExpanded = expandedCategories.has(category);
              const allCategorySelected = fields.every((f) => selectedFields.includes(f));
              const someCategorySelected = fields.some((f) => selectedFields.includes(f)) && !allCategorySelected;
              const selectedInCategory = fields.filter((f) => selectedFields.includes(f)).length;

              return (
                <div key={category}>
                  {/* Category Header */}
                  <button
                    type="button"
                    onClick={() => toggleCategoryExpand(category)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-mplc-gray-50 hover:bg-mplc-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleCategory(category, fields);
                        }}
                        disabled={disabled}
                        className="text-mplc-gray-600 hover:text-mplc-black disabled:opacity-50"
                      >
                        {allCategorySelected ? (
                          <CheckSquare size={16} className="text-mplc-black" />
                        ) : someCategorySelected ? (
                          <div className="w-4 h-4 border-2 border-mplc-gray-400 rounded flex items-center justify-center">
                            <div className="w-2 h-2 bg-mplc-gray-400 rounded-sm" />
                          </div>
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                      <span className="text-xs font-semibold text-mplc-gray-700">{category}</span>
                    </div>
                    <span className="text-xs text-mplc-gray-500">
                      {selectedInCategory}/{fields.length}
                    </span>
                  </button>

                  {/* Category Fields */}
                  {isExpanded && (
                    <div className="px-1 py-1">
                      {fields.map((field) => (
                        <FieldItem
                          key={field}
                          field={field}
                          label={formatFieldName(field)}
                          isSelected={selectedFields.includes(field)}
                          onToggle={() => handleToggleField(field)}
                          disabled={disabled}
                          indented
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Fields Preview */}
      {selectedFields.length > 0 && selectedFields.length <= 5 && (
        <div className="flex flex-wrap gap-1">
          {selectedFields.map((field) => (
            <span
              key={field}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-mplc-gray-100 text-mplc-gray-700 text-xs rounded-full"
            >
              {formatFieldName(field)}
              <button
                type="button"
                onClick={() => handleToggleField(field)}
                disabled={disabled}
                className="hover:text-red-500 disabled:opacity-50"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface FieldItemProps {
  field: string;
  label: string;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  indented?: boolean;
}

function FieldItem({ field, label, isSelected, onToggle, disabled, indented }: FieldItemProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
        indented ? 'ml-4' : ''
      } ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-mplc-gray-50 cursor-pointer'
      }`}
    >
      <div
        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
          isSelected
            ? 'bg-mplc-black border-mplc-black'
            : 'border-mplc-gray-300 bg-mplc-white'
        }`}
      >
        {isSelected && <Check size={12} className="text-mplc-white" />}
      </div>
      <span className={`text-sm ${isSelected ? 'text-mplc-black font-medium' : 'text-mplc-gray-700'}`}>
        {label}
      </span>
      <span className="text-xs text-mplc-gray-400 font-mono ml-auto">{field}</span>
    </button>
  );
}
