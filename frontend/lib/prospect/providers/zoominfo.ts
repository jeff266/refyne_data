/**
 * ZoomInfo Prospect Search
 *
 * Company search queries for prospect discovery using ZoomInfo API.
 */

import {
  ProspectSearchQuery,
  ProspectCompany,
  ProviderSearchResponse,
} from '../types';

const ZOOMINFO_AUTH_URL = 'https://api.zoominfo.com/authenticate';
const ZOOMINFO_SEARCH_URL = 'https://api.zoominfo.com/search/company';

// Module-level token cache
let cachedAccessToken: string | null = null;

/**
 * Get ZoomInfo credentials from environment.
 */
function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.ZOOMINFO_CLIENT_ID;
  const clientSecret = process.env.ZOOMINFO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'ZOOMINFO_CLIENT_ID and ZOOMINFO_CLIENT_SECRET not configured'
    );
  }

  return { clientId, clientSecret };
}

/**
 * Get or refresh ZoomInfo JWT access token.
 */
async function getAccessToken(): Promise<string> {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  const { clientId, clientSecret } = getCredentials();

  const response = await fetch(ZOOMINFO_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: clientId,
      password: clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `ZoomInfo authentication failed: ${response.statusText}`
    );
  }

  const data = await response.json();
  cachedAccessToken = data.jwt;

  if (!cachedAccessToken) {
    throw new Error('No JWT token in ZoomInfo auth response');
  }

  return cachedAccessToken;
}

/**
 * Clear cached access token (on auth errors).
 */
export function clearTokenCache(): void {
  cachedAccessToken = null;
}

/**
 * Map employee count to ZoomInfo size ranges.
 */
function mapEmployeeRange(min?: number, max?: number): number[] | undefined {
  if (!min && !max) return undefined;

  // ZoomInfo uses numeric codes for employee ranges
  // 1: 1-10, 2: 11-50, 3: 51-200, 4: 201-500, 5: 501-1000, 6: 1001-5000, 7: 5001-10000, 8: 10001+
  const ranges: number[] = [];
  const sizeMapping = [
    { code: 1, min: 1, max: 10 },
    { code: 2, min: 11, max: 50 },
    { code: 3, min: 51, max: 200 },
    { code: 4, min: 201, max: 500 },
    { code: 5, min: 501, max: 1000 },
    { code: 6, min: 1001, max: 5000 },
    { code: 7, min: 5001, max: 10000 },
    { code: 8, min: 10001, max: Infinity },
  ];

  for (const range of sizeMapping) {
    const overlaps =
      (!min || range.max >= min) && (!max || range.min <= max);
    if (overlaps) {
      ranges.push(range.code);
    }
  }

  return ranges.length > 0 ? ranges : undefined;
}

/**
 * Search for companies using ZoomInfo's company search API.
 */
export async function searchCompaniesZoomInfo(
  query: ProspectSearchQuery
): Promise<ProviderSearchResponse> {
  const startTime = Date.now();

  try {
    const token = await getAccessToken();

    // Build ZoomInfo search payload
    const payload: Record<string, unknown> = {
      rpp: query.limit || 25,
      page: 1,
      outputFields: [
        'id',
        'name',
        'website',
        'companyIndustry',
        'employeeCount',
        'revenue',
        'companyStreet',
        'companyCity',
        'companyState',
        'companyCountry',
        'companyDescription',
        'foundedYear',
        'technologies',
      ],
    };

    // Industry filter
    if (query.industries && query.industries.length > 0) {
      payload.companyIndustry = query.industries;
    }

    // Employee count filter
    const employeeRanges = mapEmployeeRange(
      query.employeeMin,
      query.employeeMax
    );
    if (employeeRanges) {
      payload.companySizeCode = employeeRanges;
    }

    // Revenue filter (ZoomInfo uses revenue ranges in millions)
    if (query.revenueMin !== undefined || query.revenueMax !== undefined) {
      payload.companyRevenue = {
        min: query.revenueMin ? query.revenueMin / 1_000_000 : undefined,
        max: query.revenueMax ? query.revenueMax / 1_000_000 : undefined,
      };
    }

    // Location filters
    if (query.location) {
      if (query.location.city) {
        payload.companyCity = [query.location.city];
      }
      if (query.location.state) {
        payload.companyState = [query.location.state];
      }
      if (query.location.country) {
        payload.companyCountry = [query.location.country];
      }
    }

    // Keywords (search in company name)
    if (query.keywords && query.keywords.length > 0) {
      payload.companyName = query.keywords[0]; // ZoomInfo typically takes single keyword
    }

    // Technologies filter
    if (query.technologies && query.technologies.length > 0) {
      payload.companyTechnologies = query.technologies;
    }

    const response = await fetch(ZOOMINFO_SEARCH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearTokenCache();
      }
      throw new Error(
        `ZoomInfo API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const results = data.data?.result || [];
    const totalResults = data.data?.totalResults || results.length;

    // Map to standard format
    const companies: ProspectCompany[] = results.map(
      (company: Record<string, unknown>) => ({
        provider: 'zoominfo',
        domain: (company.website as string) || '',
        name: (company.name as string) || '',
        industry: (company.companyIndustry as string) || undefined,
        employee_count: company.employeeCount as number | undefined,
        revenue: company.revenue as number | undefined,
        city: (company.companyCity as string) || undefined,
        state: (company.companyState as string) || undefined,
        country: (company.companyCountry as string) || undefined,
        website: (company.website as string) || undefined,
        linkedin_url: undefined, // ZoomInfo may not provide LinkedIn in search
        description: (company.companyDescription as string) || undefined,
        founded_year: company.foundedYear as number | undefined,
        technologies: (company.technologies as string[]) || undefined,
        raw: company,
      })
    );

    return {
      provider: 'zoominfo',
      companies,
      total_results: totalResults,
      query_time_ms: Date.now() - startTime,
    };
  } catch (error) {
    console.error('ZoomInfo search error:', error);
    return {
      provider: 'zoominfo',
      companies: [],
      total_results: 0,
      query_time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
