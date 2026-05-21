/**
 * Prospect Page - Complete Rebuild
 *
 * Company discovery and ICP scoring interface with:
 * - Dark-styled chip inputs for industries, locations, keywords
 * - Range slider for employee size
 * - Saved searches functionality
 * - ICP scoring with visual bars
 * - Company detail slide-over
 * - Multi-select with Push to HubSpot
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { C } from '@/lib/design-tokens';
import { ProspectSearchQuery, ProspectSearchResult } from '@/lib/prospect/types';

const darkInputStyle = {
  background: 'transparent',
  border: 'none',
  color: '#F9F8F5',
  fontFamily: 'Jost, system-ui',
  fontSize: '13px',
  padding: '8px 0',
  borderRadius: 0,
  outline: 'none',
};

export default function ProspectPage() {
  const [searchQuery, setSearchQuery] = useState<ProspectSearchQuery>({
    limit: 25,
    providers: ['apollo'],
    employeeMin: 10,
    employeeMax: 500,
  });
  const [results, setResults] = useState<ProspectSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [excludeInHubSpot, setExcludeInHubSpot] = useState(true);
  const [detailCompany, setDetailCompany] = useState<ProspectSearchResult | null>(null);

  // Fetch saved searches on mount
  useEffect(() => {
    fetchSavedSearches();
  }, []);

  async function fetchSavedSearches() {
    try {
      const response = await fetch('/api/prospect/saved-searches');
      if (response.ok) {
        const data = await response.json();
        setSavedSearches(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch saved searches:', err);
    }
  }

  async function handleSearch() {
    setLoading(true);
    setError(null);

    try {
      // Build ICP config from search query
      const icpConfig = {
        target_industries: searchQuery.industries,
        target_employee_min: searchQuery.employeeMin,
        target_employee_max: searchQuery.employeeMax,
        target_locations: searchQuery.locations
          ? {
              countries: searchQuery.locations,
            }
          : undefined,
      };

      const response = await fetch('/api/prospect/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          icp_config: icpConfig,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Search failed');
      }

      const data = await response.json();
      let allResults = data.data.results || [];

      // Filter out companies in HubSpot if checkbox is checked
      if (excludeInHubSpot) {
        allResults = allResults.filter((r: ProspectSearchResult) => !r.in_crm);
      }

      setResults(allResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSearch() {
    const name = prompt('Name this search:');
    if (!name) return;

    try {
      const response = await fetch('/api/prospect/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          filters: searchQuery,
          scope: 'personal',
        }),
      });

      if (response.ok) {
        await fetchSavedSearches();
        alert('Search saved successfully');
      }
    } catch (err) {
      console.error('Failed to save search:', err);
      alert('Failed to save search');
    }
  }

  async function handleLoadSearch(search: any) {
    setSearchQuery(search.filters);
    await handleSearch();
  }

  async function handleDeleteSearch(id: string) {
    if (!confirm('Delete this saved search?')) return;

    try {
      const response = await fetch(`/api/prospect/saved-searches/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchSavedSearches();
      }
    } catch (err) {
      console.error('Failed to delete search:', err);
    }
  }

  function toggleCompany(domain: string) {
    const newSelected = new Set(selectedCompanies);
    if (newSelected.has(domain)) {
      newSelected.delete(domain);
    } else {
      newSelected.add(domain);
    }
    setSelectedCompanies(newSelected);
  }

  function selectAll() {
    const newSelected = new Set(selectedCompanies);
    results.forEach((r) => newSelected.add(r.domain));
    setSelectedCompanies(newSelected);
  }

  function deselectAll() {
    setSelectedCompanies(new Set());
  }

  async function handlePush() {
    const selected = results.filter((r) => selectedCompanies.has(r.domain));

    if (selected.length === 0) {
      alert('No companies selected');
      return;
    }

    alert(
      `Push functionality: Would push ${selected.length} companies to HubSpot.\n\n` +
        'Implementation pending in /api/prospect/push endpoint.'
    );
  }

  const canSearch =
    (searchQuery.industries && searchQuery.industries.length > 0) ||
    (searchQuery.keywords && searchQuery.keywords.length > 0) ||
    (searchQuery.locations && searchQuery.locations.length > 0);

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4, color: C.text }}>
            Prospect
          </h1>
          <p style={{ color: C.text2, fontSize: 14 }}>
            Discover and score companies from enrichment providers
          </p>
        </div>
      </div>

      {/* Saved Searches Bar */}
      {savedSearches.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.text3, marginBottom: 8 }}>SAVED SEARCHES</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {savedSearches.map((search) => (
              <SavedSearchChip
                key={search.id}
                search={search}
                onLoad={() => handleLoadSearch(search)}
                onDelete={() => handleDeleteSearch(search.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ICP Filter Bar */}
      <div
        style={{
          background: '#162944',
          border: `1px solid ${C.border}`,
          borderRadius: 0,
          padding: 20,
          marginBottom: 16,
        }}
      >
        {/* Row 1: Industries (full width) */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              marginBottom: 8,
              color: C.text3,
              letterSpacing: '0.5px',
            }}
          >
            INDUSTRIES
          </label>
          <ChipInput
            values={searchQuery.industries || []}
            onChange={(industries) => setSearchQuery({ ...searchQuery, industries })}
            placeholder="Type industry, press Enter to add"
          />
        </div>

        {/* Row 2: Employee Size | Location */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
          {/* Employee Size */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                marginBottom: 8,
                color: C.text3,
                letterSpacing: '0.5px',
              }}
            >
              EMPLOYEE SIZE
            </label>
            <DualHandleRangeSlider
              min={searchQuery.employeeMin || 10}
              max={searchQuery.employeeMax || 500}
              onChange={(min, max) =>
                setSearchQuery({
                  ...searchQuery,
                  employeeMin: min,
                  employeeMax: max,
                })
              }
            />
          </div>

          {/* Location */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                marginBottom: 8,
                color: C.text3,
                letterSpacing: '0.5px',
              }}
            >
              LOCATION
            </label>
            <ChipInput
              values={searchQuery.locations || []}
              onChange={(locations) => setSearchQuery({ ...searchQuery, locations })}
              placeholder="Type location, press Enter to add"
            />
          </div>
        </div>

        {/* Row 3: Keywords (full width) */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              marginBottom: 8,
              color: C.text3,
              letterSpacing: '0.5px',
            }}
          >
            KEYWORDS
          </label>
          <ChipInput
            values={searchQuery.keywords || []}
            onChange={(keywords) => setSearchQuery({ ...searchQuery, keywords })}
            placeholder="Type keyword, press Enter to add"
          />
        </div>

        {/* Row 4: More filters | Provider pills | Exclude checkbox | Search button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* More filters button - placeholder */}
            <button
              style={{
                background: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: 0,
                padding: '6px 12px',
                fontSize: 12,
                color: C.text2,
                cursor: 'pointer',
              }}
            >
              ▶ More filters
            </button>

            {/* Provider pills */}
            <ProviderPills />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Exclude in HubSpot checkbox */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={excludeInHubSpot}
                onChange={(e) => setExcludeInHubSpot(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12, color: C.text3, whiteSpace: 'nowrap' }}>
                Exclude in HubSpot
              </span>
            </label>

            {/* Search button */}
            <button
              onClick={handleSearch}
              disabled={loading || !canSearch}
              style={{
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                borderRadius: 0,
                background: loading || !canSearch ? C.text3 : C.indigo,
                color: 'white',
                cursor: loading || !canSearch ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: C.redDim,
            border: `1px solid ${C.redBrd}`,
            borderRadius: 8,
            color: C.red,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div>
          {/* Results header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 14, color: C.text2 }}>
              {results.length} companies found
              {selectedCompanies.size > 0 && ` • ${selectedCompanies.size} selected`}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={selectAll}
                style={{
                  padding: '6px 12px',
                  fontSize: 13,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  background: C.surface,
                  color: C.text,
                  cursor: 'pointer',
                }}
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                style={{
                  padding: '6px 12px',
                  fontSize: 13,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  background: C.surface,
                  color: C.text,
                  cursor: 'pointer',
                }}
              >
                Deselect All
              </button>
              <button
                onClick={handlePush}
                disabled={selectedCompanies.size === 0}
                style={{
                  padding: '6px 16px',
                  fontSize: 13,
                  border: 'none',
                  borderRadius: 6,
                  background: selectedCompanies.size > 0 ? C.indigo : C.text3,
                  color: 'white',
                  cursor: selectedCompanies.size > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                Push to HubSpot ({selectedCompanies.size})
              </button>
            </div>
          </div>

          {/* Results table */}
          <ResultsTable
            results={results}
            selectedCompanies={selectedCompanies}
            onToggle={toggleCompany}
            onShowDetail={setDetailCompany}
          />
        </div>
      )}

      {/* Company Detail Slide-Over */}
      {detailCompany && (
        <CompanyDetailSlideOver
          company={detailCompany}
          onClose={() => setDetailCompany(null)}
        />
      )}
    </div>
  );
}

/**
 * Chip input component for multi-select
 * Container is transparent with no border - only chips have borders
 */
function ChipInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = input.trim();
      if (value && !values.includes(value)) {
        onChange([...values, value]);
      }
      setInput('');
    } else if (e.key === 'Backspace' && !input && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  function removeChip(value: string) {
    onChange(values.filter((v) => v !== value));
  }

  return (
    <div
      style={{
        background: 'transparent',
        border: 'none',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: '8px 0',
        minHeight: '36px',
      }}
    >
      {values.map((value) => (
        <div
          key={value}
          style={{
            background: 'rgba(46,107,168,0.15)',
            border: '0.5px solid rgba(46,107,168,0.3)',
            color: C.indigoLt,
            padding: '4px 10px',
            borderRadius: 0,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {value}
          <button
            onClick={() => removeChip(value)}
            style={{
              background: 'none',
              border: 'none',
              color: C.indigoLt,
              cursor: 'pointer',
              padding: 0,
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={values.length === 0 ? placeholder : ''}
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: C.text,
          fontSize: 13,
          flex: 1,
          minWidth: '120px',
          fontFamily: 'Jost, system-ui',
        }}
      />
    </div>
  );
}

/**
 * Range slider component
 */
function RangeSlider({
  min,
  max,
  onChange,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="number"
          value={min}
          onChange={(e) => onChange(Number(e.target.value), max)}
          style={{
            ...darkInputStyle,
            width: '100px',
          }}
        />
        <span style={{ color: C.text3 }}>to</span>
        <input
          type="number"
          value={max}
          onChange={(e) => onChange(min, Number(e.target.value))}
          style={{
            ...darkInputStyle,
            width: '100px',
          }}
        />
      </div>
    </div>
  );
}

/**
 * Saved search chip
 */
function SavedSearchChip({
  search,
  onLoad,
  onDelete,
}: {
  search: any;
  onLoad: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
      }}
    >
      <button
        onClick={onLoad}
        style={{
          background: 'none',
          border: 'none',
          color: C.text,
          cursor: 'pointer',
          padding: 0,
          fontSize: 13,
        }}
      >
        {search.name}
      </button>
      <button
        onClick={onDelete}
        style={{
          background: 'none',
          border: 'none',
          color: C.text3,
          cursor: 'pointer',
          padding: 0,
          fontSize: 14,
        }}
      >
        ×
      </button>
    </div>
  );
}

/**
 * Results table
 */
function ResultsTable({
  results,
  selectedCompanies,
  onToggle,
  onShowDetail,
}: {
  results: ProspectSearchResult[];
  selectedCompanies: Set<string>;
  onToggle: (domain: string) => void;
  onShowDetail: (company: ProspectSearchResult) => void;
}) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: C.sidebar, borderBottom: `1px solid ${C.border}` }}>
            <th style={{ padding: 12, textAlign: 'left', width: 40 }}></th>
            <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600 }}>
              Company
            </th>
            <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600 }}>
              Industry
            </th>
            <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600 }}>
              Size
            </th>
            <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600 }}>
              Location
            </th>
            <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600 }}>
              ICP Score
            </th>
          </tr>
        </thead>
        <tbody>
          {results.map((company) => (
            <tr
              key={company.domain}
              style={{
                borderBottom: `1px solid ${C.border}`,
                background: selectedCompanies.has(company.domain) ? C.indigoDim : C.surface,
                cursor: 'pointer',
              }}
              onClick={() => onShowDetail(company)}
            >
              <td
                style={{ padding: 12 }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selectedCompanies.has(company.domain)}
                  onChange={() => onToggle(company.domain)}
                  style={{ cursor: 'pointer' }}
                />
              </td>
              <td style={{ padding: 12 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: C.text }}>{company.name}</div>
                <div style={{ color: C.text3, fontSize: 12 }}>{company.domain}</div>
              </td>
              <td style={{ padding: 12, fontSize: 13, color: C.text2 }}>
                {company.industry || '—'}
              </td>
              <td style={{ padding: 12, fontSize: 13, color: C.text2 }}>
                {company.employee_count ? `${company.employee_count}` : '—'}
              </td>
              <td style={{ padding: 12, fontSize: 13, color: C.text2 }}>
                {[company.city, company.state, company.country].filter(Boolean).join(', ') || '—'}
              </td>
              <td style={{ padding: 12 }}>
                <ICPScoreBar score={company.icp_score || 0} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * ICP Score Bar
 */
function ICPScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? C.green : score >= 60 ? C.amber : C.red;
  const bgColor = score >= 80 ? C.greenDim : score >= 60 ? C.amberDim : C.redDim;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 8,
          background: bgColor,
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: '100%',
            background: color,
          }}
        />
      </div>
      <span style={{ fontSize: 13, color, fontWeight: 600, minWidth: 35 }}>{score}</span>
    </div>
  );
}

/**
 * Company Detail Slide-Over
 */
function CompanyDetailSlideOver({
  company,
  onClose,
}: {
  company: ProspectSearchResult;
  onClose: () => void;
}) {
  const breakdown = calculateICPBreakdown(company);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '500px',
        background: C.surface,
        borderLeft: `1px solid ${C.border}`,
        zIndex: 1000,
        overflowY: 'auto',
        padding: 24,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4, color: C.text }}>
              {company.name}
            </h2>
            <p style={{ color: C.text3, fontSize: 13 }}>{company.domain}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: C.text3,
              cursor: 'pointer',
              fontSize: 24,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* ICP Score Section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: C.text3, marginBottom: 8 }}>ICP SCORE</div>
        <div style={{ fontSize: 32, fontWeight: 600, color: C.text, marginBottom: 16 }}>
          {company.icp_score || 0}
        </div>
        <ICPScoreBar score={company.icp_score || 0} />
      </div>

      {/* Score Breakdown */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: C.text3, marginBottom: 12 }}>SCORE BREAKDOWN</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {breakdown.map((item) => (
            <div key={item.label}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                  fontSize: 13,
                }}
              >
                <span style={{ color: C.text2 }}>{item.label}</span>
                <span style={{ color: C.text, fontWeight: 600 }}>{item.score}</span>
              </div>
              <div
                style={{
                  height: 6,
                  background: C.hover,
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${(item.score / item.max) * 100}%`,
                    height: '100%',
                    background: C.indigo,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Company Details */}
      <div>
        <div style={{ fontSize: 12, color: C.text3, marginBottom: 12 }}>DETAILS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <DetailRow label="Industry" value={company.industry || '—'} />
          <DetailRow label="Employees" value={company.employee_count?.toString() || '—'} />
          <DetailRow
            label="Location"
            value={[company.city, company.state, company.country].filter(Boolean).join(', ') || '—'}
          />
          <DetailRow label="Website" value={company.website || '—'} />
          <DetailRow label="LinkedIn" value={company.linkedin_url || '—'} />
          {company.description && (
            <div>
              <div style={{ fontSize: 13, color: C.text3, marginBottom: 4 }}>Description</div>
              <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.5 }}>
                {company.description}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: C.text }}>{value}</div>
    </div>
  );
}

/**
 * Calculate ICP score breakdown for a company
 */
function calculateICPBreakdown(company: ProspectSearchResult) {
  const breakdown = [
    { label: 'Industry Match', score: 0, max: 35 },
    { label: 'Size Range', score: 0, max: 25 },
    { label: 'Location Match', score: 0, max: 20 },
    { label: 'Keywords', score: 0, max: 15 },
    { label: 'Quality Signals', score: 0, max: 10 },
  ];

  // Use actual breakdown if available
  if (company.icp_breakdown) {
    breakdown[0].score = company.icp_breakdown.industry_match || 0;
    breakdown[1].score = company.icp_breakdown.size_match || 0;
    breakdown[2].score = company.icp_breakdown.location_match || 0;
    breakdown[3].score = company.icp_breakdown.technology_match || 0;
  }

  // Calculate quality signals
  let qualityScore = 0;
  if (company.linkedin_url) qualityScore += 3;
  if (company.website) qualityScore += 4;
  if (company.description) qualityScore += 3;
  breakdown[4].score = qualityScore;

  return breakdown;
}
