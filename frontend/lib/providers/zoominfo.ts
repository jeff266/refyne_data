/**
 * ZoomInfo Provider Adapter
 *
 * Enterprise B2B intelligence platform with JWT authentication.
 * Provides comprehensive company and contact data.
 *
 * API Docs: https://www.zoominfo.com/solutions/integrations
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

const ZOOMINFO_AUTH_URL = 'https://api.zoominfo.com/authenticate';
const ZOOMINFO_ENRICH_URL = 'https://api.zoominfo.com/enrich/company';
const ZOOMINFO_CONTACTS_URL = 'https://api.zoominfo.com/search/contact';

// Module-level token cache (simple PoC implementation)
let cachedAccessToken: string | null = null;

/**
 * Get ZoomInfo credentials from environment.
 */
function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.ZOOMINFO_CLIENT_ID;
  const clientSecret = process.env.ZOOMINFO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new ProviderError(
      'zoominfo',
      'config_error',
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
    throw new ProviderError(
      'zoominfo',
      'auth_error',
      `Authentication failed: ${response.statusText}`,
      response.status
    );
  }

  const data = await response.json();
  cachedAccessToken = data.jwt;

  if (!cachedAccessToken) {
    throw new ProviderError('zoominfo', 'auth_error', 'No JWT token in response');
  }

  return cachedAccessToken;
}

/**
 * Clear cached access token (useful for testing or token refresh).
 */
export function clearTokenCache(): void {
  cachedAccessToken = null;
}

/**
 * ZoomInfo Provider Adapter
 *
 * Enterprise-grade company and contact enrichment with JWT authentication.
 */
export class ZoomInfoAdapter implements ProviderAdapter {
  id = 'zoominfo';
  name = 'ZoomInfo';

  /**
   * Enrich a company and optionally get executive contacts.
   */
  async enrichCompany(query: CompanyQuery): Promise<ProviderResponse | null> {
    if (!query.domain) {
      throw new ProviderError('zoominfo', 'api_error', 'Domain is required for ZoomInfo enrichment');
    }

    const token = await getAccessToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Enrich company
    const companyResponse = await fetch(ZOOMINFO_ENRICH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        matchCompanyInput: [{ companyWebsite: query.domain }],
        outputFields: [
          'id',
          'name',
          'website',
          'industry',
          'employeeCount',
          'revenue',
          'city',
          'state',
          'country',
          'description',
        ],
      }),
    });

    if (!companyResponse.ok) {
      // Clear token cache on auth errors
      if (companyResponse.status === 401) {
        clearTokenCache();
      }
      throw new ProviderError(
        'zoominfo',
        'api_error',
        `Company enrichment failed: ${companyResponse.statusText}`,
        companyResponse.status
      );
    }

    const companyData = await companyResponse.json();
    const companies = companyData.data?.result || [];

    if (companies.length === 0) {
      return null;
    }

    const company = companies[0]?.data?.[0] || {};

    // Search for executive contacts at this company
    const contactsResponse = await fetch(ZOOMINFO_CONTACTS_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        companyWebsite: [query.domain],
        jobFunction: ['C-Level', 'VP-Level', 'Director'],
        rpp: 10,
        outputFields: [
          'id',
          'firstName',
          'lastName',
          'jobTitle',
          'email',
          'phone',
          'directPhoneNumber',
          'linkedinUrl',
        ],
      }),
    });

    if (!contactsResponse.ok) {
      throw new ProviderError(
        'zoominfo',
        'api_error',
        `Contact search failed: ${contactsResponse.statusText}`,
        contactsResponse.status
      );
    }

    const contactsData = await contactsResponse.json();
    const contactResults = contactsData.data?.result || [];

    const contacts = contactResults.map((contact: Record<string, unknown>) => ({
      name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
      title: contact.jobTitle || '',
      email: contact.email || '',
      phone: contact.phone || '',
      direct_dial: contact.directPhoneNumber || '',
      linkedin_url: contact.linkedinUrl || '',
    }));

    return createProviderResponse(
      this.id,
      { company, contacts: contactResults },
      {
        company: {
          name: company.name || '',
          domain: company.website || query.domain,
          industry: company.industry || '',
          employee_count: company.employeeCount,
          revenue: formatRevenue(company.revenue),
          city: company.city || '',
          state: company.state || '',
          country: company.country || '',
          description: company.description || '',
        },
        contacts,
      }
    );
  }

  /**
   * Search for contacts at a company.
   */
  async searchContacts(query: ContactQuery): Promise<ContactResponse[]> {
    const token = await getAccessToken();

    const payload: Record<string, unknown> = {
      companyWebsite: [query.domain],
      rpp: query.limit || 10,
      outputFields: [
        'id',
        'firstName',
        'lastName',
        'jobTitle',
        'email',
        'phone',
        'directPhoneNumber',
        'linkedinUrl',
      ],
    };

    // Map titles to ZoomInfo job functions if provided
    if (query.titles && query.titles.length > 0) {
      payload.jobTitle = query.titles;
    }

    const response = await fetch(ZOOMINFO_CONTACTS_URL, {
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
      throw new ProviderError(
        'zoominfo',
        'api_error',
        `Contact search failed: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    const contacts = data.data?.result || [];

    return contacts.map((contact: Record<string, unknown>) =>
      createContactResponse(this.id, {
        name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        title: (contact.jobTitle as string) || '',
        email: (contact.email as string) || '',
        phone: (contact.directPhoneNumber as string) || (contact.phone as string) || '',
        linkedin_url: (contact.linkedinUrl as string) || '',
        raw: contact,
      })
    );
  }
}

export default ZoomInfoAdapter;
