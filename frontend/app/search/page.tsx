'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store,
  Building2,
  Landmark,
  Search,
  ChevronRight,
  Loader2,
} from 'lucide-react';

interface Segment {
  id: string;
  display_name: string;
  description: string;
  icon: string;
  visible: boolean;
  order: number;
}

// Icon mapping
const iconMap: Record<string, React.ReactNode> = {
  storefront: <Store className="w-6 h-6" />,
  business: <Building2 className="w-6 h-6" />,
  corporate_fare: <Landmark className="w-6 h-6" />,
  search: <Search className="w-6 h-6" />,
};

export default function SearchPage() {
  const router = useRouter();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Failed to fetch configuration');
      const data = await res.json();
      // Filter visible segments and sort by order
      const visibleSegments = (data.segments || [])
        .filter((s: Segment) => s.visible)
        .sort((a: Segment, b: Segment) => a.order - b.order);
      setSegments(visibleSegments);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load segments');
    } finally {
      setLoading(false);
    }
  };

  const handleSegmentSelect = (segmentId: string) => {
    router.push(`/search/${segmentId}`);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <div className="h-8 bg-mplc-gray-200 rounded w-48 mb-2 animate-pulse" />
          <div className="h-4 bg-mplc-gray-100 rounded w-96 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-mplc-gray-200 rounded-lg" />
                <div className="flex-1">
                  <div className="h-5 bg-mplc-gray-200 rounded w-32 mb-2" />
                  <div className="h-3 bg-mplc-gray-100 rounded w-48" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="card p-12 text-center">
          <div className="text-red-500 mb-4">{error}</div>
          <button
            onClick={fetchSegments}
            className="btn-primary inline-flex items-center space-x-2"
          >
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-mplc-black mb-2">
          Prospect Search
        </h1>
        <p className="text-mplc-gray-500">
          Select a search segment to find and enrich prospects. Each segment uses different
          data providers optimized for the search type.
        </p>
      </div>

      {/* Segment Selection Grid */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-mplc-gray-500 uppercase tracking-wider mb-4">
          Choose a Segment
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {segments.map((segment) => (
          <button
            key={segment.id}
            onClick={() => handleSegmentSelect(segment.id)}
            className="card-hover p-6 text-left group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-mplc-gray-100 rounded-lg flex items-center justify-center group-hover:bg-mplc-black group-hover:text-mplc-white transition-colors">
                  {iconMap[segment.icon] || <Search className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="font-semibold text-mplc-black text-lg mb-1 group-hover:underline">
                    {segment.display_name}
                  </h3>
                  <p className="text-sm text-mplc-gray-500 line-clamp-2">
                    {segment.description}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-mplc-gray-400 group-hover:text-mplc-black transition-colors flex-shrink-0 mt-1" />
            </div>
          </button>
        ))}
      </div>

      {segments.length === 0 && !loading && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-mplc-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-mplc-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-mplc-black mb-2">
            No search segments available
          </h3>
          <p className="text-mplc-gray-500 max-w-md mx-auto">
            Contact your administrator to configure search segments.
          </p>
        </div>
      )}

      {/* Quick Tips */}
      <div className="mt-8 p-6 bg-mplc-gray-50 rounded-lg border border-mplc-gray-200">
        <h3 className="font-medium text-mplc-black mb-3">Quick Tips</h3>
        <ul className="space-y-2 text-sm text-mplc-gray-600">
          <li className="flex items-start space-x-2">
            <span className="text-mplc-black font-medium">SMB & Local:</span>
            <span>Best for finding local businesses by industry and location (restaurants, retail, services)</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-mplc-black font-medium">Mid-Market:</span>
            <span>Enrich companies by domain or name to get employee count, industry, and contacts</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-mplc-black font-medium">Enterprise:</span>
            <span>Get verified direct dials and emails for key contacts at large organizations</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-mplc-black font-medium">Capability Search:</span>
            <span>Find companies by what they do - technical capabilities, products, or expertise</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
