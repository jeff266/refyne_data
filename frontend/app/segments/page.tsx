'use client';

import { useState, useEffect } from 'react';
import { Layers, Plus, Search, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import SegmentDetailCard from '@/components/segments/SegmentDetailCard';

interface InputField {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  source?: string;
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

export default function SegmentsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);

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
      setError(err instanceof Error ? err.message : 'Failed to load segments');
    } finally {
      setLoading(false);
    }
  };

  // Filter segments based on search and visibility
  const filteredSegments = config?.segments
    .filter((segment) => showHidden || segment.visible)
    .filter(
      (segment) =>
        searchQuery === '' ||
        segment.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        segment.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.order - b.order);

  const visibleCount = config?.segments.filter((s) => s.visible).length || 0;
  const hiddenCount = config?.segments.filter((s) => !s.visible).length || 0;

  if (loading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <div className="h-8 w-48 bg-mplc-gray-200 rounded animate-pulse mb-2" />
          <div className="h-5 w-96 bg-mplc-gray-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-mplc-gray-200 rounded-xl" />
                <div className="flex-1">
                  <div className="h-5 bg-mplc-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-mplc-gray-100 rounded w-full" />
                </div>
              </div>
              <div className="h-20 bg-mplc-gray-50 rounded-lg mb-4" />
              <div className="h-8 bg-mplc-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Layers className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-mplc-black mb-2">
            Failed to Load Segments
          </h3>
          <p className="text-mplc-gray-500 mb-6">{error}</p>
          <button onClick={fetchConfig} className="btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-mplc-black mb-2">Segments</h1>
        <p className="text-mplc-gray-500">
          Choose a segment to search for prospects. Each segment is configured with specific
          data providers and filters optimized for different use cases.
        </p>
      </div>

      {/* Search and Filter Bar */}
      <div className="card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-mplc-gray-400" />
            <input
              type="text"
              placeholder="Search segments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Filter Toggle */}
          <div className="flex items-center gap-4">
            {hiddenCount > 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showHidden}
                  onChange={(e) => setShowHidden(e.target.checked)}
                  className="w-4 h-4 rounded border-mplc-gray-300 text-mplc-black focus:ring-mplc-black"
                />
                <span className="text-sm text-mplc-gray-600">
                  Show hidden ({hiddenCount})
                </span>
              </label>
            )}

            {/* Admin Link */}
            <Link
              href="/admin"
              className="flex items-center gap-2 text-sm text-mplc-gray-500 hover:text-mplc-black transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Configure</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-6 mb-6 text-sm text-mplc-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>{visibleCount} active segment{visibleCount !== 1 ? 's' : ''}</span>
        </div>
        {hiddenCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-mplc-gray-300" />
            <span>{hiddenCount} hidden</span>
          </div>
        )}
        {config?.providers && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>{Object.keys(config.providers).length} providers available</span>
          </div>
        )}
      </div>

      {/* Segments Grid */}
      {filteredSegments && filteredSegments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSegments.map((segment) => (
            <SegmentDetailCard
              key={segment.id}
              segment={segment}
              providers={config?.providers || {}}
            />
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-mplc-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-mplc-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-mplc-black mb-2">
            {searchQuery ? 'No segments found' : 'No segments available'}
          </h3>
          <p className="text-mplc-gray-500 mb-6 max-w-md mx-auto">
            {searchQuery
              ? `No segments match "${searchQuery}". Try a different search term.`
              : 'Create your first segment to start searching for prospects.'}
          </p>
          {!searchQuery && (
            <Link href="/admin" className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>Create Segment</span>
            </Link>
          )}
        </div>
      )}

      {/* Quick Tips */}
      <div className="mt-8 bg-mplc-gray-50 rounded-lg border border-mplc-gray-200 p-6">
        <h4 className="font-medium text-mplc-black mb-3">Quick Tips</h4>
        <ul className="space-y-2 text-sm text-mplc-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-mplc-gray-400">&bull;</span>
            <span>
              <strong>SMB & Local</strong> is ideal for finding local businesses by industry and
              location
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-mplc-gray-400">&bull;</span>
            <span>
              <strong>Mid-Market</strong> provides detailed company enrichment by domain or name
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-mplc-gray-400">&bull;</span>
            <span>
              <strong>Enterprise</strong> offers verified direct dials and emails with fallback
              support
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-mplc-gray-400">&bull;</span>
            <span>
              Each segment routes to different data providers based on the type of search
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
