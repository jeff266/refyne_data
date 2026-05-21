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
  return {
    name: org.name || '',
    domain: org.website || org.domain || '',
    description: org.description || '',
    capabilities: org.capabilities || [],
    industry: org.industry || '',
    location: formatLocation(org),
    employee_count: org.employee_count || org.employees,
    revenue: org.revenue || '',
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

    const response = await fetch(`${GRAPHIQ_BASE_URL}/organizations/search`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organization: {
          website_url: domain,
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
