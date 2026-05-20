/**
 * Refyne Prospect Search
 *
 * Company search queries for prospect discovery using Refyne API.
 * Note: Refyne integration pending API documentation and credentials.
 */

import {
  ProspectSearchQuery,
  ProspectCompany,
  ProviderSearchResponse,
} from '../types';

const REFYNE_BASE_URL = 'https://api.refyne.io/v1'; // Placeholder URL

/**
 * Get Refyne API key from environment.
 */
function getApiKey(): string {
  const key = process.env.REFYNE_API_KEY;
  if (!key) {
    throw new Error('REFYNE_API_KEY not configured');
  }
  return key;
}

/**
 * Search for companies using Refyne's company search API.
 *
 * TODO: Implement once Refyne API documentation is available.
 */
export async function searchCompaniesRefyne(
  query: ProspectSearchQuery
): Promise<ProviderSearchResponse> {
  const startTime = Date.now();

  try {
    const apiKey = getApiKey();

    // Build Refyne search payload
    const payload: Record<string, unknown> = {
      limit: query.limit || 25,
    };

    // Industry filters
    if (query.industries && query.industries.length > 0) {
      payload.industries = query.industries;
    }

    // Employee count filters
    if (query.employeeMin !== undefined) {
      payload.employee_min = query.employeeMin;
    }
    if (query.employeeMax !== undefined) {
      payload.employee_max = query.employeeMax;
    }

    // Revenue filters
    if (query.revenueMin !== undefined) {
      payload.revenue_min = query.revenueMin;
    }
    if (query.revenueMax !== undefined) {
      payload.revenue_max = query.revenueMax;
    }

    // Location filters
    if (query.location) {
      payload.location = query.location;
    }

    // Keywords
    if (query.keywords && query.keywords.length > 0) {
      payload.keywords = query.keywords;
    }

    // Technologies
    if (query.technologies && query.technologies.length > 0) {
      payload.technologies = query.technologies;
    }

    const response = await fetch(`${REFYNE_BASE_URL}/companies/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Refyne API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const results = data.companies || [];
    const totalResults = data.total || results.length;

    // Map to standard format (adjust based on actual Refyne response structure)
    const companies: ProspectCompany[] = results.map(
      (company: Record<string, unknown>) => ({
        provider: 'refyne',
        domain: (company.domain as string) || '',
        name: (company.name as string) || '',
        industry: (company.industry as string) || undefined,
        employee_count: company.employee_count as number | undefined,
        revenue: company.revenue as number | undefined,
        city: (company.city as string) || undefined,
        state: (company.state as string) || undefined,
        country: (company.country as string) || undefined,
        website: (company.website as string) || undefined,
        linkedin_url: (company.linkedin_url as string) || undefined,
        description: (company.description as string) || undefined,
        founded_year: company.founded_year as number | undefined,
        technologies: (company.technologies as string[]) || undefined,
        raw: company,
      })
    );

    return {
      provider: 'refyne',
      companies,
      total_results: totalResults,
      query_time_ms: Date.now() - startTime,
    };
  } catch (error) {
    console.error('Refyne search error:', error);
    return {
      provider: 'refyne',
      companies: [],
      total_results: 0,
      query_time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
