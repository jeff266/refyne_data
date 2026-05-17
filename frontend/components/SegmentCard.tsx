'use client';

import Link from 'next/link';
import { Layers, Users, Database, ChevronRight, MoreVertical } from 'lucide-react';
import type { Segment, ProviderType } from '@/types';

interface SegmentCardProps {
  segment: Segment;
  onEdit?: (segment: Segment) => void;
  onDelete?: (segment: Segment) => void;
}

const providerColors: Record<ProviderType, string> = {
  apollo: 'bg-blue-50 text-blue-700 border-blue-200',
  zoominfo: 'bg-purple-50 text-purple-700 border-purple-200',
  clearbit: 'bg-green-50 text-green-700 border-green-200',
  lusha: 'bg-orange-50 text-orange-700 border-orange-200',
  manual: 'bg-gray-50 text-gray-700 border-gray-200',
};

const providerLabels: Record<ProviderType, string> = {
  apollo: 'Apollo',
  zoominfo: 'ZoomInfo',
  clearbit: 'Clearbit',
  lusha: 'Lusha',
  manual: 'Manual',
};

const statusStyles: Record<string, string> = {
  active: 'badge-success',
  inactive: 'badge-default',
  draft: 'badge-warning',
};

export default function SegmentCard({ segment, onEdit, onDelete }: SegmentCardProps) {
  const enabledProviders = segment.providerStack.filter((p) => p.enabled);
  const primaryProvider = enabledProviders[0];

  return (
    <Link href={`/segments/${segment.id}`}>
      <div className="card-hover p-5 group">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-mplc-gray-100 rounded-lg flex items-center justify-center">
              <Layers className="w-5 h-5 text-mplc-gray-600" />
            </div>
            <div>
              <h3 className="font-semibold text-mplc-black group-hover:underline">
                {segment.name}
              </h3>
              <span className={statusStyles[segment.status]}>
                {segment.status.charAt(0).toUpperCase() + segment.status.slice(1)}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Menu logic here
            }}
            className="p-1 text-mplc-gray-400 hover:text-mplc-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        {segment.description && (
          <p className="text-sm text-mplc-gray-500 mb-4 line-clamp-2">
            {segment.description}
          </p>
        )}

        {/* Stats Row */}
        <div className="flex items-center space-x-4 text-sm mb-4">
          <div className="flex items-center space-x-1.5 text-mplc-gray-500">
            <Users className="w-4 h-4" />
            <span>{segment.matchCount?.toLocaleString() || 0} matches</span>
          </div>
          <div className="flex items-center space-x-1.5 text-mplc-gray-500">
            <Database className="w-4 h-4" />
            <span>{enabledProviders.length} provider{enabledProviders.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Provider Stack Preview */}
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {enabledProviders.slice(0, 3).map((config, index) => {
              const providerType = config.providerId as ProviderType;
              return (
                <span
                  key={config.providerId}
                  className={`px-2 py-0.5 text-xs font-medium rounded border ${providerColors[providerType] || providerColors.manual}`}
                >
                  {index + 1}. {providerLabels[providerType] || config.providerId}
                </span>
              );
            })}
            {enabledProviders.length > 3 && (
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-mplc-gray-100 text-mplc-gray-500">
                +{enabledProviders.length - 3} more
              </span>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-mplc-gray-400 group-hover:text-mplc-black transition-colors" />
        </div>

        {/* Criteria Preview */}
        {segment.criteria.length > 0 && (
          <div className="mt-4 pt-4 border-t border-mplc-gray-100">
            <p className="text-xs text-mplc-gray-400 mb-2">Criteria</p>
            <div className="flex flex-wrap gap-1.5">
              {segment.criteria.slice(0, 2).map((criterion, index) => (
                <span
                  key={index}
                  className="px-2 py-0.5 text-xs bg-mplc-gray-50 text-mplc-gray-600 rounded font-mono"
                >
                  {criterion.field} {criterion.operator} &quot;{String(criterion.value)}&quot;
                </span>
              ))}
              {segment.criteria.length > 2 && (
                <span className="px-2 py-0.5 text-xs text-mplc-gray-400">
                  +{segment.criteria.length - 2} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
