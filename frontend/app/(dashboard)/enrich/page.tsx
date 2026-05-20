'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, Chip, PrimaryBtn, HowItWorksStrip } from '@/components/refyne';
import { LockedProviderChip } from '@/components/providers/LockedProviderChip';

// Full provider registry (all supported providers in the platform)
const PROVIDER_REGISTRY = [
  { key: 'apollo', label: 'Apollo' },
  { key: 'zoominfo', label: 'ZoomInfo' },
  { key: 'clearbit', label: 'Clearbit' },
  { key: 'hunter', label: 'Hunter' },
  { key: 'people-data-labs', label: 'People Data Labs' },
];

interface EnrichFilters {
  industries: string[];
  employeeMin: number;
  employeeMax: number;
  locations: string[];
  keywords: string;
}

interface EnrichResult {
  hubspot_company_id: string;
  name: string;
  domain: string;
  employee_count?: number;
  industry?: string;
  city?: string;
  state?: string;
  country?: string;
  enrichment_score: number;
  selected: boolean;
}

function MatchBar({ n }: { n: number }) {
  const col = n >= 80 ? C.green : n >= 65 ? C.amber : C.red;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ height: 3, width: 52, background: C.hover, borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${n}%`, background: col, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 10, fontFamily: F.mono, color: C.text3 }}>{n}</span>
    </div>
  );
}

export default function EnrichPage() {
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<EnrichFilters>({
    industries: [],
    employeeMin: 1,
    employeeMax: 10000,
    locations: [],
    keywords: '',
  });

  // Results state
  const [results, setResults] = useState<EnrichResult[]>([]);
  const [showIndustryPicker, setShowIndustryPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [industrySearch, setIndustrySearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const keywordsInputRef = useRef<HTMLInputElement>(null);

  // Available industries (TODO: fetch from harmony_reference_data or HubSpot)
  const availableIndustries = [
    'Healthcare',
    'Technology',
    'Software',
    'Behavioral Health',
    'Financial Services',
    'Manufacturing',
    'Retail',
    'Education',
    'Consulting',
  ];

  // Available locations
  const availableLocations = [
    'United States',
    'Canada',
    'United Kingdom',
    'California, United States',
    'New York, United States',
    'Texas, United States',
    'Florida, United States',
  ];

  // Fetch connected providers on mount
  useEffect(() => {
    async function fetchConnections() {
      try {
        const res = await fetch('/api/providers/connections');
        if (res.ok) {
          const data = await res.json();
          const providerKeys = data.connections.map((c: any) => c.provider);
          setConnectedProviders(providerKeys);
        }
      } catch (error) {
        console.error('Failed to fetch provider connections:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchConnections();
  }, []);

  // Handle search
  async function handleSearch() {
    if (selectedProviders.length === 0) {
      alert('Please select at least one provider');
      return;
    }

    setSearching(true);
    try {
      const response = await fetch('/api/enrich/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters,
          providers: selectedProviders,
        }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Enrich search error:', error);
      alert('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  // Clear all filters
  function clearFilters() {
    setFilters({
      industries: [],
      employeeMin: 1,
      employeeMax: 10000,
      locations: [],
      keywords: '',
    });
    setSelectedProviders([]);
    setResults([]);
  }

  // Toggle result selection
  function toggleResult(id: string) {
    setResults(prev => prev.map(r =>
      r.hubspot_company_id === id ? { ...r, selected: !r.selected } : r
    ));
  }

  // Get filtered industry/location lists
  const filteredIndustries = availableIndustries.filter(i =>
    i.toLowerCase().includes(industrySearch.toLowerCase())
  );
  const filteredLocations = availableLocations.filter(l =>
    l.toLowerCase().includes(locationSearch.toLowerCase())
  );

  const prospectingSteps = [
    {
      title: 'Set your ICP filters',
      description: 'Industry, size, location, keywords — search across connected providers.',
    },
    {
      title: 'Enrich and review',
      description: 'Refyne enriches each result with canonical data before it touches your CRM.',
    },
    {
      title: 'Push with confidence',
      description: 'Duplicate check runs automatically — records are blocked, quarantined, or pushed based on your org policy.',
    },
  ];

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: F.sans }}>
      {/* Filters sidebar */}
      <div style={{ width: 248, background: C.sidebar, borderRight: `1px solid ${C.border}`, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto', flexShrink: 0 }}>
        {/* Industry filter */}
        <div style={{ marginBottom: 22, position: 'relative' }}>
          <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 9 }}>Industry</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {filters.industries.map(industry => (
              <button
                key={industry}
                onClick={() => setFilters(prev => ({ ...prev, industries: prev.industries.filter(i => i !== industry) }))}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: C.indigoDim, color: C.indigoLt, borderRadius: 5, fontSize: 11, border: `1px solid ${C.indigoBrd}`, cursor: 'pointer' }}
              >
                {industry} <X size={9} />
              </button>
            ))}
            <button
              onClick={() => setShowIndustryPicker(!showIndustryPicker)}
              style={{ padding: '3px 7px', color: C.text3, fontSize: 11, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              + Add
            </button>
          </div>
          {showIndustryPicker && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 6, padding: 8, width: '100%', zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
              <input
                type="text"
                placeholder="Search industries..."
                value={industrySearch}
                onChange={(e) => setIndustrySearch(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 11, marginBottom: 6 }}
              />
              {filteredIndustries.map(industry => (
                <button
                  key={industry}
                  onClick={() => {
                    if (!filters.industries.includes(industry)) {
                      setFilters(prev => ({ ...prev, industries: [...prev.industries, industry] }));
                    }
                    setShowIndustryPicker(false);
                    setIndustrySearch('');
                  }}
                  style={{ display: 'block', width: '100%', padding: '6px 8px', background: 'none', border: 'none', color: C.text2, fontSize: 11, textAlign: 'left', cursor: 'pointer', borderRadius: 4 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = C.hover}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  {industry}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Company size filter */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 9 }}>
            Company size
            <span style={{ marginLeft: 8, color: C.text2, fontWeight: 400 }}>
              {filters.employeeMin}-{filters.employeeMax}
            </span>
          </div>
          <div style={{ margin: '10px 0' }}>
            <input
              type="range"
              min="1"
              max="10000"
              step="10"
              value={filters.employeeMin}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val < filters.employeeMax) {
                  setFilters(prev => ({ ...prev, employeeMin: val }));
                }
              }}
              style={{ width: '100%', marginBottom: 4 }}
            />
            <input
              type="range"
              min="1"
              max="10000"
              step="10"
              value={filters.employeeMax}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val > filters.employeeMin) {
                  setFilters(prev => ({ ...prev, employeeMax: val }));
                }
              }}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              type="number"
              value={filters.employeeMin}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val < filters.employeeMax && val >= 1) {
                  setFilters(prev => ({ ...prev, employeeMin: val }));
                }
              }}
              style={{ width: '100%', padding: '4px 6px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 11 }}
              placeholder="Min"
            />
            <input
              type="number"
              value={filters.employeeMax}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val > filters.employeeMin && val <= 10000) {
                  setFilters(prev => ({ ...prev, employeeMax: val }));
                }
              }}
              style={{ width: '100%', padding: '4px 6px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 11 }}
              placeholder="Max"
            />
          </div>
        </div>

        {/* Location filter */}
        <div style={{ marginBottom: 22, position: 'relative' }}>
          <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 9 }}>Location</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {filters.locations.map(location => (
              <button
                key={location}
                onClick={() => setFilters(prev => ({ ...prev, locations: prev.locations.filter(l => l !== location) }))}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: C.indigoDim, color: C.indigoLt, borderRadius: 5, fontSize: 11, border: `1px solid ${C.indigoBrd}`, cursor: 'pointer' }}
              >
                {location} <X size={9} />
              </button>
            ))}
            <button
              onClick={() => setShowLocationPicker(!showLocationPicker)}
              style={{ padding: '3px 7px', color: C.text3, fontSize: 11, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              + Add
            </button>
          </div>
          {showLocationPicker && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 6, padding: 8, width: '100%', zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
              <input
                type="text"
                placeholder="Search locations..."
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 11, marginBottom: 6 }}
              />
              {filteredLocations.map(location => (
                <button
                  key={location}
                  onClick={() => {
                    if (!filters.locations.includes(location)) {
                      setFilters(prev => ({ ...prev, locations: [...prev.locations, location] }));
                    }
                    setShowLocationPicker(false);
                    setLocationSearch('');
                  }}
                  style={{ display: 'block', width: '100%', padding: '6px 8px', background: 'none', border: 'none', color: C.text2, fontSize: 11, textAlign: 'left', cursor: 'pointer', borderRadius: 4 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = C.hover}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  {location}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Provider filter - dynamic */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 9 }}>Provider</div>
          {loading ? (
            <div style={{ fontSize: 11, color: C.text3 }}>Loading...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Connected providers - selectable */}
              {PROVIDER_REGISTRY.filter(p => connectedProviders.includes(p.key)).map(provider => {
                const isSelected = selectedProviders.includes(provider.key);
                return (
                  <button
                    key={provider.key}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedProviders(prev => prev.filter(k => k !== provider.key));
                      } else {
                        setSelectedProviders(prev => [...prev, provider.key]);
                      }
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      background: isSelected ? C.indigoDim : C.surface,
                      color: isSelected ? C.indigoLt : C.text2,
                      borderRadius: 5,
                      fontSize: 11,
                      border: `1px solid ${isSelected ? C.indigoBrd : C.border2}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {provider.label}
                    {isSelected && <X size={9} />}
                  </button>
                );
              })}

              {/* Locked providers */}
              {PROVIDER_REGISTRY.filter(p => !connectedProviders.includes(p.key)).map(provider => (
                <LockedProviderChip
                  key={provider.key}
                  provider={provider.key}
                  providerLabel={provider.label}
                  currentPath="/enrich"
                />
              ))}
            </div>
          )}
        </div>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 9 }}>Keywords</div>
          <input
            ref={keywordsInputRef}
            type="text"
            value={filters.keywords}
            onChange={(e) => setFilters(prev => ({ ...prev, keywords: e.target.value }))}
            placeholder="ABA therapy, autism services..."
            style={{ width: '100%', background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 7, padding: '7px 10px', fontSize: 12, color: C.text, outline: 'none' }}
            onFocus={(e) => e.target.style.borderColor = C.indigoBrd}
            onBlur={(e) => e.target.style.borderColor = C.border2}
          />
        </div>
        <PrimaryBtn onClick={handleSearch} disabled={searching}>
          {searching ? 'Searching...' : 'Search'}
        </PrimaryBtn>
        <button
          onClick={clearFilters}
          style={{ marginTop: 8, fontSize: 12, color: C.text3, padding: '6px 0', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Clear filters
        </button>
      </div>

      {/* Results area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: C.text2 }}>{results.length} results</span>
            {results.filter(r => r.selected).length > 0 && (
              <>
                <span style={{ fontSize: 11, color: C.text3 }}>·</span>
                <Chip color="indigo">{results.filter(r => r.selected).length} selected</Chip>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', border: `1px solid ${C.border2}`, borderRadius: 6, overflow: 'hidden' }}>
              {(['table', 'grid'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{ padding: '4px 10px', fontSize: 11, background: view === v ? C.hover : 'transparent', color: view === v ? C.text : C.text3, borderRight: v === 'table' ? `1px solid ${C.border2}` : 'none', border: 'none', cursor: 'pointer' }}>{v}</button>
              ))}
            </div>
            <PrimaryBtn disabled={results.filter(r => r.selected).length === 0}>
              <Plus size={11} /> Enrich selected
            </PrimaryBtn>
          </div>
        </div>
        <div style={{ padding: '20px 20px 0 20px' }}>
          <HowItWorksStrip steps={prospectingSteps} storageKey="how-it-works-prospecting" />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.text3 }}>
              <p style={{ fontSize: 14, marginBottom: 8 }}>No results yet</p>
              <p style={{ fontSize: 12 }}>Set filters and click Search to find companies to enrich</p>
            </div>
          ) : view === 'table' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: F.sans }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['', 'Company', 'Domain', 'Size', 'Match'].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', color: C.text3, fontSize: 11, fontWeight: 500, letterSpacing: '0.03em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.hubspot_company_id} style={{ borderBottom: `1px solid ${C.border}`, background: r.selected ? C.indigoDim : 'transparent' }}>
                    <td style={{ padding: '11px 20px' }}>
                      <button
                        onClick={() => toggleResult(r.hubspot_company_id)}
                        style={{ width: 14, height: 14, borderRadius: 4, background: r.selected ? C.indigo : 'transparent', border: `1px solid ${r.selected ? C.indigo : C.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                      >
                        {r.selected && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                      </button>
                    </td>
                    <td style={{ padding: '11px 20px', color: C.text, fontWeight: 500 }}>{r.name}</td>
                    <td style={{ padding: '11px 20px', fontFamily: F.mono, color: C.text2, fontSize: 11 }}>{r.domain || '—'}</td>
                    <td style={{ padding: '11px 20px', fontFamily: F.mono, color: C.text2 }}>{r.employee_count || '—'}</td>
                    <td style={{ padding: '11px 20px' }}><MatchBar n={r.enrichment_score} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {results.map((r) => (
                <div
                  key={r.hubspot_company_id}
                  onClick={() => toggleResult(r.hubspot_company_id)}
                  style={{ cursor: 'pointer' }}
                >
                  <Card style={{ padding: '14px 16px', border: `1px solid ${r.selected ? C.indigoBrd : C.border}`, background: r.selected ? C.indigoDim : C.surface }}>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 4, letterSpacing: '-0.01em' }}>{r.name}</div>
                    <div style={{ fontSize: 11, fontFamily: F.mono, color: C.text3, marginBottom: 2 }}>{r.domain || '—'}</div>
                    <div style={{ fontSize: 11, color: C.text3, marginBottom: 10 }}>{r.employee_count ? `${r.employee_count} employees` : 'Size unknown'}</div>
                    <MatchBar n={r.enrichment_score} />
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
