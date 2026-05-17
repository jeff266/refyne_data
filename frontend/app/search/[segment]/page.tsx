'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Store, Building2, Landmark, Search, Info } from 'lucide-react';
import Link from 'next/link';
import {
  SearchForm,
  SearchResults,
  BulkActions,
  FormValues,
  InputField,
  SearchResultItem,
} from '@/components/search';

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

interface Config {
  segments: Segment[];
  providers: Record<string, { name: string; type: string }>;
}

// Icon mapping
const iconMap: Record<string, React.ReactNode> = {
  storefront: <Store className="w-8 h-8" />,
  business: <Building2 className="w-8 h-8" />,
  corporate_fare: <Landmark className="w-8 h-8" />,
  search: <Search className="w-8 h-8" />,
};

// Generate mock results for demo
function generateMockResults(
  segmentId: string,
  formValues: FormValues,
  count: number = 20
): SearchResultItem[] {
  const industries = [
    'Restaurant',
    'Retail',
    'Healthcare',
    'Automotive',
    'Construction',
    'Legal Services',
    'Technology',
    'Manufacturing',
    'Fitness',
    'Beauty Salon',
  ];

  const cities = [
    { city: 'Austin', state: 'TX' },
    { city: 'San Francisco', state: 'CA' },
    { city: 'New York', state: 'NY' },
    { city: 'Chicago', state: 'IL' },
    { city: 'Los Angeles', state: 'CA' },
    { city: 'Seattle', state: 'WA' },
    { city: 'Denver', state: 'CO' },
    { city: 'Miami', state: 'FL' },
    { city: 'Boston', state: 'MA' },
    { city: 'Portland', state: 'OR' },
  ];

  const businessPrefixes = [
    'Premier',
    'Elite',
    'Quality',
    'First Choice',
    'Superior',
    'Pro',
    'Golden',
    'Prime',
    'Top Notch',
    'Excellence',
  ];

  const businessSuffixes = [
    'Services',
    'Solutions',
    'Group',
    'Partners',
    'Associates',
    'Co.',
    'LLC',
    'Inc.',
    'Enterprise',
    'Industries',
  ];

  // Determine provider based on segment
  const providerMap: Record<string, string> = {
    smb_local: 'serper',
    midmarket: 'apollo',
    enterprise: 'zoominfo',
    capability: 'graphiq',
  };

  const provider = providerMap[segmentId] || 'apollo';

  const results: SearchResultItem[] = [];

  for (let i = 0; i < count; i++) {
    const industry =
      String(formValues.industry || '') ||
      industries[Math.floor(Math.random() * industries.length)];
    const locationData = cities[Math.floor(Math.random() * cities.length)];
    const prefix = businessPrefixes[Math.floor(Math.random() * businessPrefixes.length)];
    const suffix = businessSuffixes[Math.floor(Math.random() * businessSuffixes.length)];

    const streetNum = Math.floor(Math.random() * 9999) + 100;
    const streets = [
      'Main St',
      'Oak Ave',
      'Commerce Blvd',
      'Market St',
      'First Ave',
      'Industrial Dr',
      'Tech Way',
      'Business Park Rd',
    ];

    results.push({
      id: `result-${segmentId}-${i}-${Date.now()}`,
      name: `${prefix} ${industry.replace(/_/g, ' ')} ${suffix}`,
      address: `${streetNum} ${streets[Math.floor(Math.random() * streets.length)]}`,
      city: String(formValues.location || '').split(',')[0]?.trim() || locationData.city,
      state: String(formValues.location || '').split(',')[1]?.trim() || locationData.state,
      phone: `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      website: `www.${prefix.toLowerCase().replace(/\s/g, '')}${industry.toLowerCase().replace(/[_\s]/g, '')}.com`,
      industry: industry
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      rating: segmentId === 'smb_local' ? Math.round((3.5 + Math.random() * 1.5) * 10) / 10 : undefined,
      reviewCount:
        segmentId === 'smb_local' ? Math.floor(Math.random() * 500) + 10 : undefined,
      provider,
      inSalesforce: Math.random() < 0.3, // ~30% chance
    });
  }

  return results;
}

export default function SegmentSearchPage() {
  const params = useParams();
  const router = useRouter();
  const segmentId = params.segment as string;

  const [config, setConfig] = useState<Config | null>(null);
  const [segment, setSegment] = useState<Segment | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sandboxMode, setSandboxMode] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [segmentId]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Failed to fetch configuration');
      const data: Config = await res.json();
      setConfig(data);

      // Find the current segment
      const foundSegment = data.segments.find((s) => s.id === segmentId);
      if (!foundSegment) {
        setError('Segment not found');
        return;
      }
      setSegment(foundSegment);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load segment');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (values: FormValues, testMode: boolean = false) => {
    if (!segment) return;

    setSearching(true);
    setSelectedIds(new Set());

    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // In sandbox/test mode, limit results to 3
      // In production, this would send test_mode: true to the API
      const numResults = testMode ? 3 : (Number(values.num_results) || 20);

      // Log the API request that would be made
      console.log('Search request:', {
        ...values,
        test_mode: testMode,
        num_results: numResults,
      });

      // Generate mock results
      const mockResults = generateMockResults(segmentId, values, numResults);
      setResults(mockResults);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedIds(new Set(results.map((r) => r.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    [results]
  );

  const handleGenerateBriefs = async () => {
    // Simulate Claygent API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log('Generating AI briefs for:', Array.from(selectedIds));
  };

  const handleExportCSV = () => {
    const selectedResults = results.filter((r) => selectedIds.has(r.id));
    const headers = ['Name', 'Address', 'City', 'State', 'Phone', 'Website', 'Industry'];
    const rows = selectedResults.map((r) => [
      r.name,
      r.address || '',
      r.city || '',
      r.state || '',
      r.phone || '',
      r.website || '',
      r.industry || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${segmentId}-prospects-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center space-x-4 mb-8">
          <div className="w-16 h-16 bg-mplc-gray-200 rounded-lg animate-pulse" />
          <div>
            <div className="h-6 bg-mplc-gray-200 rounded w-32 mb-2 animate-pulse" />
            <div className="h-4 bg-mplc-gray-100 rounded w-64 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="card p-6 animate-pulse">
            <div className="h-4 bg-mplc-gray-200 rounded w-24 mb-4" />
            <div className="space-y-4">
              <div className="h-10 bg-mplc-gray-100 rounded" />
              <div className="h-10 bg-mplc-gray-100 rounded" />
              <div className="h-10 bg-mplc-gray-100 rounded" />
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="h-64 bg-mplc-gray-100 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !segment) {
    return (
      <div className="p-8">
        <div className="card p-12 text-center">
          <div className="text-red-500 mb-4">{error || 'Segment not found'}</div>
          <Link href="/search" className="btn-secondary inline-flex items-center space-x-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Search</span>
          </Link>
        </div>
      </div>
    );
  }

  // Get provider names for display
  const primaryProviders = segment.providers.cascade
    .map((id) => config?.providers[id]?.name || id)
    .join(', ');
  const fallbackProviders =
    segment.providers.fallback_enabled && segment.providers.fallback
      ? segment.providers.fallback.map((id) => config?.providers[id]?.name || id).join(', ')
      : null;

  return (
    <div className="p-8 pb-24">
      {/* Header with back button */}
      <div className="mb-8">
        <Link
          href="/search"
          className="inline-flex items-center space-x-1 text-sm text-mplc-gray-500 hover:text-mplc-black mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to segments</span>
        </Link>

        <div className="flex items-start space-x-4">
          <div className="w-14 h-14 bg-mplc-black text-mplc-white rounded-lg flex items-center justify-center flex-shrink-0">
            {iconMap[segment.icon] || <Search className="w-7 h-7" />}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-mplc-black mb-1">
              {segment.display_name}
            </h1>
            <p className="text-mplc-gray-500">{segment.description}</p>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-mplc-gray-500">
                Provider: <span className="text-mplc-black font-medium">{primaryProviders}</span>
              </span>
              {fallbackProviders && (
                <span className="text-mplc-gray-500">
                  Fallback: <span className="text-mplc-black font-medium">{fallbackProviders}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content: Form + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Search Form Panel */}
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-24">
            <h2 className="font-semibold text-mplc-black mb-4">Search Criteria</h2>
            <SearchForm
              fields={segment.input_fields}
              segmentId={segment.id}
              onSearch={handleSearch}
              loading={searching}
              sandboxMode={sandboxMode}
              onSandboxModeChange={setSandboxMode}
            />

            {/* Info box */}
            <div className="mt-6 p-4 bg-mplc-gray-50 rounded-lg border border-mplc-gray-200">
              <div className="flex items-start space-x-2">
                <Info className="w-4 h-4 text-mplc-gray-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-mplc-gray-600">
                  <p className="font-medium text-mplc-gray-700 mb-1">About this segment</p>
                  <p>
                    Results are enriched using{' '}
                    <span className="font-medium">{primaryProviders}</span>
                    {fallbackProviders && (
                      <>
                        {' '}
                        with <span className="font-medium">{fallbackProviders}</span> as fallback
                      </>
                    )}
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-mplc-black">Search Results</h2>
              {results.length > 0 && (
                <span className="text-sm text-mplc-gray-500">
                  {results.length} results found
                </span>
              )}
            </div>

            <SearchResults
              results={results}
              selectedIds={selectedIds}
              onSelectResult={handleSelectResult}
              onSelectAll={handleSelectAll}
              loading={searching}
              sandboxMode={sandboxMode}
            />
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <BulkActions
        selectedCount={selectedIds.size}
        onGenerateBriefs={handleGenerateBriefs}
        onExportCSV={handleExportCSV}
      />
    </div>
  );
}
