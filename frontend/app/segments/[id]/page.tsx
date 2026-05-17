'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Store,
  Search,
  Briefcase,
  Database,
  Clock,
  Settings,
  Eye,
  EyeOff,
  Filter,
  Play,
} from 'lucide-react';
import ProviderStack from '@/components/segments/ProviderStack';

interface InputField {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  source?: string;
  min?: number;
  max?: number;
  default?: number | string;
  height?: number;
  horizontal?: boolean;
  show_when?: Record<string, string>;
}

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
  input_fields: InputField[];
}

interface Provider {
  name: string;
  type: string;
  env_key?: string;
  env_keys?: string[];
}

interface Config {
  segments: Segment[];
  providers: Record<string, Provider>;
}

// Mock recent searches - in production this would come from API
const mockRecentSearches = [
  {
    id: '1',
    query: 'SaaS companies in Austin',
    timestamp: '2024-03-15T14:30:00Z',
    resultsCount: 45,
  },
  {
    id: '2',
    query: 'notion.com',
    timestamp: '2024-03-15T10:15:00Z',
    resultsCount: 1,
  },
  {
    id: '3',
    query: 'Tech startups San Francisco',
    timestamp: '2024-03-14T16:45:00Z',
    resultsCount: 120,
  },
];

// Icon mapping for segment types
const iconMap: Record<string, React.ReactNode> = {
  storefront: <Store className="w-8 h-8" />,
  business: <Briefcase className="w-8 h-8" />,
  corporate_fare: <Building2 className="w-8 h-8" />,
  search: <Search className="w-8 h-8" />,
};

// Format field type for display
const getFieldTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    text: 'Text Input',
    select: 'Dropdown Select',
    radio: 'Radio Buttons',
    textarea: 'Text Area',
    slider: 'Range Slider',
    checkbox: 'Checkbox',
  };
  return labels[type] || type;
};

export default function SegmentDetailPage() {
  const params = useParams();
  const segmentId = params.id as string;

  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Failed to fetch configuration');
      const data = await res.json();
      setConfig(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load segment');
    } finally {
      setLoading(false);
    }
  };

  const segment = config?.segments.find((s) => s.id === segmentId);

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-6 w-32 bg-mplc-gray-200 rounded mb-8" />
          <div className="flex items-start gap-6 mb-8">
            <div className="w-16 h-16 bg-mplc-gray-200 rounded-xl" />
            <div className="flex-1">
              <div className="h-8 w-64 bg-mplc-gray-200 rounded mb-2" />
              <div className="h-5 w-96 bg-mplc-gray-100 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-64 bg-mplc-gray-100 rounded-lg" />
            <div className="h-64 bg-mplc-gray-100 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !segment) {
    return (
      <div className="p-8">
        <Link
          href="/segments"
          className="inline-flex items-center gap-2 text-sm text-mplc-gray-500 hover:text-mplc-black mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Segments
        </Link>
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Database className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-mplc-black mb-2">
            {error ? 'Failed to Load Segment' : 'Segment Not Found'}
          </h3>
          <p className="text-mplc-gray-500 mb-6">
            {error || `The segment "${segmentId}" does not exist or has been removed.`}
          </p>
          <Link href="/segments" className="btn-primary">
            View All Segments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Back Link */}
      <Link
        href="/segments"
        className="inline-flex items-center gap-2 text-sm text-mplc-gray-500 hover:text-mplc-black mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Segments
      </Link>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="w-16 h-16 bg-mplc-gray-100 rounded-xl flex items-center justify-center text-mplc-gray-600">
            {iconMap[segment.icon] || <Database className="w-8 h-8" />}
          </div>

          {/* Title & Meta */}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold text-mplc-black">
                {segment.display_name}
              </h1>
              {segment.visible ? (
                <span className="badge-success flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  Visible
                </span>
              ) : (
                <span className="badge-warning flex items-center gap-1">
                  <EyeOff className="w-3 h-3" />
                  Hidden
                </span>
              )}
            </div>
            <p className="text-mplc-gray-500 max-w-xl">{segment.description}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            href={`/admin?segment=${segment.id}`}
            className="btn-secondary flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Configure
          </Link>
          <Link
            href={`/search/${segment.id}`}
            className="btn-primary flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Start New Search
          </Link>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Provider Information */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-mplc-black mb-4">
              Provider Configuration
            </h2>
            <ProviderStack
              cascade={segment.providers.cascade}
              fallback={segment.providers.fallback}
              fallbackEnabled={segment.providers.fallback_enabled}
              providers={config?.providers || {}}
            />

            {/* Fallback Info */}
            <div className="mt-4 pt-4 border-t border-mplc-gray-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-mplc-gray-500">Fallback Mode</span>
                <span
                  className={`font-medium ${
                    segment.providers.fallback_enabled
                      ? 'text-green-600'
                      : 'text-mplc-gray-400'
                  }`}
                >
                  {segment.providers.fallback_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          {/* Input Fields */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-mplc-black">Search Filters</h2>
              <div className="flex items-center gap-1 text-xs text-mplc-gray-500">
                <Filter className="w-3.5 h-3.5" />
                {segment.input_fields.length} field
                {segment.input_fields.length !== 1 ? 's' : ''}
              </div>
            </div>

            {segment.input_fields.length > 0 ? (
              <div className="space-y-4">
                {segment.input_fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex items-start gap-4 p-4 bg-mplc-gray-50 rounded-lg"
                  >
                    <div className="w-8 h-8 bg-mplc-white rounded-lg border border-mplc-gray-200 flex items-center justify-center text-sm font-medium text-mplc-gray-500">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-mplc-black">{field.label}</span>
                        {field.required && (
                          <span className="text-[10px] text-red-500 font-medium uppercase">
                            Required
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-mplc-gray-500">
                        <span className="bg-mplc-gray-200 px-2 py-0.5 rounded">
                          {getFieldTypeLabel(field.type)}
                        </span>
                        {field.placeholder && (
                          <span className="text-mplc-gray-400">
                            e.g., {field.placeholder}
                          </span>
                        )}
                        {field.options && (
                          <span>Options: {field.options.join(', ')}</span>
                        )}
                        {field.min !== undefined && field.max !== undefined && (
                          <span>
                            Range: {field.min} - {field.max}
                          </span>
                        )}
                      </div>
                      {field.show_when && (
                        <p className="text-[10px] text-mplc-gray-400 mt-1">
                          Conditional: Shows when{' '}
                          {Object.entries(field.show_when)
                            .map(([k, v]) => `${k} = "${v}"`)
                            .join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Filter className="w-8 h-8 text-mplc-gray-300 mx-auto mb-3" />
                <p className="text-sm text-mplc-gray-500">
                  No input fields configured for this segment
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Recent Activity */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card p-6">
            <h3 className="font-semibold text-mplc-black mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                href={`/search/${segment.id}`}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                New Search
              </Link>
              <Link
                href={`/admin?segment=${segment.id}`}
                className="w-full btn-secondary flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Edit Configuration
              </Link>
            </div>
          </div>

          {/* Recent Searches */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-mplc-black">Recent Searches</h3>
              <Link
                href={`/search/${segment.id}/history`}
                className="text-xs text-mplc-gray-500 hover:text-mplc-black"
              >
                View all
              </Link>
            </div>

            {mockRecentSearches.length > 0 ? (
              <div className="space-y-3">
                {mockRecentSearches.map((search) => (
                  <div
                    key={search.id}
                    className="group flex items-start gap-3 p-3 bg-mplc-gray-50 rounded-lg hover:bg-mplc-gray-100 transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 bg-mplc-white rounded border border-mplc-gray-200 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-mplc-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-mplc-black truncate group-hover:text-mplc-gray-700">
                        {search.query}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-mplc-gray-500">
                        <span>{formatTime(search.timestamp)}</span>
                        <span>&bull;</span>
                        <span>{search.resultsCount} results</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-mplc-gray-300 group-hover:text-mplc-gray-500 transition-colors" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Clock className="w-8 h-8 text-mplc-gray-300 mx-auto mb-2" />
                <p className="text-sm text-mplc-gray-500">No recent searches</p>
              </div>
            )}
          </div>

          {/* Segment Stats Placeholder */}
          <div className="card p-6">
            <h3 className="font-semibold text-mplc-black mb-4">Segment Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-mplc-gray-500">Total Searches</span>
                <span className="font-medium text-mplc-black">--</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-mplc-gray-500">Avg. Results</span>
                <span className="font-medium text-mplc-black">--</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-mplc-gray-500">Provider Calls</span>
                <span className="font-medium text-mplc-black">--</span>
              </div>
            </div>
            <p className="text-[10px] text-mplc-gray-400 mt-4 text-center">
              Analytics coming soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
