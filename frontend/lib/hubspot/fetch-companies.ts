/**
 * HubSpot Company Fetching
 *
 * Utilities for fetching company data with support for:
 * - Full company list retrieval
 * - Incremental updates (modified since cursor)
 * - Cursor-based pagination
 */

import { HubSpotClient } from './client';
import type { HubSpotCompany } from './types';

/**
 * Properties required for dedup scanning.
 */
const REQUIRED_PROPERTIES = [
  'name',
  'domain',
  'phone',
  'industry',
  'linkedin_company_page',
  'hs_lastmodifieddate',
] as const;

/**
 * Fetch all companies from HubSpot using cursor-based pagination.
 *
 * @param client - HubSpot API client
 * @param options - Optional configuration
 * @returns Array of all companies
 */
export async function fetchAllCompanies(
  client: HubSpotClient,
  options: {
    properties?: string[];
    onProgress?: (fetched: number, total?: number) => void;
  } = {}
): Promise<HubSpotCompany[]> {
  const properties = options.properties || REQUIRED_PROPERTIES;
  const companies: HubSpotCompany[] = [];
  let after: string | undefined;
  let totalFetched = 0;
  let estimatedTotal: number | undefined;

  do {
    const response = await client.request<{
      results: HubSpotCompany[];
      paging?: { next?: { after: string } };
      total?: number;
    }>(
      `/crm/v3/objects/companies?properties=${properties.join(',')}&limit=100${
        after ? `&after=${after}` : ''
      }`,
      { method: 'GET' }
    );

    companies.push(...response.results);
    totalFetched += response.results.length;

    // Capture total from first response
    if (response.total !== undefined && estimatedTotal === undefined) {
      estimatedTotal = response.total;
    }

    // Report progress
    if (options.onProgress) {
      options.onProgress(totalFetched, estimatedTotal);
    }

    after = response.paging?.next?.after;
  } while (after);

  return companies;
}

/**
 * Fetch companies modified since a specific timestamp using HubSpot Search API.
 *
 * @param client - HubSpot API client
 * @param cursor - Date threshold (only return records modified after this time)
 * @param options - Optional configuration
 * @returns Array of modified companies
 */
export async function fetchModifiedSince(
  client: HubSpotClient,
  cursor: Date,
  options: {
    properties?: string[];
    onProgress?: (fetched: number) => void;
  } = {}
): Promise<HubSpotCompany[]> {
  const properties = options.properties || REQUIRED_PROPERTIES;
  const companies: HubSpotCompany[] = [];
  let after: string | undefined;
  let totalFetched = 0;

  do {
    const response = await client.request<{
      results: HubSpotCompany[];
      paging?: { next?: { after: string } };
    }>(
      '/crm/v3/objects/companies/search',
      {
        method: 'POST',
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'hs_lastmodifieddate',
                  operator: 'GT',
                  value: cursor.getTime().toString(),
                },
              ],
            },
          ],
          properties,
          limit: 100,
          after,
        }),
      },
      true // isSearchApi = true for separate rate limiting
    );

    companies.push(...response.results);
    totalFetched += response.results.length;

    // Report progress
    if (options.onProgress) {
      options.onProgress(totalFetched);
    }

    after = response.paging?.next?.after;
  } while (after);

  return companies;
}

/**
 * Get the latest modified date from a collection of companies.
 * Used to update the cursor for next incremental scan.
 *
 * @param companies - Array of companies
 * @returns Latest modification timestamp
 */
export function getLatestModifiedDate(companies: HubSpotCompany[]): Date {
  return companies.reduce((latest, company) => {
    const modifiedAt = company.properties.hs_lastmodifieddate;
    if (!modifiedAt) return latest;

    const d = new Date(modifiedAt);
    return d > latest ? d : latest;
  }, new Date(0));
}
