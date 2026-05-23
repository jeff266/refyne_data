/**
 * GraphIQ Provider Adapter
 *
 * AI-powered capability-based company search.
 * Search organizations by their capabilities and expertise.
 *
 * API Docs: https://graphiq.io/docs
 */

import {
  ProviderAdapter,
  ProviderResponse,
  CompanyQuery,
  SearchQuery,
  ProviderError,
  createProviderResponse,
} from './types';

const GRAPHIQ_BASE_URL = 'https://app.graphiq.ai/api/v2';

/**
 * Get GraphIQ API key from environment.
 */
function getApiKey(): string {
  const key = process.env.GRAPHIQ_API_KEY;
  if (!key) {
    throw new ProviderError('graphiq', 'config_error', 'GRAPHIQ_API_KEY not configured');
  }
  return key;
}

/**
 * Format organization location from various fields.
 */
function formatLocation(org: Record<string, unknown>): string {
  const parts: string[] = [];

  for (const field of ['city', 'state', 'country']) {
    const value = org[field];
    if (value && typeof value === 'string') {
      parts.push(value);
    }
  }

  return parts.length > 0 ? parts.join(', ') : ((org.location as string) || '');
}

/**
 * Transform GraphIQ organization result to normalized format.
 */
function transformOrganization(org: Record<string, unknown>): Record<string, unknown> {
  // Extract NAICS code and name (primary industry classification)
  const naicsCode = Array.isArray(org.naics_code) ? org.naics_code[0] : org.naics_code;
  const naicsName = Array.isArray(org.naics_name) ? org.naics_name[0] : org.naics_name;

  // Extract category-level industries (fallback if no NAICS)
  const industries = org.industries as Array<{ title?: string; short_title?: string }> | undefined;
  const industryCategory = industries?.[0]?.title || industries?.[0]?.short_title || '';

  // Prefer NAICS name, fallback to category
  const industry = naicsName || industryCategory;

  // Extract phone from phone_numbers array
  const phoneNumbers = org.phone_numbers as string[] | undefined;
  const phone = phoneNumbers?.[0] || '';

  return {
    name: org.name || '',
    domain: org.website_url || org.website || '',
    description: org.description || '',
    capabilities: org.capabilities || [],
    industry,
    naics_code: naicsCode || null,
    naics_name: naicsName || null,
    industry_category: industryCategory || null,
    location: formatLocation(org),
    employee_count: org.num_employees || null,
    revenue: org.revenue || '',
    linkedin_url: org.linkedin_url || '',
    phone,
  };
}

/**
 * Search for organizations by capabilities.
 */
async function searchByCapabilities(
  capabilities: string[],
  limit: number = 20
): Promise<Record<string, unknown>[]> {
  const apiKey = getApiKey();

  const response = await fetch(`${GRAPHIQ_BASE_URL}/organizations/search`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      organization: {
        capabilities,
      },
      limit,
    }),
  });

  if (!response.ok) {
    throw new ProviderError(
      'graphiq',
      'api_error',
      `API request failed: ${response.statusText}`,
      response.status
    );
  }

  const data = await response.json();
  const entities = data.entities || [];

  return entities.map(transformOrganization);
}

/**
 * General organization search with multiple filters.
 */
async function searchOrganizations(
  query?: string,
  industry?: string,
  location?: string,
  limit: number = 20
): Promise<Record<string, unknown>[]> {
  const apiKey = getApiKey();

  // Build filter payload
  const orgFilter: Record<string, string> = {};

  if (query) {
    orgFilter.query = query;
  }
  if (industry) {
    orgFilter.industry = industry;
  }
  if (location) {
    orgFilter.location = location;
  }

  const response = await fetch(`${GRAPHIQ_BASE_URL}/organizations/search`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      organization: orgFilter,
      limit,
    }),
  });

  if (!response.ok) {
    throw new ProviderError(
      'graphiq',
      'api_error',
      `API request failed: ${response.statusText}`,
      response.status
    );
  }

  const data = await response.json();
  const entities = data.entities || [];

  return entities.map(transformOrganization);
}

/**
 * GraphIQ Provider Adapter
 *
 * Capability-based organization search and enrichment.
 */
export class GraphiqAdapter implements ProviderAdapter {
  id = 'graphiq';
  name = 'GraphIQ';

  /**
   * Enrich a company by searching for it by name or domain.
   */
  async enrichCompany(query: CompanyQuery): Promise<ProviderResponse | null> {
    if (!query.name && !query.domain) {
      throw new ProviderError('graphiq', 'api_error', 'Must provide either domain or name');
    }

    // If domain provided, search by website_url for better accuracy
    if (query.domain) {
      const results = await this.searchByDomain(query.domain);
      if (results.length === 0) {
        return null;
      }
      return createProviderResponse(this.id, results[0], results[0]);
    }

    // Otherwise search by name
    const results = await searchOrganizations(query.name, undefined, undefined, 1);

    if (results.length === 0) {
      return null;
    }

    return createProviderResponse(this.id, results[0], results[0]);
  }

  /**
   * Search by domain using website_url field (most accurate).
   */
  private async searchByDomain(domain: string): Promise<Record<string, unknown>[]> {
    const apiKey = getApiKey();

    // Clean domain: remove protocol and www prefix
    const cleanedDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .trim();

    const response = await fetch(`${GRAPHIQ_BASE_URL}/organizations/search`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organization: {
          website_url: cleanedDomain,
        },
        limit: 1,
      }),
    });

    if (!response.ok) {
      throw new ProviderError(
        'graphiq',
        'api_error',
        `API request failed: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    const entities = data.entities || [];

    return entities.map(transformOrganization);
  }

  /**
   * Search for organizations by capabilities, industry, or query.
   */
  async search(query: SearchQuery): Promise<ProviderResponse[]> {
    let results: Record<string, unknown>[];

    // If capabilities are provided, use capability search
    if (query.capabilities && query.capabilities.length > 0) {
      results = await searchByCapabilities(query.capabilities, query.limit || 20);
    } else {
      // Otherwise use general search
      results = await searchOrganizations(
        query.query || query.term,
        query.industry,
        query.location,
        query.limit || 20
      );
    }

    return results.map((result) => createProviderResponse(this.id, result, result));
  }
}

export default GraphiqAdapter;
