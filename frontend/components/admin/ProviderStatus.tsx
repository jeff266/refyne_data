'use client';

import ProviderLogo from '@/components/ProviderLogo';

interface Segment {
  id: string;
  display_name: string;
  description: string;
  icon: string;
  visible: boolean;
  order: number;
  providers: {
    cascade: string[];
    fallback_enabled: boolean;
    fallback?: string[];
  };
  input_fields: any[];
}

interface Provider {
  name: string;
  type: string;
  env_key?: string;
  env_keys?: string[];
}

interface ProviderStatusProps {
  providers: Record<string, Provider>;
  segments: Segment[];
}

export default function ProviderStatus({ providers, segments }: ProviderStatusProps) {
  // Get which segments use each provider
  const getSegmentsUsingProvider = (providerId: string) => {
    const usages: { segment: string; role: 'primary' | 'fallback' }[] = [];

    segments.forEach((segment) => {
      const cascade = segment.providers.cascade || [];
      const fallback = segment.providers.fallback || [];

      if (cascade[0] === providerId) {
        usages.push({ segment: segment.display_name, role: 'primary' });
      } else if (cascade.includes(providerId) || fallback.includes(providerId)) {
        usages.push({ segment: segment.display_name, role: 'fallback' });
      }
    });

    return usages;
  };

  // For demo purposes, simulate which providers are configured
  // In a real app, this would come from the API
  const getConnectionStatus = (providerId: string): boolean => {
    // Simulating some providers being connected
    const connectedProviders = ['serper', 'apollo', 'clay'];
    return connectedProviders.includes(providerId);
  };

  const getProviderTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      local_search: 'Local Search',
      enrichment: 'Enrichment',
      ai_enrichment: 'AI Enrichment',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-4">
      {Object.entries(providers).map(([providerId, provider]) => {
        const isConnected = getConnectionStatus(providerId);
        const segmentUsages = getSegmentsUsingProvider(providerId);

        return (
          <div
            key={providerId}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors"
          >
            {/* Header Row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <ProviderLogo providerId={providerId} size={40} />
                <div>
                  <h3 className="text-lg font-medium text-black">{provider.name}</h3>
                  <p className="text-sm text-gray-500">
                    Type: {getProviderTypeLabel(provider.type)}
                  </p>
                </div>
              </div>

              {/* Connection Status */}
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    isConnected ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {isConnected ? 'Connected' : 'Not Configured'}
                </span>
              </div>
            </div>

            {/* Environment Variables */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">Environment Variables</p>
              <div className="flex flex-wrap gap-2">
                {provider.env_keys ? (
                  provider.env_keys.map((key) => (
                    <code
                      key={key}
                      className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700"
                    >
                      {key}
                    </code>
                  ))
                ) : provider.env_key ? (
                  <code className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                    {provider.env_key}
                  </code>
                ) : (
                  <span className="text-xs text-gray-400">None required</span>
                )}
              </div>
            </div>

            {/* Segment Usage */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Used by Segments</p>
              {segmentUsages.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {segmentUsages.map(({ segment, role }) => (
                    <span
                      key={segment}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                        role === 'primary'
                          ? 'bg-black text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {segment}
                      <span className="text-[10px] opacity-70">({role})</span>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-gray-400">Not used by any segment</span>
              )}
            </div>
          </div>
        );
      })}

      {/* Info Card */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mt-6">
        <h4 className="text-sm font-medium text-black mb-2">Connection Status</h4>
        <p className="text-sm text-gray-600">
          Provider connections are determined by checking if the required environment variables
          are set. To configure a provider, add the required API keys to your{' '}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.env</code> file.
        </p>
      </div>
    </div>
  );
}
