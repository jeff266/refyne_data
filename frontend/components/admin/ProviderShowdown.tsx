'use client';

import { useState } from 'react';
import { Swords, Play, Trophy, BarChart3, Check, X, Minus, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface Provider {
  name: string;
  type: string;
  env_key?: string;
  env_keys?: string[];
}

interface ShowdownResult {
  provider: string;
  responseTimeMs: number;
  resultCount: number;
  fillRates: Record<string, number>;
  overallFillRate: number;
  sampleResults: Record<string, any>[];
  error?: string;
}

interface FieldComparison {
  field: string;
  label: string;
  providers: Record<string, { value: any; filled: boolean }>;
  winner?: string;
}

interface ProviderShowdownProps {
  providers: Record<string, Provider>;
}

// Mock function - in production this would call the API
async function runShowdown(
  providerIds: string[],
  testQuery: { term: string; location: string }
): Promise<ShowdownResult[]> {
  // Simulate API calls to each provider
  await new Promise(r => setTimeout(r, 1500));

  const mockResults: Record<string, ShowdownResult> = {
    yelp: {
      provider: 'yelp',
      responseTimeMs: 450,
      resultCount: 18,
      overallFillRate: 0.85,
      fillRates: {
        name: 1.0,
        phone: 0.94,
        address: 1.0,
        rating: 1.0,
        website: 0.0,
        hours: 0.72,
      },
      sampleResults: [
        { name: 'Fitness Plus Gym', phone: '(512) 555-0123', address: '123 Main St, Austin, TX', rating: 4.5, hours: 'Mon-Fri 5am-10pm', website: null },
        { name: 'Downtown CrossFit', phone: '(512) 555-0456', address: '456 Congress Ave, Austin, TX', rating: 4.8, hours: 'Mon-Sat 6am-9pm', website: null },
        { name: 'Austin Yoga Studio', phone: '(512) 555-0789', address: '789 S Lamar Blvd, Austin, TX', rating: 4.3, hours: null, website: null },
      ],
    },
    serper: {
      provider: 'serper',
      responseTimeMs: 320,
      resultCount: 20,
      overallFillRate: 0.78,
      fillRates: {
        name: 1.0,
        phone: 0.85,
        address: 1.0,
        rating: 0.95,
        website: 0.70,
        hours: 0.40,
      },
      sampleResults: [
        { name: 'Fitness Plus Gym', phone: '(512) 555-0123', address: '123 Main St, Austin, TX 78701', rating: 4.4, website: 'fitnessplusgym.com', hours: null },
        { name: 'CrossFit Downtown Austin', phone: null, address: '456 Congress Ave, Austin, TX', rating: 4.7, website: 'crossfitdtx.com', hours: 'Open 24 hours' },
        { name: 'Austin Yoga & Wellness', phone: '(512) 555-0789', address: '789 S Lamar Blvd, Austin, TX', rating: 4.5, website: 'austinyoga.com', hours: null },
      ],
    },
    graphiq: {
      provider: 'graphiq',
      responseTimeMs: 650,
      resultCount: 12,
      overallFillRate: 0.65,
      fillRates: {
        name: 1.0,
        phone: 0.58,
        address: 0.75,
        rating: 0.0,
        website: 0.83,
        hours: 0.0,
      },
      sampleResults: [
        { name: 'Fitness Plus LLC', phone: '(512) 555-0123', address: '123 Main St, Austin, TX', rating: null, website: 'fitnessplusgym.com', hours: null },
        { name: 'Downtown CrossFit Inc', phone: null, address: null, rating: null, website: 'crossfitdtx.com', hours: null },
      ],
    },
  };

  return providerIds.map(id => mockResults[id] || {
    provider: id,
    responseTimeMs: 0,
    resultCount: 0,
    overallFillRate: 0,
    fillRates: {},
    sampleResults: [],
    error: 'Provider not configured',
  });
}

export default function ProviderShowdown({ providers }: ProviderShowdownProps) {
  const [selectedProviders, setSelectedProviders] = useState<string[]>(['yelp', 'serper']);
  const [testQuery, setTestQuery] = useState({ term: 'fitness centers', location: 'Austin, TX' });
  const [results, setResults] = useState<ShowdownResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedRecord, setExpandedRecord] = useState<number | null>(null);

  const availableProviders = Object.entries(providers).filter(
    ([id]) => ['yelp', 'serper', 'graphiq', 'apollo'].includes(id)
  );

  const toggleProvider = (id: string) => {
    if (selectedProviders.includes(id)) {
      setSelectedProviders(selectedProviders.filter(p => p !== id));
    } else if (selectedProviders.length < 4) {
      setSelectedProviders([...selectedProviders, id]);
    }
  };

  const runTest = async () => {
    if (selectedProviders.length < 2) return;

    setLoading(true);
    setResults(null);

    try {
      const showdownResults = await runShowdown(selectedProviders, testQuery);
      setResults(showdownResults);
    } catch (error) {
      console.error('Showdown failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate winners for each field
  const getFieldWinners = (): Record<string, string> => {
    if (!results) return {};

    const winners: Record<string, string> = {};
    const fields = ['name', 'phone', 'address', 'rating', 'website', 'hours'];

    for (const field of fields) {
      let bestProvider = '';
      let bestRate = 0;

      for (const result of results) {
        const rate = result.fillRates[field] || 0;
        if (rate > bestRate) {
          bestRate = rate;
          bestProvider = result.provider;
        }
      }

      if (bestRate > 0) {
        winners[field] = bestProvider;
      }
    }

    return winners;
  };

  // Get overall winner
  const getOverallWinner = (): string | null => {
    if (!results || results.length === 0) return null;

    let bestProvider = results[0].provider;
    let bestScore = 0;

    for (const result of results) {
      // Score = fill rate * 0.6 + speed * 0.2 + coverage * 0.2
      const speedScore = Math.max(0, 1 - (result.responseTimeMs / 1000));
      const coverageScore = Math.min(result.resultCount / 20, 1);
      const score = result.overallFillRate * 0.6 + speedScore * 0.2 + coverageScore * 0.2;

      if (score > bestScore) {
        bestScore = score;
        bestProvider = result.provider;
      }
    }

    return bestProvider;
  };

  const fieldWinners = getFieldWinners();
  const overallWinner = getOverallWinner();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
          <Swords size={20} className="text-white" />
        </div>
        <div>
          <h3 className="font-medium text-gray-900">Provider Showdown</h3>
          <p className="text-sm text-gray-500">Compare data quality across providers</p>
        </div>
      </div>

      {/* Provider Selection */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Providers to Compare (2-4)
          </label>
          <div className="flex flex-wrap gap-2">
            {availableProviders.map(([id, provider]) => {
              const isSelected = selectedProviders.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleProvider(id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-black text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {provider.name}
                  {isSelected && <span className="ml-2">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Test Query */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Term</label>
            <input
              type="text"
              value={testQuery.term}
              onChange={(e) => setTestQuery({ ...testQuery, term: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="e.g., fitness centers"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={testQuery.location}
              onChange={(e) => setTestQuery({ ...testQuery, location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="e.g., Austin, TX"
            />
          </div>
        </div>

        {/* Run Button */}
        <button
          onClick={runTest}
          disabled={selectedProviders.length < 2 || loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              Running Showdown...
            </>
          ) : (
            <>
              <Play size={18} />
              Run Provider Showdown
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* Winner Banner */}
          {overallWinner && (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <Trophy size={24} className="text-amber-600" />
              </div>
              <div>
                <div className="text-sm text-amber-600 font-medium">Best Overall Data Quality</div>
                <div className="text-xl font-bold text-amber-900">
                  {providers[overallWinner]?.name || overallWinner}
                </div>
              </div>
            </div>
          )}

          {/* Comparison Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <BarChart3 size={18} className="text-gray-500" />
              <h4 className="font-medium text-gray-900">Field Coverage Comparison</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metric</th>
                    {results.map(r => (
                      <th key={r.provider} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        {providers[r.provider]?.name || r.provider}
                        {r.provider === overallWinner && (
                          <Trophy size={12} className="inline ml-1 text-amber-500" />
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Response Time */}
                  <tr className="border-b border-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">Response Time</td>
                    {results.map(r => {
                      const isFastest = r.responseTimeMs === Math.min(...results.map(x => x.responseTimeMs));
                      return (
                        <td key={r.provider} className="px-4 py-3 text-center">
                          <span className={`text-sm font-medium ${isFastest ? 'text-green-600' : 'text-gray-700'}`}>
                            {r.responseTimeMs}ms
                          </span>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Result Count */}
                  <tr className="border-b border-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">Results Found</td>
                    {results.map(r => {
                      const isMost = r.resultCount === Math.max(...results.map(x => x.resultCount));
                      return (
                        <td key={r.provider} className="px-4 py-3 text-center">
                          <span className={`text-sm font-medium ${isMost ? 'text-green-600' : 'text-gray-700'}`}>
                            {r.resultCount}
                          </span>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Overall Fill Rate */}
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Overall Fill Rate</td>
                    {results.map(r => {
                      const isBest = r.overallFillRate === Math.max(...results.map(x => x.overallFillRate));
                      return (
                        <td key={r.provider} className="px-4 py-3 text-center">
                          <span className={`text-sm font-bold ${isBest ? 'text-green-600' : 'text-gray-700'}`}>
                            {(r.overallFillRate * 100).toFixed(0)}%
                          </span>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Individual Fields */}
                  {['name', 'phone', 'address', 'rating', 'website', 'hours'].map(field => (
                    <tr key={field} className="border-b border-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{field}</td>
                      {results.map(r => {
                        const rate = r.fillRates[field] || 0;
                        const isWinner = fieldWinners[field] === r.provider && rate > 0;
                        return (
                          <td key={r.provider} className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${isWinner ? 'bg-green-500' : 'bg-gray-400'}`}
                                  style={{ width: `${rate * 100}%` }}
                                />
                              </div>
                              <span className={`text-xs ${isWinner ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                                {(rate * 100).toFixed(0)}%
                              </span>
                              {isWinner && <Trophy size={12} className="text-amber-500" />}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sample Data Comparison */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h4 className="font-medium text-gray-900">Sample Record Comparison</h4>
              <p className="text-xs text-gray-500 mt-0.5">Same business from different providers</p>
            </div>
            <div className="p-4">
              {[0, 1, 2].map(idx => {
                const hasData = results.some(r => r.sampleResults[idx]);
                if (!hasData) return null;

                return (
                  <div key={idx} className="mb-4 last:mb-0">
                    <button
                      onClick={() => setExpandedRecord(expandedRecord === idx ? null : idx)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-900">
                        {results[0].sampleResults[idx]?.name || `Record ${idx + 1}`}
                      </span>
                      {expandedRecord === idx ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {expandedRecord === idx && (
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Field</th>
                              {results.map(r => (
                                <th key={r.provider} className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                                  {providers[r.provider]?.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {['name', 'phone', 'address', 'rating', 'website', 'hours'].map(field => (
                              <tr key={field} className="border-b border-gray-50">
                                <td className="px-3 py-2 text-gray-600 capitalize">{field}</td>
                                {results.map(r => {
                                  const value = r.sampleResults[idx]?.[field];
                                  const hasValue = value !== null && value !== undefined && value !== '';
                                  return (
                                    <td key={r.provider} className="px-3 py-2">
                                      {hasValue ? (
                                        <span className="text-gray-900">{String(value)}</span>
                                      ) : (
                                        <span className="text-gray-300 italic">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="font-medium text-blue-900 mb-2">Recommendations</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              {overallWinner && (
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 text-blue-600 flex-shrink-0" />
                  <span>
                    Use <strong>{providers[overallWinner]?.name}</strong> as your primary provider for this segment
                  </span>
                </li>
              )}
              {fieldWinners.website && fieldWinners.website !== overallWinner && (
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 text-blue-600 flex-shrink-0" />
                  <span>
                    Add <strong>{providers[fieldWinners.website]?.name}</strong> as fallback for website URLs
                  </span>
                </li>
              )}
              <li className="flex items-start gap-2">
                <Check size={16} className="mt-0.5 text-blue-600 flex-shrink-0" />
                <span>
                  Consider combining providers - no single provider has 100% coverage
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
