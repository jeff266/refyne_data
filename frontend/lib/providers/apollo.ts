/**
 * Apollo Provider Adapter
 *
 * Mid-Market firmographic enrichment and B2B contact search.
 * Provides company data and verified contact information.
 *
 * API Docs: https://apolloio.github.io/apollo-api-docs/
 */

import {
  ProviderAdapter,
  ProviderResponse,
  ContactResponse,
  CompanyQuery,
  ContactQuery,
  ProviderError,
  createProviderResponse,
  createContactResponse,
  formatRevenue,
} from './types';

const APOLLO_BASE_URL = 'https://api.apollo.io/v1';

/**
 * Apollo Provider Adapter
 *
 * Provides company enrichment and contact search capabilities.
 */
export class ApolloAdapter implements ProviderAdapter {
  id = 'apollo';
  name = 'Apollo';
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  /**
   * Get Apollo API key from constructor (must be passed from provider_connections).
   */
  private getApiKey(): string {
    if (!this.apiKey) {
      throw new ProviderError('apollo', 'config_error', 'Apollo API key not provided. Must be retrieved from provider_connections table.');
    }
    return this.apiKey;
  }

  /**
   * Enrich a company using Apollo's organization enrichment API.
   */
  async enrichCompany(query: CompanyQuery): Promise<ProviderResponse | null> {
    const apiKey = this.getApiKey();

    if (!query.domain && !query.name) {
      throw new ProviderError('apollo', 'api_error', 'Must provide either domain or name');
    }

    const payload: Record<string, string> = {
      api_key: apiKey,
    };

    if (query.domain) {
      payload.domain = query.domain;
    } else if (query.name) {
      payload.organization_name = query.name;
    }

    const response = await fetch(`${APOLLO_BASE_URL}/organizations/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Apollo] API error ${response.status}:`, errorText);
      throw new ProviderError(
        'apollo',
        'api_error',
        `API request failed: ${response.statusText} - ${errorText}`,
        response.status
      );
    }

    const data = await response.json();
    const org = data.organization;

    if (!org) {
      return null;
    }

    return createProviderResponse(
      this.id,
      org,
      {
        name: org.name || '',
        domain: org.primary_domain || '',
        industry: org.industry || '',
        employee_count: org.estimated_num_employees,
        revenue_range: formatRevenue(org.annual_revenue),
        founded_year: org.founded_year,
        linkedin_url: org.linkedin_url || '',
        description: org.short_description || '',
        city: org.city || '',
        state: org.state || '',
        country: org.country || '',
      }
    );
  }

  /**
   * Search for contacts at a company using Apollo's people search.
   */
  async searchContacts(query: ContactQuery): Promise<ContactResponse[]> {
    const apiKey = this.getApiKey();

    const payload: Record<string, unknown> = {
      api_key: apiKey,
      q_organization_domains: query.domain,
      per_page: query.limit || 5,
    };

    if (query.titles && query.titles.length > 0) {
      payload.person_titles = query.titles;
    }

    const response = await fetch(`${APOLLO_BASE_URL}/mixed_people/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new ProviderError(
        'apollo',
        'api_error',
        `API request failed: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    const people = data.people || [];

    return people.map((person: Record<string, unknown>) =>
      createContactResponse(this.id, {
        name: (person.name as string) || '',
        title: (person.title as string) || '',
        email: (person.email as string) || '',
        linkedin_url: (person.linkedin_url as string) || '',
        city: (person.city as string) || '',
        state: (person.state as string) || '',
        raw: person,
      })
    );
  }
}

export default ApolloAdapter;
