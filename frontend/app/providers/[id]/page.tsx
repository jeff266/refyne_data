'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  ExternalLink,
  CheckCircle,
  XCircle,
  PlayCircle,
  Loader2,
  Settings,
  Layers,
  Clock,
  DollarSign,
  Key,
  ArrowLeft,
} from 'lucide-react';
import { CapabilityBadgeList } from '@/components/providers';
import {
  getProviderById,
  getProviderTypeLabel,
  getProviderTypeColor,
  type ProviderMeta,
} from '@/lib/providers';

interface ProviderStatus {
  provider: string;
  configured: boolean;
  maskedKey?: string;
}

interface SegmentUsage {
  id: string;
  name: string;
  role: 'primary' | 'fallback';
}

// Mock data for segments using this provider
const mockSegmentUsages: Record<string, SegmentUsage[]> = {
  serper: [
    { id: '1', name: 'Local Businesses', role: 'primary' },
    { id: '2', name: 'SMB Discovery', role: 'fallback' },
  ],
  apollo: [
    { id: '1', name: 'Enterprise Tech', role: 'primary' },
    { id: '2', name: 'SMB SaaS', role: 'primary' },
    { id: '3', name: 'Healthcare Decision Makers', role: 'fallback' },
    { id: '4', name: 'Fintech Startups', role: 'fallback' },
  ],
  zoominfo: [
    { id: '1', name: 'Enterprise Tech', role: 'primary' },
    { id: '2', name: 'Healthcare Decision Makers', role: 'primary' },
    { id: '3', name: 'Fortune 500', role: 'fallback' },
  ],
  graphiq: [{ id: '1', name: 'AI Companies', role: 'primary' }],
  clay: [
    { id: '1', name: 'Outbound Campaign', role: 'primary' },
    { id: '2', name: 'Personalization', role: 'fallback' },
  ],
};

// Mock usage stats
const mockUsageStats = {
  callsToday: 127,
  callsThisMonth: 3842,
  avgResponseTime: 245, // ms
  successRate: 98.5,
};

export default function ProviderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const providerId = params.id as string;

  const [provider, setProvider] = useState<ProviderMeta | null>(null);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testState, setTestState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    const fetchData = async () => {
      // Get provider metadata
      const providerMeta = getProviderById(providerId);
      if (!providerMeta) {
        router.push('/providers');
        return;
      }
      setProvider(providerMeta);

      // Fetch connection status
      try {
        const response = await fetch('/api/keys');
        if (response.ok) {
          const data = await response.json();
          const providerStatus = Array.isArray(data)
            ? data.find((s: ProviderStatus) => s.provider === providerId)
            : null;
          setStatus(
            providerStatus || {
              provider: providerId,
              configured: false,
            }
          );
        }
      } catch (error) {
        console.error('Failed to fetch provider status:', error);
        setStatus({
          provider: providerId,
          configured: false,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [providerId, router]);

  const handleTestConnection = async () => {
    setTestState('loading');
    try {
      const response = await fetch(`/api/keys/${providerId}/test`, {
        method: 'POST',
      });
      const data = await response.json();
      setTestState(data.success ? 'success' : 'error');
      setTimeout(() => setTestState('idle'), 3000);
    } catch {
      setTestState('error');
      setTimeout(() => setTestState('idle'), 3000);
    }
  };

  if (loading || !provider) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-mplc-gray-200 rounded w-1/4 mb-4" />
          <div className="h-4 bg-mplc-gray-100 rounded w-1/2 mb-8" />
          <div className="card p-6">
            <div className="h-6 bg-mplc-gray-200 rounded w-1/3 mb-4" />
            <div className="h-4 bg-mplc-gray-100 rounded w-full mb-2" />
            <div className="h-4 bg-mplc-gray-100 rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  const Icon = provider.icon;
  const typeLabel = getProviderTypeLabel(provider.type);
  const typeColor = getProviderTypeColor(provider.type);
  const segmentUsages = mockSegmentUsages[providerId] || [];
  const isConnected = status?.configured ?? false;

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-mplc-gray-500 mb-6">
        <Link href="/" className="hover:text-mplc-black">
          Home
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/providers" className="hover:text-mplc-black">
          Providers
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-mplc-gray-900 font-medium">{provider.name}</span>
      </div>

      {/* Back Button */}
      <Link
        href="/providers"
        className="inline-flex items-center gap-1.5 text-sm text-mplc-gray-500 hover:text-mplc-black mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Providers
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-mplc-gray-100 rounded-xl flex items-center justify-center">
            <Icon className="w-7 h-7 text-mplc-gray-600" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold text-mplc-black">{provider.name}</h1>
              <span className={`px-2.5 py-1 text-xs font-medium rounded border ${typeColor}`}>
                {typeLabel}
              </span>
            </div>
            <p className="text-mplc-gray-500 max-w-2xl">{provider.longDescription || provider.description}</p>
          </div>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              isConnected ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}
          >
            {isConnected ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400" />
            )}
            <span className={`font-medium ${isConnected ? 'text-green-700' : 'text-red-600'}`}>
              {isConnected ? 'Connected' : 'Not Configured'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Capabilities */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-mplc-black mb-4">Capabilities</h2>
            <CapabilityBadgeList capabilities={provider.capabilities} max={10} size="md" />
          </div>

          {/* Segments Using This Provider */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-mplc-black">Segments Using This Provider</h2>
              <span className="text-sm text-mplc-gray-500">
                {segmentUsages.length} segment{segmentUsages.length !== 1 ? 's' : ''}
              </span>
            </div>

            {segmentUsages.length > 0 ? (
              <div className="space-y-3">
                {segmentUsages.map((segment) => (
                  <Link
                    key={segment.id}
                    href={`/segments/${segment.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-mplc-gray-200 hover:border-mplc-gray-300 hover:bg-mplc-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Layers className="w-4 h-4 text-mplc-gray-400" />
                      <span className="font-medium text-mplc-black">{segment.name}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded ${
                        segment.role === 'primary'
                          ? 'bg-mplc-black text-mplc-white'
                          : 'bg-mplc-gray-100 text-mplc-gray-600'
                      }`}
                    >
                      {segment.role}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Layers className="w-8 h-8 text-mplc-gray-300 mx-auto mb-2" />
                <p className="text-sm text-mplc-gray-500">No segments are using this provider yet</p>
              </div>
            )}
          </div>

          {/* Usage Stats (Placeholder) */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-mplc-black mb-4">Usage Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-mplc-gray-50 rounded-lg">
                <p className="text-2xl font-semibold text-mplc-black">
                  {mockUsageStats.callsToday.toLocaleString()}
                </p>
                <p className="text-sm text-mplc-gray-500">Calls Today</p>
              </div>
              <div className="p-4 bg-mplc-gray-50 rounded-lg">
                <p className="text-2xl font-semibold text-mplc-black">
                  {mockUsageStats.callsThisMonth.toLocaleString()}
                </p>
                <p className="text-sm text-mplc-gray-500">Calls This Month</p>
              </div>
              <div className="p-4 bg-mplc-gray-50 rounded-lg">
                <p className="text-2xl font-semibold text-mplc-black">
                  {mockUsageStats.avgResponseTime}ms
                </p>
                <p className="text-sm text-mplc-gray-500">Avg Response Time</p>
              </div>
              <div className="p-4 bg-mplc-gray-50 rounded-lg">
                <p className="text-2xl font-semibold text-mplc-black">
                  {mockUsageStats.successRate}%
                </p>
                <p className="text-sm text-mplc-gray-500">Success Rate</p>
              </div>
            </div>
            <p className="text-xs text-mplc-gray-400 mt-4">
              * Usage statistics are placeholder values. Connect to backend for real data.
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Configuration Card */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-mplc-black mb-4">Configuration</h2>

            {/* API Key Status */}
            <div className="mb-4">
              <p className="text-xs text-mplc-gray-500 mb-2">API Key</p>
              {isConnected ? (
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-mplc-gray-400" />
                  <span className="font-mono text-sm text-mplc-gray-600">
                    {status?.maskedKey || '****...****'}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-red-500">No API key configured</p>
              )}
            </div>

            {/* Environment Variables */}
            <div className="mb-4">
              <p className="text-xs text-mplc-gray-500 mb-2">Required Environment Variables</p>
              <div className="flex flex-wrap gap-2">
                {provider.envKeys.map((key) => (
                  <code
                    key={key}
                    className="px-2 py-1 bg-mplc-gray-100 rounded text-xs text-mplc-gray-700"
                  >
                    {key}
                  </code>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-4 border-t border-mplc-gray-100">
              {isConnected && (
                <button
                  onClick={handleTestConnection}
                  disabled={testState === 'loading'}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    testState === 'success'
                      ? 'border-green-300 bg-green-50 text-green-700'
                      : testState === 'error'
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-mplc-gray-300 hover:bg-mplc-gray-50 text-mplc-gray-700'
                  } disabled:opacity-50`}
                >
                  {testState === 'loading' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : testState === 'success' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : testState === 'error' ? (
                    <XCircle className="w-4 h-4" />
                  ) : (
                    <PlayCircle className="w-4 h-4" />
                  )}
                  {testState === 'loading'
                    ? 'Testing...'
                    : testState === 'success'
                    ? 'Connection Successful'
                    : testState === 'error'
                    ? 'Connection Failed'
                    : 'Test Connection'}
                </button>
              )}

              <Link
                href="/settings"
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-mplc-black text-mplc-white hover:bg-mplc-gray-800 transition-colors"
              >
                <Settings className="w-4 h-4" />
                {isConnected ? 'Manage API Key' : 'Add API Key'}
              </Link>
            </div>
          </div>

          {/* Rate Limits & Pricing */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-mplc-black mb-4">Rate Limits & Pricing</h2>

            <div className="space-y-4">
              {provider.rateLimitPerMinute && (
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-mplc-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-mplc-black">
                      {provider.rateLimitPerMinute} requests/min
                    </p>
                    <p className="text-xs text-mplc-gray-500">Rate limit</p>
                  </div>
                </div>
              )}

              {provider.costPerCall && (
                <div className="flex items-start gap-3">
                  <DollarSign className="w-4 h-4 text-mplc-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-mplc-black">
                      ${provider.costPerCall.toFixed(3)} per call
                    </p>
                    <p className="text-xs text-mplc-gray-500">Estimated cost</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Documentation */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-mplc-black mb-4">Documentation</h2>
            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-mplc-black hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              View API Documentation
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
