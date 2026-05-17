'use client';

import { useState, useEffect, useMemo } from 'react';
import { Database, Search, CheckCircle, XCircle, ChevronRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { ProviderCard } from '@/components/providers';
import {
  PROVIDER_LIST,
  getProviderTypeLabel,
  type ProviderMeta,
  type ProviderTypeCategory,
} from '@/lib/providers';

interface ProviderStatus {
  provider: string;
  configured: boolean;
  maskedKey?: string;
}

// Mock data for segment usage - in production this would come from API
const mockSegmentUsage: Record<string, number> = {
  serper: 2,
  apollo: 4,
  zoominfo: 3,
  graphiq: 1,
  clay: 2,
};

export default function ProvidersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ProviderTypeCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'connected' | 'not_configured'>('all');
  const [providerStatuses, setProviderStatuses] = useState<Map<string, ProviderStatus>>(new Map());
  const [loading, setLoading] = useState(true);

  // Fetch provider connection statuses
  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const response = await fetch('/api/keys');
        if (response.ok) {
          const data = await response.json();
          const statusMap = new Map<string, ProviderStatus>();

          // Initialize all providers as not configured
          PROVIDER_LIST.forEach((provider) => {
            statusMap.set(provider.id, {
              provider: provider.id,
              configured: false,
            });
          });

          // Update with actual statuses
          if (Array.isArray(data)) {
            data.forEach((status: ProviderStatus) => {
              statusMap.set(status.provider, status);
            });
          }

          setProviderStatuses(statusMap);
        }
      } catch (error) {
        console.error('Failed to fetch provider statuses:', error);
        // Initialize all as not configured on error
        const statusMap = new Map<string, ProviderStatus>();
        PROVIDER_LIST.forEach((provider) => {
          statusMap.set(provider.id, {
            provider: provider.id,
            configured: false,
          });
        });
        setProviderStatuses(statusMap);
      } finally {
        setLoading(false);
      }
    };

    fetchStatuses();
  }, []);

  // Filter providers
  const filteredProviders = useMemo(() => {
    return PROVIDER_LIST.filter((provider) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = provider.name.toLowerCase().includes(query);
        const matchesDescription = provider.description.toLowerCase().includes(query);
        const matchesCapabilities = provider.capabilities.some((cap) =>
          cap.toLowerCase().includes(query)
        );
        if (!matchesName && !matchesDescription && !matchesCapabilities) {
          return false;
        }
      }

      // Type filter
      if (typeFilter !== 'all' && provider.type !== typeFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const status = providerStatuses.get(provider.id);
        const isConnected = status?.configured ?? false;
        if (statusFilter === 'connected' && !isConnected) {
          return false;
        }
        if (statusFilter === 'not_configured' && isConnected) {
          return false;
        }
      }

      return true;
    });
  }, [searchQuery, typeFilter, statusFilter, providerStatuses]);

  // Stats
  const connectedCount = Array.from(providerStatuses.values()).filter((s) => s.configured).length;
  const totalCount = PROVIDER_LIST.length;

  const providerTypes: { value: ProviderTypeCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'All Types' },
    { value: 'local_search', label: 'Local Search' },
    { value: 'enrichment', label: 'Enrichment' },
    { value: 'ai_enrichment', label: 'AI Enrichment' },
  ];

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-mplc-gray-500 mb-6">
        <Link href="/" className="hover:text-mplc-black">
          Home
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-mplc-gray-900 font-medium">Providers</span>
      </div>

      {/* Page Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-mplc-black flex items-center justify-center">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-mplc-gray-900">Data Providers</h1>
            <p className="text-mplc-gray-500">
              Configure and manage your enrichment data providers
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-lg font-semibold text-mplc-black">{connectedCount}</span>
            </div>
            <p className="text-sm text-mplc-gray-500">Connected</p>
          </div>
          <div className="w-px h-10 bg-mplc-gray-200" />
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <Database className="w-4 h-4 text-mplc-gray-400" />
              <span className="text-lg font-semibold text-mplc-black">{totalCount}</span>
            </div>
            <p className="text-sm text-mplc-gray-500">Total Providers</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[280px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-mplc-gray-400" />
            <input
              type="text"
              placeholder="Search providers by name, description, or capabilities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 py-2"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ProviderTypeCategory | 'all')}
            className="input w-auto py-2"
          >
            {providerTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'all' | 'connected' | 'not_configured')
            }
            className="input w-auto py-2"
          >
            <option value="all">All Statuses</option>
            <option value="connected">Connected</option>
            <option value="not_configured">Not Configured</option>
          </select>

          {/* Clear Filters */}
          {(searchQuery || typeFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
                setStatusFilter('all');
              }}
              className="text-sm text-mplc-gray-500 hover:text-mplc-black underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-sm text-mplc-gray-500">
          Showing {filteredProviders.length} of {totalCount} providers
        </p>
      </div>

      {/* Provider Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-mplc-gray-200 rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 bg-mplc-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-mplc-gray-100 rounded w-1/4" />
                </div>
              </div>
              <div className="h-3 bg-mplc-gray-100 rounded w-full mb-2" />
              <div className="h-3 bg-mplc-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filteredProviders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProviders.map((provider) => {
            const status = providerStatuses.get(provider.id);
            return (
              <ProviderCard
                key={provider.id}
                provider={provider}
                isConnected={status?.configured ?? false}
                segmentsUsing={mockSegmentUsage[provider.id] || 0}
              />
            );
          })}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-mplc-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Database className="w-8 h-8 text-mplc-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-mplc-black mb-2">No providers found</h3>
          <p className="text-mplc-gray-500 mb-6 max-w-md mx-auto">
            No providers match your current filters. Try adjusting your search criteria.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setTypeFilter('all');
              setStatusFilter('all');
            }}
            className="btn-secondary"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-8 p-5 bg-mplc-gray-50 border border-mplc-gray-200 rounded-xl">
        <h3 className="text-sm font-medium text-mplc-black mb-2">About Data Providers</h3>
        <p className="text-sm text-mplc-gray-600">
          Data providers supply enrichment information for your prospect searches. Configure API keys in{' '}
          <Link href="/settings" className="text-mplc-black underline hover:no-underline">
            Settings
          </Link>{' '}
          to enable providers. Each provider offers different capabilities - choose based on your
          data needs and budget.
        </p>
      </div>
    </div>
  );
}
