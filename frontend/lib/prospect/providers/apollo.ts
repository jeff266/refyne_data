/**
 * Apollo Prospect Search
 *
 * Company search queries for prospect discovery using Apollo.io API.
 * API Docs: https://apolloio.github.io/apollo-api-docs/
 */

import {
  ProspectSearchQuery,
  ProspectCompany,
  ProviderSearchResponse,
} from '../types';

const APOLLO_BASE_URL = 'https://api.apollo.io/v1';

/**
 * Apply hard filters to Apollo results (Apollo's standard tier has soft filters).
 */
function postFilterResults(
  results: ProspectCompany[],
  query: ProspectSearchQuery
): ProspectCompany[] {
  return results.filter(company => {
    // Hard employee count filter
    if (query.employeeMin !== undefined && company.employee_count !== null && company.employee_count !== undefined) {
      if (company.employee_count < query.employeeMin) return false;
    }
    if (query.employeeMax !== undefined && company.employee_count !== null && company.employee_count !== undefined) {
      if (company.employee_count > query.employeeMax) return false;
    }
    // If employee_count is null: keep the result (unknown is not a disqualifier)

    // Hard location filter
    if (query.location) {
      const { city, state, country } = query.location;

      // Country filter
      if (country && company.country !== null && company.country !== undefined) {
        if (company.country.toLowerCase() !== country.toLowerCase()) return false;
      }

      // State filter (only check if country matches or no country specified)
      if (state && company.state !== null && company.state !== undefined) {
        if (company.state.toLowerCase() !== state.toLowerCase()) return false;
      }

      // City filter (only check if state/country match or not specified)
      if (city && company.city !== null && company.city !== undefined) {
        if (company.city.toLowerCase() !== city.toLowerCase()) return false;
      }
    }

    return true;
  });
}

/**
 * Get Apollo API key from environment.
 */
function getApiKey(): string {
  const key = process.env.APOLLO_API_KEY;
  if (!key) {
    throw new Error('APOLLO_API_KEY not configured');
  }
  return key;
}

/**
 * Build Apollo employee range strings (Variation C methodology).
 * Apollo expects comma-separated min,max pairs like: '51,100', '101,200', '201,500'
 */
function buildApolloEmployeeRanges(min?: number, max?: number): string[] | undefined {
  if (!min && !max) return undefined;

  const ranges: string[] = [];
  const apolloRanges = [
    { min: 1, max: 10 },
    { min: 11, max: 50 },
    { min: 51, max: 100 },
    { min: 101, max: 200 },
    { min: 201, max: 500 },
    { min: 501, max: 1000 },
    { min: 1001, max: 2000 },
    { min: 2001, max: 5000 },
    { min: 5001, max: 10000 },
    { min: 10001, max: Infinity },
  ];

  for (const range of apolloRanges) {
    const overlaps = (!min || range.max >= min) && (!max || range.min <= max);
    if (overlaps) {
      ranges.push(`${range.min},${range.max === Infinity ? '' : range.max}`);
    }
  }

  return ranges.length > 0 ? ranges : undefined;
}

/**
 * Search for companies using Apollo's organization search API (Variation C methodology).
 * Uses organization_locations array and employee ranges for reliable filtering.
 */
export async function searchCompaniesApollo(
  query: ProspectSearchQuery
): Promise<ProviderSearchResponse> {
  const startTime = Date.now();
  const apiKey = getApiKey();

  try {
    // Build Apollo search payload (Variation C)
    // Request 4x results to compensate for post-filtering
    const requestLimit = query.limit || 25;
    const apolloLimit = Math.min(requestLimit * 4, 100); // Apollo max is 100

    const payload: Record<string, unknown> = {
      api_key: apiKey,
      page: 1,
      per_page: apolloLimit,
    };

    // Location filter: use organization_locations array (Variation C)
    if (query.location) {
      const locations: string[] = [];

      if (query.location.state && query.location.country) {
        // State-level: "California, United States"
        locations.push(`${query.location.state}, ${query.location.country}`);
      } else if (query.location.country) {
        // Country-level: "United States"
        locations.push(query.location.country);
      } else if (query.location.city) {
        // City-level fallback
        locations.push(query.location.city);
      }

      if (locations.length > 0) {
        payload.organization_locations = locations;
      }
    }

    // Employee range: Apollo range string array (Variation C)
    const employeeRanges = buildApolloEmployeeRanges(
      query.employeeMin,
      query.employeeMax
    );
    if (employeeRanges) {
      payload.organization_num_employees_ranges = employeeRanges;
    }

    // Keywords and industries: combine into q_organization_name (Variation C)
    // Industry is soft-filtered by Apollo, hard-filtered post-query
    const searchTerms: string[] = [];

    if (query.keywords && query.keywords.length > 0) {
      searchTerms.push(...query.keywords);
    }

    if (query.industries && query.industries.length > 0) {
      searchTerms.push(...query.industries);
    }

    if (searchTerms.length > 0) {
      payload.q_organization_name = searchTerms.join(' ');
    }

    // Technologies filter (if supported)
    if (query.technologies && query.technologies.length > 0) {
      payload.organization_technology_slugs = query.technologies;
    }

    const response = await fetch(
      `${APOLLO_BASE_URL}/organizations/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Apollo API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const organizations = data.organizations || [];
    const totalResults = data.pagination?.total_entries || organizations.length;

    // Map to standard format
    const companies: ProspectCompany[] = organizations.map(
      (org: Record<string, unknown>) => ({
        provider: 'apollo',
        domain: (org.primary_domain as string) || '',
        name: (org.name as string) || '',
        industry: (org.industry as string) || undefined,
        employee_count: org.estimated_num_employees as number | undefined,
        revenue: org.estimated_annual_revenue as number | undefined,
        city: (org.city as string) || undefined,
        state: (org.state as string) || undefined,
        country: (org.country as string) || undefined,
        website: (org.website_url as string) || undefined,
        linkedin_url: (org.linkedin_url as string) || undefined,
        description: (org.short_description as string) || undefined,
        founded_year: org.founded_year as number | undefined,
        technologies: (org.technologies as string[]) || undefined,
        raw: org,
      })
    );

    // Apply hard filters (Apollo's standard tier has soft filters)
    const filteredCompanies = postFilterResults(companies, query);

    // Slice to requested limit after filtering
    const finalCompanies = filteredCompanies.slice(0, requestLimit);

    return {
      provider: 'apollo',
      companies: finalCompanies,
      total_results: totalResults,
      query_time_ms: Date.now() - startTime,
    };
  } catch (error) {
    console.error('Apollo search error:', error);
    return {
      provider: 'apollo',
      companies: [],
      total_results: 0,
      query_time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
