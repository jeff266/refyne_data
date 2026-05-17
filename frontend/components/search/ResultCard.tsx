'use client';

import { Building2, MapPin, Phone, Globe, Star, Check } from 'lucide-react';

export interface SearchResultItem {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  website?: string;
  industry?: string;
  rating?: number;
  reviewCount?: number;
  provider: string;
  inSalesforce?: boolean;
}

interface ResultCardProps {
  result: SearchResultItem;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  sandboxMode?: boolean;
}

const providerStyles: Record<string, string> = {
  serper: 'bg-blue-50 text-blue-700 border-blue-200',
  apollo: 'bg-purple-50 text-purple-700 border-purple-200',
  zoominfo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  graphiq: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  clay: 'bg-orange-50 text-orange-700 border-orange-200',
  default: 'bg-gray-50 text-gray-700 border-gray-200',
};

const providerLabels: Record<string, string> = {
  serper: 'Serper',
  apollo: 'Apollo',
  zoominfo: 'ZoomInfo',
  graphiq: 'GraphiqAI',
  clay: 'Clay',
};

export default function ResultCard({ result, selected, onSelect, sandboxMode = false }: ResultCardProps) {
  const location = [result.city, result.state].filter(Boolean).join(', ');
  const providerStyle = providerStyles[result.provider] || providerStyles.default;
  const providerLabel = providerLabels[result.provider] || result.provider;

  return (
    <div
      className={`card p-4 transition-all duration-150 relative ${
        sandboxMode ? 'bg-amber-50/30 border-amber-200' : ''
      } ${
        selected
          ? 'ring-2 ring-mplc-black border-mplc-black'
          : sandboxMode
            ? 'hover:shadow-mplc-lg hover:border-amber-300'
            : 'hover:shadow-mplc-lg hover:border-mplc-gray-300'
      }`}
    >
      {/* Sample Data Badge for Sandbox Mode */}
      {sandboxMode && (
        <div className="absolute -top-2 -right-2 z-10">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-400 text-amber-900 shadow-sm">
            SAMPLE DATA
          </span>
        </div>
      )}
      {/* Header with checkbox */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          <label className="flex items-center cursor-pointer mt-0.5">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelect(result.id, e.target.checked)}
              className="w-4 h-4 rounded border-mplc-gray-300 text-mplc-black focus:ring-mplc-black focus:ring-offset-0"
            />
          </label>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-mplc-black truncate">
                {result.name}
              </h3>
              {result.inSalesforce && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200 whitespace-nowrap">
                  <Check className="w-3 h-3 mr-1" />
                  In Salesforce
                </span>
              )}
            </div>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap ml-2 ${providerStyle}`}
        >
          {providerLabel}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-2 pl-7">
        {/* Location/Address */}
        {(result.address || location) && (
          <div className="flex items-start space-x-2 text-sm text-mplc-gray-600">
            <MapPin className="w-4 h-4 text-mplc-gray-400 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-2">
              {result.address && <span>{result.address}</span>}
              {result.address && location && <span>, </span>}
              {location && <span>{location}</span>}
            </span>
          </div>
        )}

        {/* Phone */}
        {result.phone && (
          <div className="flex items-center space-x-2 text-sm text-mplc-gray-600">
            <Phone className="w-4 h-4 text-mplc-gray-400 flex-shrink-0" />
            <a
              href={`tel:${result.phone}`}
              className="hover:text-mplc-black hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {result.phone}
            </a>
          </div>
        )}

        {/* Website */}
        {result.website && (
          <div className="flex items-center space-x-2 text-sm text-mplc-gray-600">
            <Globe className="w-4 h-4 text-mplc-gray-400 flex-shrink-0" />
            <a
              href={result.website.startsWith('http') ? result.website : `https://${result.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-mplc-black hover:underline truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {result.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          </div>
        )}

        {/* Industry & Rating row */}
        <div className="flex items-center justify-between pt-2">
          {result.industry && (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-mplc-gray-100 text-mplc-gray-700 text-xs font-medium">
              <Building2 className="w-3 h-3 mr-1" />
              {result.industry}
            </span>
          )}

          {result.rating && (
            <div className="flex items-center space-x-1 text-sm">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="font-medium text-mplc-gray-700">{result.rating.toFixed(1)}</span>
              {result.reviewCount && (
                <span className="text-mplc-gray-400">({result.reviewCount})</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
