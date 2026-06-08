'use client';

/**
 * FilterStep Component
 *
 * Step 2 of import wizard - Filter rows before import
 * Shows column-based filters with counts for non-identity fields
 */

import { useState, useMemo } from 'react';
import { ArrowRight, ArrowLeft, Search, X } from 'lucide-react';

interface Column {
  name: string;
  type: string;
  sample_values: string[];
}

interface FilterStepProps {
  columns: Column[];
  previewRows: any[];
  totalRows: number;
  filters: Record<string, any>;
  onFiltersChange: (filters: Record<string, any>) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function FilterStep({
  columns,
  previewRows,
  totalRows,
  filters,
  onFiltersChange,
  onBack,
  onContinue,
}: FilterStepProps) {
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});

  // Get filterable columns (exclude identity columns)
  const filterableColumns = useMemo(() => {
    const identityTypes = ['email', 'linkedin', 'name'];
    return columns.filter((col) => !identityTypes.includes(col.type));
  }, [columns]);

  // Calculate value counts for each filterable column
  const columnValueCounts = useMemo(() => {
    const counts: Record<string, Record<string, number>> = {};

    filterableColumns.forEach((col) => {
      counts[col.name] = {};
      previewRows.forEach((row) => {
        const value = row[col.name];
        if (value && typeof value === 'string' && value.trim() !== '') {
          counts[col.name][value] = (counts[col.name][value] || 0) + 1;
        }
      });
    });

    return counts;
  }, [filterableColumns, previewRows]);

  // Get unique values for a column, sorted by count
  const getColumnValues = (columnName: string) => {
    const counts = columnValueCounts[columnName] || {};
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .map(([value, count]) => ({ value, count }));
  };

  // Toggle filter value
  const toggleFilterValue = (columnName: string, value: string) => {
    const currentFilters = filters[columnName] || [];
    const newFilters = currentFilters.includes(value)
      ? currentFilters.filter((v: string) => v !== value)
      : [...currentFilters, value];

    onFiltersChange({
      ...filters,
      [columnName]: newFilters.length > 0 ? newFilters : undefined,
    });
  };

  // Clear all filters for a column
  const clearColumnFilter = (columnName: string) => {
    const newFilters = { ...filters };
    delete newFilters[columnName];
    onFiltersChange(newFilters);
  };

  // Calculate filtered row count
  const filteredCount = useMemo(() => {
    if (Object.keys(filters).length === 0) return totalRows;

    let count = 0;
    previewRows.forEach((row) => {
      let matches = true;
      for (const [columnName, selectedValues] of Object.entries(filters)) {
        if (Array.isArray(selectedValues) && selectedValues.length > 0) {
          if (!selectedValues.includes(row[columnName])) {
            matches = false;
            break;
          }
        }
      }
      if (matches) count++;
    });

    return count;
  }, [filters, previewRows, totalRows]);

  return (
    <div>
      <h2 className="text-lg font-medium text-white mb-4">
        Step 2: Filter Rows (Optional)
      </h2>
      <p className="text-zinc-400 mb-6">
        Apply filters to narrow down which rows to import. Skip to import all rows.
      </p>

      {/* Row count */}
      <div className="mb-6 p-4 bg-zinc-800 border border-zinc-700 rounded-lg">
        <div className="text-2xl font-semibold text-white mb-1">
          {filteredCount.toLocaleString()}
        </div>
        <div className="text-sm text-zinc-400">
          contacts loaded {Object.keys(filters).length > 0 && `(${totalRows.toLocaleString()} total)`}
        </div>
      </div>

      {/* Filter controls */}
      {filterableColumns.length > 0 ? (
        <div className="space-y-6 mb-6">
          {filterableColumns.map((column) => {
            const values = getColumnValues(column.name);
            const selectedValues = filters[column.name] || [];
            const searchTerm = searchTerms[column.name] || '';
            const filteredValues = searchTerm
              ? values.filter((v) =>
                  v.value.toLowerCase().includes(searchTerm.toLowerCase())
                )
              : values;

            return (
              <div
                key={column.name}
                className="p-4 bg-zinc-800 border border-zinc-700 rounded-lg"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-white capitalize">
                    {column.name.replace(/_/g, ' ')}
                  </h3>
                  {selectedValues.length > 0 && (
                    <button
                      onClick={() => clearColumnFilter(column.name)}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Search box for company/title */}
                {(column.type === 'company' || column.type === 'title') && (
                  <div className="mb-3 relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) =>
                        setSearchTerms({
                          ...searchTerms,
                          [column.name]: e.target.value,
                        })
                      }
                      placeholder="Search..."
                      className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white placeholder-zinc-500"
                    />
                    {searchTerm && (
                      <button
                        onClick={() =>
                          setSearchTerms({ ...searchTerms, [column.name]: '' })
                        }
                        className="absolute right-3 top-2.5"
                      >
                        <X className="w-4 h-4 text-zinc-400 hover:text-zinc-300" />
                      </button>
                    )}
                  </div>
                )}

                {/* Value checkboxes */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredValues.length > 0 ? (
                    filteredValues.map(({ value, count }) => (
                      <label
                        key={value}
                        className="flex items-center gap-2 cursor-pointer hover:bg-zinc-700/50 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedValues.includes(value)}
                          onChange={() => toggleFilterValue(column.name, value)}
                          className="w-4 h-4 rounded border-zinc-600 bg-zinc-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                        />
                        <span className="flex-1 text-sm text-white truncate">
                          {value}
                        </span>
                        <span className="text-xs text-zinc-400 tabular-nums">
                          ({count})
                        </span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500 py-2">No values found</p>
                  )}
                </div>

                {/* Show count if search is active */}
                {searchTerm && (
                  <div className="mt-2 text-xs text-zinc-500">
                    Showing {filteredValues.length} of {values.length} values
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mb-6 p-4 bg-zinc-800 border border-zinc-700 rounded-lg">
          <p className="text-sm text-zinc-400">
            No filterable columns detected. All columns are identity fields (email, name, LinkedIn).
          </p>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={onContinue}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
