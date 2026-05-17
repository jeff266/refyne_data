'use client';

import { ChevronDown, Check, AlertCircle, Zap } from 'lucide-react';

interface Provider {
  name: string;
  type: string;
  env_key?: string;
  env_keys?: string[];
}

interface ProviderStackProps {
  cascade: string[];
  fallback?: string[];
  fallbackEnabled: boolean;
  providers: Record<string, Provider>;
  compact?: boolean;
}

// Simulated connection status - in production this would come from API
const getConnectionStatus = (providerId: string): boolean => {
  const connectedProviders = ['serper', 'apollo', 'clay'];
  return connectedProviders.includes(providerId);
};

const getProviderTypeIcon = (type: string): string => {
  const icons: Record<string, string> = {
    local_search: 'search',
    enrichment: 'database',
    ai_enrichment: 'sparkles',
  };
  return icons[type] || 'database';
};

export default function ProviderStack({
  cascade,
  fallback = [],
  fallbackEnabled,
  providers,
  compact = false,
}: ProviderStackProps) {
  const primaryProvider = cascade[0];
  const secondaryProviders = cascade.slice(1);
  const allFallbacks = fallbackEnabled ? [...secondaryProviders, ...fallback] : secondaryProviders;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {/* Primary */}
        {primaryProvider && providers[primaryProvider] && (
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                getConnectionStatus(primaryProvider) ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm font-medium text-mplc-black">
              {providers[primaryProvider].name}
            </span>
          </div>
        )}

        {/* Fallbacks indicator */}
        {allFallbacks.length > 0 && (
          <>
            <ChevronDown className="w-3 h-3 text-mplc-gray-400 rotate-[-90deg]" />
            <span className="text-xs text-mplc-gray-500">
              +{allFallbacks.length} fallback{allFallbacks.length !== 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Primary Provider */}
      {primaryProvider && providers[primaryProvider] && (
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-mplc-black text-mplc-white flex items-center justify-center">
            <span className="text-xs font-bold">1</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-mplc-black">
                  {providers[primaryProvider].name}
                </span>
                <span className="badge-default text-[10px]">Primary</span>
              </div>
              <div className="flex items-center gap-1.5">
                {getConnectionStatus(primaryProvider) ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-xs text-green-600 font-medium">Connected</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-xs text-red-500 font-medium">Not Configured</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-mplc-gray-500 mt-0.5">
              {providers[primaryProvider].type === 'local_search'
                ? 'Local Search'
                : providers[primaryProvider].type === 'ai_enrichment'
                ? 'AI Enrichment'
                : 'Data Enrichment'}
            </p>
          </div>
        </div>
      )}

      {/* Fallback Providers */}
      {allFallbacks.length > 0 && (
        <>
          {/* Connector Line */}
          <div className="flex items-center gap-3 pl-3">
            <div className="w-px h-4 bg-mplc-gray-200" />
            <div className="flex items-center gap-1 text-[10px] text-mplc-gray-400 uppercase tracking-wider">
              <Zap className="w-3 h-3" />
              <span>Fallback Chain</span>
            </div>
          </div>

          {/* Fallback List */}
          <div className="space-y-2 pl-3 border-l-2 border-dashed border-mplc-gray-200 ml-3">
            {allFallbacks.map((providerId, index) => {
              const provider = providers[providerId];
              if (!provider) return null;

              const isConnected = getConnectionStatus(providerId);

              return (
                <div key={providerId} className="flex items-center gap-3 pl-3">
                  <div
                    className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isConnected
                        ? 'border-mplc-gray-300 bg-mplc-white'
                        : 'border-mplc-gray-200 bg-mplc-gray-50'
                    }`}
                  >
                    <span className="text-[10px] font-medium text-mplc-gray-500">
                      {index + 2}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 flex items-center justify-between">
                    <span
                      className={`text-sm ${
                        isConnected ? 'text-mplc-gray-700' : 'text-mplc-gray-400'
                      }`}
                    >
                      {provider.name}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isConnected ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* No Fallback Notice */}
      {allFallbacks.length === 0 && !fallbackEnabled && (
        <div className="text-xs text-mplc-gray-400 pl-9">
          No fallback providers configured
        </div>
      )}
    </div>
  );
}
