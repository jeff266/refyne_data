/**
 * Prospect Page
 *
 * Company discovery and ICP scoring interface.
 * Four-stage flow: Search → Score → Review → Push
 */

'use client';

import { useState } from 'react';
import { C } from '@/lib/design-tokens';
import { ProspectSearchQuery, ProspectSearchResult, ICPConfig } from '@/lib/prospect/types';

export default function ProspectPage() {
  const [searchQuery, setSearchQuery] = useState<ProspectSearchQuery>({
    limit: 25,
    providers: ['apollo'],
  });
  const [icpConfig, setIcpConfig] = useState<ICPConfig | undefined>(undefined);
  const [results, setResults] = useState<ProspectSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(
    new Set()
  );

  // Provider stats
  const [providerStats, setProviderStats] = useState<Record<string, any>>({});

  /**
   * Execute search.
   */
  async function handleSearch() {
    setLoading(true);
    setError(null);

    try {
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
        throw new Error(errorData.message || 'Search failed');
      }

      const data = await response.json();
      setResults(data.data.results || []);
      setProviderStats(data.data.provider_stats || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Toggle company selection.
   */
  function toggleCompany(domain: string) {
    const newSelected = new Set(selectedCompanies);
    if (newSelected.has(domain)) {
      newSelected.delete(domain);
    } else {
      newSelected.add(domain);
    }
    setSelectedCompanies(newSelected);
  }

  /**
   * Select all visible companies.
   */
  function selectAll() {
    const newSelected = new Set(selectedCompanies);
    results.forEach((r) => newSelected.add(r.domain));
    setSelectedCompanies(newSelected);
  }

  /**
   * Deselect all companies.
   */
  function deselectAll() {
    setSelectedCompanies(new Set());
  }

  /**
   * Push selected companies to HubSpot.
   */
  async function handlePush() {
    const selected = results.filter((r) => selectedCompanies.has(r.domain));

    if (selected.length === 0) {
      alert('No companies selected');
      return;
    }

    const confirmed = confirm(
      `Push ${selected.length} companies to HubSpot?\n\n` +
        'Harmonies will be applied before writing.'
    );

    if (!confirmed) return;

    // TODO: Implement push logic
    alert('Push functionality coming soon');
  }

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
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
            Prospect
          </h1>
          <p style={{ color: C.text2, fontSize: 14 }}>
            Discover and score companies from enrichment providers
          </p>
        </div>
      </div>

      {/* Search Filters */}
      <SearchFilters
        query={searchQuery}
        onChange={setSearchQuery}
        onSearch={handleSearch}
        loading={loading}
      />

      {/* Error */}
      {error && (
        <div
          style={{
            marginTop: 16,
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
        <div style={{ marginTop: 24 }}>
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
              {selectedCompanies.size > 0 &&
                ` • ${selectedCompanies.size} selected`}
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
                  background:
                    selectedCompanies.size > 0 ? C.indigo : C.text3,
                  color: 'white',
                  cursor:
                    selectedCompanies.size > 0 ? 'pointer' : 'not-allowed',
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
          />
        </div>
      )}

      {/* Provider stats */}
      {Object.keys(providerStats).length > 0 && (
        <div style={{ marginTop: 16, fontSize: 12, color: C.text3 }}>
          Provider stats:{' '}
          {Object.entries(providerStats).map(([provider, stats]: [string, any]) => (
            <span key={provider} style={{ marginLeft: 12 }}>
              {provider}: {stats.count} results ({stats.query_time_ms}ms)
              {stats.error && ` - Error: ${stats.error}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Search filter panel.
 */
function SearchFilters({
  query,
  onChange,
  onSearch,
  loading,
}: {
  query: ProspectSearchQuery;
  onChange: (q: ProspectSearchQuery) => void;
  onSearch: () => void;
  loading: boolean;
}) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 16,
        background: C.surface,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Industries */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            Industries
          </label>
          <input
            type="text"
            placeholder="e.g., Technology, Healthcare"
            value={query.industries?.join(', ') || ''}
            onChange={(e) =>
              onChange({
                ...query,
                industries: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            style={{
              width: '100%',
              padding: '8px 12px',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              fontSize: 14,
              background: C.bg,
              color: C.text,
            }}
          />
        </div>

        {/* Keywords */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            Keywords
          </label>
          <input
            type="text"
            placeholder="e.g., SaaS, B2B"
            value={query.keywords?.join(', ') || ''}
            onChange={(e) =>
              onChange({
                ...query,
                keywords: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            style={{
              width: '100%',
              padding: '8px 12px',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              fontSize: 14,
              background: C.bg,
              color: C.text,
            }}
          />
        </div>

        {/* Employee range */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            Employee Count
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              placeholder="Min"
              value={query.employeeMin || ''}
              onChange={(e) =>
                onChange({
                  ...query,
                  employeeMin: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              style={{
                flex: 1,
                padding: '8px 12px',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                fontSize: 14,
              }}
            />
            <span style={{ color: C.text3 }}>to</span>
            <input
              type="number"
              placeholder="Max"
              value={query.employeeMax || ''}
              onChange={(e) =>
                onChange({
                  ...query,
                  employeeMax: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              style={{
                flex: 1,
                padding: '8px 12px',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                fontSize: 14,
              }}
            />
          </div>
        </div>

        {/* Location */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            Location
          </label>
          <input
            type="text"
            placeholder="City, State, or Country"
            value={query.location?.city || query.location?.state || query.location?.country || ''}
            onChange={(e) =>
              onChange({
                ...query,
                location: { country: e.target.value },
              })
            }
            style={{
              width: '100%',
              padding: '8px 12px',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              fontSize: 14,
              background: C.bg,
              color: C.text,
            }}
          />
        </div>
      </div>

      {/* Search button */}
      <button
        onClick={onSearch}
        disabled={loading}
        style={{
          marginTop: 16,
          padding: '10px 24px',
          fontSize: 14,
          fontWeight: 500,
          border: 'none',
          borderRadius: 6,
          background: loading ? C.text3 : C.indigo,
          color: 'white',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Searching...' : 'Search'}
      </button>
    </div>
  );
}

/**
 * Results table.
 */
function ResultsTable({
  results,
  selectedCompanies,
  onToggle,
}: {
  results: ProspectSearchResult[];
  selectedCompanies: Set<string>;
  onToggle: (domain: string) => void;
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
            <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600 }}>
              CRM Status
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
              }}
            >
              <td style={{ padding: 12 }}>
                <input
                  type="checkbox"
                  checked={selectedCompanies.has(company.domain)}
                  onChange={() => onToggle(company.domain)}
                  style={{ cursor: 'pointer' }}
                />
              </td>
              <td style={{ padding: 12 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{company.name}</div>
                <div style={{ color: C.text3, fontSize: 12 }}>{company.domain}</div>
              </td>
              <td style={{ padding: 12, fontSize: 13, color: C.text2 }}>
                {company.industry || '—'}
              </td>
              <td style={{ padding: 12, fontSize: 13, color: C.text2 }}>
                {company.employee_count ? `${company.employee_count} employees` : '—'}
              </td>
              <td style={{ padding: 12, fontSize: 13, color: C.text2 }}>
                {[company.city, company.state, company.country].filter(Boolean).join(', ') || '—'}
              </td>
              <td style={{ padding: 12, fontSize: 13, color: C.text2 }}>
                {company.icp_score !== undefined ? (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      background:
                        company.icp_score >= 80
                          ? C.greenDim
                          : company.icp_score >= 60
                          ? C.amberDim
                          : C.redDim,
                      color:
                        company.icp_score >= 80
                          ? C.green
                          : company.icp_score >= 60
                          ? C.amber
                          : C.red,
                    }}
                  >
                    {company.icp_score}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td style={{ padding: 12, fontSize: 13 }}>
                {company.in_crm ? (
                  <a
                    href={company.hubspot_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: C.indigo,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    In HubSpot ↗
                  </a>
                ) : (
                  <span style={{ color: C.text3 }}>Not in CRM</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
