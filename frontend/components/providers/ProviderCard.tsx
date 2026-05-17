'use client';

import Link from 'next/link';
import { ChevronRight, Settings, Layers } from 'lucide-react';
import { CapabilityBadgeList } from './CapabilityBadge';
import type { ProviderMeta } from '@/lib/providers';
import { getProviderTypeLabel, getProviderTypeColor } from '@/lib/providers';

interface ProviderCardProps {
  provider: ProviderMeta;
  isConnected: boolean;
  segmentsUsing?: number;
  onConfigure?: () => void;
}

export default function ProviderCard({
  provider,
  isConnected,
  segmentsUsing = 0,
  onConfigure,
}: ProviderCardProps) {
  const Icon = provider.icon;
  const typeLabel = getProviderTypeLabel(provider.type);
  const typeColor = getProviderTypeColor(provider.type);

  return (
    <div className="card-hover p-5 group flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-mplc-gray-100 rounded-lg flex items-center justify-center">
            <Icon className="w-5 h-5 text-mplc-gray-600" />
          </div>
          <div>
            <h3 className="font-semibold text-mplc-black">{provider.name}</h3>
            <span className={`px-2 py-0.5 text-xs font-medium rounded border ${typeColor}`}>
              {typeLabel}
            </span>
          </div>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-400'
            }`}
          />
          <span
            className={`text-xs font-medium ${
              isConnected ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {isConnected ? 'Connected' : 'Not configured'}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-mplc-gray-500 mb-4 line-clamp-2 flex-grow">
        {provider.description}
      </p>

      {/* Capabilities */}
      <div className="mb-4">
        <p className="text-xs text-mplc-gray-400 mb-2">Capabilities</p>
        <CapabilityBadgeList capabilities={provider.capabilities} max={3} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-mplc-gray-100">
        <div className="flex items-center gap-1.5 text-sm text-mplc-gray-500">
          <Layers className="w-4 h-4" />
          <span>
            {segmentsUsing} segment{segmentsUsing !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            onClick={(e) => {
              e.stopPropagation();
              onConfigure?.();
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-mplc-gray-600
              border border-mplc-gray-200 rounded-md hover:bg-mplc-gray-50 hover:border-mplc-gray-300
              transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Configure
          </Link>

          <Link
            href={`/providers/${provider.id}`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-mplc-white
              bg-mplc-black rounded-md hover:bg-mplc-gray-800 transition-colors"
          >
            Details
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
