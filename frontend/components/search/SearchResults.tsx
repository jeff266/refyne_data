'use client';

import { Building2, FlaskConical, Info } from 'lucide-react';
import ResultCard, { SearchResultItem } from './ResultCard';
import SandboxBanner from './SandboxBanner';
import ProviderAttribution from './ProviderAttribution';

interface SearchResultsProps {
  results: SearchResultItem[];
  selectedIds: Set<string>;
  onSelectResult: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  loading?: boolean;
  sandboxMode?: boolean;
}

export default function SearchResults({
  results,
  selectedIds,
  onSelectResult,
  onSelectAll,
  loading = false,
  sandboxMode = false,
}: SearchResultsProps) {
  const allSelected = results.length > 0 && results.every((r) => selectedIds.has(r.id));
  const someSelected = results.some((r) => selectedIds.has(r.id)) && !allSelected;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="flex items-start space-x-3 mb-3">
              <div className="w-4 h-4 bg-mplc-gray-200 rounded" />
              <div className="flex-1">
                <div className="h-5 bg-mplc-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-mplc-gray-100 rounded w-1/2" />
              </div>
            </div>
            <div className="pl-7 space-y-2">
              <div className="h-4 bg-mplc-gray-100 rounded w-full" />
              <div className="h-4 bg-mplc-gray-100 rounded w-2/3" />
              <div className="h-4 bg-mplc-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="w-16 h-16 bg-mplc-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-mplc-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-mplc-black mb-2">
          No results yet
        </h3>
        <p className="text-mplc-gray-500 max-w-md mx-auto">
          Configure your search criteria above and click &quot;Search&quot; to find prospects.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Sandbox Mode Banner */}
      <SandboxBanner enabled={sandboxMode} resultCount={results.length} />

      {/* Sandbox Mode Info Message */}
      {sandboxMode && results.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700">
            <p className="font-medium">This is test data</p>
            <p className="text-amber-600">
              Results shown are sample records for testing your workflow. Disable Sandbox Mode to search real data.
            </p>
          </div>
        </div>
      )}

      {/* Select All Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-mplc-gray-200">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={(e) => onSelectAll(e.target.checked)}
            className="w-4 h-4 rounded border-mplc-gray-300 text-mplc-black focus:ring-mplc-black focus:ring-offset-0"
          />
          <span className="text-sm font-medium text-mplc-gray-700">
            Select all ({results.length} results)
          </span>
        </label>
        <span className="text-sm text-mplc-gray-500">
          {selectedIds.size} selected
        </span>
      </div>

      {/* Results Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${sandboxMode ? 'relative' : ''}`}>
        {results.map((result) => (
          <ResultCard
            key={result.id}
            result={result}
            selected={selectedIds.has(result.id)}
            onSelect={onSelectResult}
            sandboxMode={sandboxMode}
          />
        ))}
      </div>

      {/* Provider Attribution */}
      {results.length > 0 && (
        <ProviderAttribution
          providers={Array.from(new Set(results.map((r) => r.provider)))}
        />
      )}
    </div>
  );
}
