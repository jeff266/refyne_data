/**
 * HubSpot API Client
 *
 * HTTP client for HubSpot CRM API with intelligent rate limiting:
 * - Dynamic limits from response headers
 * - Separate limiter for CRM Search API (4 req/sec)
 * - Daily limit monitoring and alerts
 * - Retry with Retry-After header support and jitter
 */

import type {
  HubSpotList,
  HubSpotCompany,
  HubSpotProperty,
  HubSpotPaginatedResponse,
  TokenValidationResult,
} from './types';
import { REQUIRED_SCOPES, DEFAULT_COMPANY_PROPERTIES } from './types';
import { extractDomain } from '../harmonies/runtime/builtins';
import {
  parseRateLimitHeaders,
  calculateRetryDelay,
  calculateRetryAfterDelay,
  acquireGeneralSlot,
  acquireSearchSlot,
  updateFromHeaders,
  getPortalBurstLimit,
  setPortalBurstLimit,
  getRateLimitStatus,
  type RateLimitHeaders,
  type RateLimitStatus,
} from './rate-limiter';
import { getAllValid as getCacheEntries } from '../cache/cache-repository';

/**
 * Individual company entry in the index.
 */
export interface CompanyIndexEntry {
  hubspotId: string;
  domain: string | null;
  linkedInUrl: string | null;
  apolloOrgId: string | null;
  parentId: string | null;
  rawProperties: Record<string, string | null>;
}

/**
 * Company index for O(1) dedup lookups.
 * Pre-fetched at batch start to avoid per-record API calls.
 */
export interface CompanyIndex {
  /** Normalized domain → HubSpot ID */
  domainIndex: Map<string, string>;
  /** Canonical LinkedIn URL → HubSpot ID */
  linkedInIndex: Map<string, string>;
  /** Apollo org_id → HubSpot ID */
  apolloIndex: Map<string, string>;
  /** HubSpot ID → parent HubSpot ID (for companies with parent associations) */
  parentIndex: Map<string, string>;
  /** Set of HubSpot IDs that are children (have a parent) */
  childSet: Set<string>;
  /** HubSpot ID → full company entry with raw properties */
  companyMap: Map<string, CompanyIndexEntry>;
  /** Total companies in index */
  totalCompanies: number;
  /** Companies with parent associations */
  companiesWithParent: number;
}

const HUBSPOT_API_BASE = 'https://api.hubapi.com';

/**
 * Maximum retry attempts for failed requests.
 */
const MAX_RETRIES = 3;

/**
 * Export API polling interval in milliseconds.
 */
const EXPORT_POLL_INTERVAL_MS = 2000;

/**
 * Maximum export poll attempts (5 minutes at 2s intervals).
 * Large portals with 100K+ companies may need this headroom.
 */
const EXPORT_MAX_POLL_ATTEMPTS = 150;

/**
 * Properties to request in Export API for company index.
 */
const EXPORT_COMPANY_PROPERTIES = [
  'hs_object_id',
  'name',
  'domain',
  'industry',
  'annualrevenue',
  'numberofemployees',
  'phone',
  'city',
  'state',
  'country',
  'zip',
  'address',
  'linkedin_company_page',
  'description',
  'website',
  'founded_year',
  'hs_parent_company_id',
  'apollo_org_id',
] as const;

/**
 * Parse CSV export file content from HubSpot Export API.
 * HubSpot exports use CSV format with header row.
 *
 * @param raw - Raw CSV content from Export API
 * @returns Array of HubSpotCompany objects, or null if parsing fails
 */
export function parseExportFile(raw: string): HubSpotCompany[] | null {
  const trimmed = raw.trim();

  // Empty file returns empty array
  if (trimmed.length === 0) {
    return [];
  }

  try {
    const lines = trimmed.split('\n');
    if (lines.length < 2) {
      // Only header or empty
      return [];
    }

    // Parse header row to get column names
    const headers = parseCSVLine(lines[0]);
    if (headers.length === 0) {
      return [];
    }

    // Find important column indices
    const recordIdIdx = headers.findIndex(h =>
      h.toLowerCase() === 'record id' || h.toLowerCase() === 'hs_object_id'
    );
    const createDateIdx = headers.findIndex(h =>
      h.toLowerCase() === 'create date' || h.toLowerCase() === 'createdate'
    );
    const modifiedDateIdx = headers.findIndex(h =>
      h.toLowerCase() === 'last modified date' || h.toLowerCase() === 'lastmodifieddate'
    );

    if (recordIdIdx === -1) {
      console.error('[Export API] CSV missing Record ID column');
      return null;
    }

    // Parse data rows
    const companies: HubSpotCompany[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCSVLine(line);
      if (values.length !== headers.length) {
        console.warn(`[Export API] Skipping malformed row ${i}: column count mismatch`);
        continue;
      }

      const id = values[recordIdIdx];
      if (!id) continue;

      // Build properties object from all columns except Record ID
      const props: Record<string, string | null> = {};
      for (let j = 0; j < headers.length; j++) {
        if (j === recordIdIdx) continue;
        const key = normalizeHeaderName(headers[j]);
        props[key] = values[j] || null;
      }

      companies.push({
        id,
        properties: props,
        createdAt: createDateIdx >= 0 ? values[createDateIdx] || new Date().toISOString() : new Date().toISOString(),
        updatedAt: modifiedDateIdx >= 0 ? values[modifiedDateIdx] || new Date().toISOString() : new Date().toISOString(),
      });
    }

    return companies;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Export API] Failed to parse CSV: ${msg}`);
    return null;
  }
}

/**
 * Parse a single CSV line, handling quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  result.push(current);
  return result;
}

/**
 * Normalize HubSpot CSV header name to property name.
 * e.g., "Company name" -> "name", "Company Domain Name" -> "domain"
 */
function normalizeHeaderName(header: string): string {
  const normalized = header.toLowerCase().trim();

  // Map common HubSpot CSV headers to property names
  const headerMap: Record<string, string> = {
    'company name': 'name',
    'company domain name': 'domain',
    'create date': 'createdate',
    'last modified date': 'lastmodifieddate',
    'record id': 'hs_object_id',
    'annual revenue': 'annualrevenue',
    'number of employees': 'numberofemployees',
    'linkedin company page': 'linkedin_company_page',
    'parent company': 'hs_parent_company_id',
  };

  return headerMap[normalized] || normalized.replace(/\s+/g, '_');
}

/**
 * Callback for when burst limit is first observed.
 * Used to persist to database.
 */
export type BurstLimitObservedCallback = (portalId: string, burstLimit: number) => Promise<void>;

/**
 * HubSpot API client for a specific portal.
 */
export class HubSpotClient {
  private readonly accessToken: string;
  private readonly portalId: string;
  private burstLimitObservedCallback: BurstLimitObservedCallback | null = null;
  private burstLimitCallbackFired = false;

  constructor(accessToken: string, portalId: string, initialBurstLimit?: number) {
    this.accessToken = accessToken;
    this.portalId = portalId;

    // Initialize with stored burst limit if provided
    if (initialBurstLimit) {
      setPortalBurstLimit(portalId, initialBurstLimit);
    }
  }

  /**
   * Set callback for when burst limit is first observed.
   * The callback should persist the limit to hubspot_connections.rate_limit_per_10s
   */
  setBurstLimitObservedCallback(callback: BurstLimitObservedCallback): void {
    this.burstLimitObservedCallback = callback;
  }

  /**
   * Make an authenticated request to HubSpot API.
   *
   * @param path - API path (e.g., '/crm/v3/objects/companies')
   * @param options - Fetch options
   * @param isSearchApi - Whether this is a CRM Search API call (separate rate limit)
   * @param attempt - Current retry attempt (0-indexed)
   */
  public async request<T>(
    path: string,
    options: RequestInit = {},
    isSearchApi = false,
    attempt = 0
  ): Promise<T> {
    // Acquire rate limit slot
    if (isSearchApi) {
      await acquireSearchSlot(this.portalId);
    } else {
      await acquireGeneralSlot(this.portalId);
    }

    const url = `${HUBSPOT_API_BASE}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Parse and update rate limit headers
    const rateLimitHeaders = parseRateLimitHeaders(response.headers);
    const { firstObservation, burstLimit } = updateFromHeaders(this.portalId, rateLimitHeaders);

    // Fire callback on first burst limit observation
    if (firstObservation && burstLimit !== null && !this.burstLimitCallbackFired) {
      this.burstLimitCallbackFired = true;
      if (this.burstLimitObservedCallback) {
        // Fire-and-forget - don't block the request
        this.burstLimitObservedCallback(this.portalId, burstLimit).catch(err => {
          console.error('Failed to persist burst limit:', err);
        });
      }
    }

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `HubSpot API error: ${response.status}`;

      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        // Use default error message
      }

      // Handle rate limiting (429)
      if (response.status === 429) {
        if (attempt >= MAX_RETRIES) {
          throw new Error(`Rate limit exceeded after ${MAX_RETRIES} retries: ${errorMessage}`);
        }

        // Check Retry-After header
        const retryAfter = response.headers.get('Retry-After');
        let waitMs: number;

        if (retryAfter) {
          // Use Retry-After value with small jitter
          const retryAfterSeconds = parseInt(retryAfter, 10);
          waitMs = calculateRetryAfterDelay(retryAfterSeconds);
          console.log(`Rate limited (429). Retry-After: ${retryAfterSeconds}s. Waiting ${Math.round(waitMs)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        } else {
          // Fall back to exponential backoff with jitter
          waitMs = calculateRetryDelay(attempt);
          console.log(`Rate limited (429). No Retry-After header. Waiting ${Math.round(waitMs)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        }

        await new Promise(resolve => setTimeout(resolve, waitMs));
        return this.request<T>(path, options, isSearchApi, attempt + 1);
      }

      // Handle server errors (5xx) with retry
      if (response.status >= 500 && response.status < 600) {
        if (attempt >= MAX_RETRIES) {
          throw new Error(`Server error after ${MAX_RETRIES} retries: ${errorMessage}`);
        }

        const waitMs = calculateRetryDelay(attempt);
        console.log(`Server error (${response.status}). Waiting ${Math.round(waitMs)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        return this.request<T>(path, options, isSearchApi, attempt + 1);
      }

      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Get rate limit status for this portal.
   */
  getRateLimitStatus(): RateLimitStatus {
    return getRateLimitStatus(this.portalId);
  }

  /**
   * Get the current burst limit for this portal.
   */
  getBurstLimit(): number {
    return getPortalBurstLimit(this.portalId);
  }

  /**
   * Get company lists from HubSpot.
   */
  async getCompanyLists(): Promise<HubSpotList[]> {
    const response = await this.request<{
      lists: Array<{
        listId: string;
        name: string;
        objectTypeId: string;
        processingStatus: string;
        size?: number;
      }>;
    }>('/crm/v3/lists?includeFilters=false');

    // Filter to company lists only (objectTypeId = '0-2')
    return response.lists
      .filter(list => list.objectTypeId === '0-2')
      .map(list => ({
        listId: list.listId,
        name: list.name,
        objectTypeId: list.objectTypeId,
        memberCount: list.size || 0,
      }));
  }

  /**
   * Get members of a list with pagination.
   * Yields batches of companies as they're fetched.
   */
  async *getListMembers(
    listId: string,
    properties: readonly string[] = DEFAULT_COMPANY_PROPERTIES
  ): AsyncGenerator<HubSpotCompany[]> {
    let after: string | undefined;

    do {
      const queryParams = new URLSearchParams({
        limit: '100',
      });

      if (after) {
        queryParams.set('after', after);
      }

      // First get the member IDs from the list
      const membershipResponse = await this.request<{
        results: Array<{ id: string }>;
        paging?: { next?: { after: string } };
      }>(`/crm/v3/lists/${listId}/memberships?${queryParams}`);

      if (membershipResponse.results.length === 0) {
        break;
      }

      // Then fetch the full company records
      const companyIds = membershipResponse.results.map(m => m.id);
      const companies = await this.getCompaniesByIds(companyIds, properties);

      yield companies;

      after = membershipResponse.paging?.next?.after;
    } while (after);
  }

  /**
   * Get companies by IDs (batch read).
   */
  async getCompaniesByIds(
    ids: string[],
    properties: readonly string[] = DEFAULT_COMPANY_PROPERTIES
  ): Promise<HubSpotCompany[]> {
    if (ids.length === 0) return [];

    // Batch in groups of 100
    const batches: HubSpotCompany[] = [];

    for (let i = 0; i < ids.length; i += 100) {
      const batchIds = ids.slice(i, i + 100);

      const response = await this.request<{
        results: Array<{
          id: string;
          properties: Record<string, string | null>;
          createdAt: string;
          updatedAt: string;
        }>;
      }>('/crm/v3/objects/companies/batch/read', {
        method: 'POST',
        body: JSON.stringify({
          inputs: batchIds.map(id => ({ id })),
          properties: [...properties],
        }),
      });

      batches.push(
        ...response.results.map(r => ({
          id: r.id,
          properties: r.properties,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }))
      );
    }

    return batches;
  }

  /**
   * Get all companies from portal with pagination.
   * Use this for portals without lists.
   */
  async *getAllCompanies(
    properties: readonly string[] = DEFAULT_COMPANY_PROPERTIES
  ): AsyncGenerator<HubSpotCompany[]> {
    let after: string | undefined;

    do {
      const queryParams = new URLSearchParams({
        limit: '100',
        properties: [...properties].join(','),
      });

      if (after) {
        queryParams.set('after', after);
      }

      const response = await this.request<HubSpotPaginatedResponse<{
        id: string;
        properties: Record<string, string | null>;
        createdAt: string;
        updatedAt: string;
      }>>(`/crm/v3/objects/companies?${queryParams}`);

      yield response.results.map(r => ({
        id: r.id,
        properties: r.properties,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));

      after = response.paging?.next?.after;
    } while (after);
  }

  /**
   * Search companies modified after a given timestamp using HubSpot Search API.
   * Used for incremental compliance scans.
   */
  async *searchCompaniesByModifiedDate(
    properties: readonly string[],
    afterTimestamp: number
  ): AsyncGenerator<HubSpotCompany[]> {
    let after = 0;
    let hasMore = true;

    while (hasMore) {
      const searchRequest = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'hs_lastmodifieddate',
                operator: 'GTE',
                value: afterTimestamp.toString(),
              },
            ],
          },
        ],
        properties: [...properties],
        limit: 100,
        after,
      };

      const response = await this.request<{
        results: Array<{
          id: string;
          properties: Record<string, string | null>;
          createdAt: string;
          updatedAt: string;
        }>;
        paging?: {
          next?: {
            after: string;
          };
        };
      }>('/crm/v3/objects/companies/search', {
        method: 'POST',
        body: JSON.stringify(searchRequest),
      });

      if (response.results.length > 0) {
        yield response.results.map(r => ({
          id: r.id,
          properties: r.properties,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));
      }

      if (response.paging?.next?.after) {
        after = parseInt(response.paging.next.after, 10);
      } else {
        hasMore = false;
      }
    }
  }

  /**
   * Get company property definitions.
   */
  async getCompanyProperties(): Promise<HubSpotProperty[]> {
    const response = await this.request<{
      results: Array<{
        name: string;
        label: string;
        type: string;
        fieldType: string;
        options?: Array<{
          label: string;
          value: string;
          displayOrder: number;
        }>;
      }>;
    }>('/crm/v3/properties/companies');

    return response.results.map(prop => ({
      name: prop.name,
      label: prop.label,
      type: prop.type,
      fieldType: prop.fieldType,
      options: prop.options,
    }));
  }

  /**
   * Get portal ID.
   */
  getPortalId(): string {
    return this.portalId;
  }

  // ─────────────────────────────────────────────────────────────
  // H2: Write Path Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Search companies by domain.
   * Used by dedup gate for blocking key lookup.
   *
   * NOTE: Uses CRM Search API with separate rate limit (4 req/sec).
   */
  async searchCompaniesByDomain(
    domain: string,
    properties: readonly string[] = DEFAULT_COMPANY_PROPERTIES
  ): Promise<HubSpotCompany[]> {
    // CRM Search API has separate 4 req/sec limit
    const response = await this.request<{
      results: Array<{
        id: string;
        properties: Record<string, string | null>;
        createdAt: string;
        updatedAt: string;
      }>;
    }>('/crm/v3/objects/companies/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{
          filters: [{
            propertyName: 'domain',
            operator: 'EQ',
            value: domain,
          }],
        }],
        properties: [...properties],
        limit: 10,
      }),
    }, true); // isSearchApi = true

    return response.results.map(r => ({
      id: r.id,
      properties: r.properties,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Search companies by name (fuzzy via CONTAINS_TOKEN).
   * Used as fallback when domain is not available.
   *
   * NOTE: Uses CRM Search API with separate rate limit (4 req/sec).
   */
  async searchCompaniesByName(
    name: string,
    properties: readonly string[] = DEFAULT_COMPANY_PROPERTIES
  ): Promise<HubSpotCompany[]> {
    // Use first word for initial filter to avoid too broad results
    const firstWord = name.split(/\s+/)[0];
    if (!firstWord || firstWord.length < 2) return [];

    // CRM Search API has separate 4 req/sec limit
    const response = await this.request<{
      results: Array<{
        id: string;
        properties: Record<string, string | null>;
        createdAt: string;
        updatedAt: string;
      }>;
    }>('/crm/v3/objects/companies/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{
          filters: [{
            propertyName: 'name',
            operator: 'CONTAINS_TOKEN',
            value: firstWord,
          }],
        }],
        properties: [...properties],
        limit: 20,
      }),
    }, true); // isSearchApi = true

    return response.results.map(r => ({
      id: r.id,
      properties: r.properties,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Batch update companies.
   * Updates existing records by ID in batches of 100.
   */
  async batchUpdateCompanies(
    records: Array<{
      id: string;
      properties: Record<string, string | number | null>;
    }>
  ): Promise<{
    results: Array<{
      id: string;
      properties: Record<string, string | null>;
    }>;
    errors: Array<{
      index: number;
      error: string;
    }>;
  }> {
    const results: Array<{
      id: string;
      properties: Record<string, string | null>;
    }> = [];
    const errors: Array<{ index: number; error: string }> = [];

    // Process in batches of 100
    for (let i = 0; i < records.length; i += 100) {
      const batch = records.slice(i, i + 100);

      try {
        const response = await this.request<{
          results: Array<{
            id: string;
            properties: Record<string, string | null>;
          }>;
        }>('/crm/v3/objects/companies/batch/update', {
          method: 'POST',
          body: JSON.stringify({
            inputs: batch.map(r => ({
              id: r.id,
              properties: this.cleanProperties(r.properties),
            })),
          }),
        });

        results.push(...response.results);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        batch.forEach((_, idx) => {
          errors.push({ index: i + idx, error: msg });
        });
      }
    }

    return { results, errors };
  }

  /**
   * Batch create companies.
   * Creates new records in batches of 100.
   */
  async batchCreateCompanies(
    records: Array<{
      properties: Record<string, string | number | null>;
    }>
  ): Promise<{
    results: Array<{
      id: string;
      properties: Record<string, string | null>;
    }>;
    errors: Array<{
      index: number;
      error: string;
    }>;
  }> {
    const results: Array<{
      id: string;
      properties: Record<string, string | null>;
    }> = [];
    const errors: Array<{ index: number; error: string }> = [];

    // Process in batches of 100
    for (let i = 0; i < records.length; i += 100) {
      const batch = records.slice(i, i + 100);

      try {
        const response = await this.request<{
          results: Array<{
            id: string;
            properties: Record<string, string | null>;
          }>;
        }>('/crm/v3/objects/companies/batch/create', {
          method: 'POST',
          body: JSON.stringify({
            inputs: batch.map(r => ({
              properties: this.cleanProperties(r.properties),
            })),
          }),
        });

        results.push(...response.results);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        batch.forEach((_, idx) => {
          errors.push({ index: i + idx, error: msg });
        });
      }
    }

    return { results, errors };
  }

  /**
   * Update a single company by ID.
   * Uses PATCH endpoint for individual company updates.
   *
   * @param companyId - HubSpot company ID
   * @param properties - Properties to update
   */
  async updateCompany(
    companyId: string,
    properties: Record<string, string | number | null>
  ): Promise<void> {
    await this.request<{
      id: string;
      properties: Record<string, string | null>;
    }>(`/crm/v3/objects/companies/${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: this.cleanProperties(properties),
      }),
    });
  }

  /**
   * Clean properties for HubSpot API.
   * Removes null/undefined values and converts numbers to strings.
   */
  private cleanProperties(
    properties: Record<string, string | number | null>
  ): Record<string, string> {
    const cleaned: Record<string, string> = {};

    for (const [key, value] of Object.entries(properties)) {
      if (value === null || value === undefined) continue;
      cleaned[key] = typeof value === 'number' ? String(value) : value;
    }

    return cleaned;
  }

  // ─────────────────────────────────────────────────────────────
  // Export API (for super admin connections with crm.export scope)
  // ─────────────────────────────────────────────────────────────

  /**
   * Export companies using the async Export API.
   * Requires crm.export scope (super admin connections only).
   *
   * Flow:
   * 1. Trigger export job via POST /crm/v3/exports/export/async
   * 2. Poll status every 2 seconds using the status URL
   * 3. On COMPLETE, download CSV file
   * 4. Parse CSV and return company array
   *
   * @param properties - Properties to include in export
   * @returns Array of companies or null on failure
   */
  async exportCompanies(
    properties: readonly string[] = EXPORT_COMPANY_PROPERTIES
  ): Promise<HubSpotCompany[] | null> {
    try {
      // 1. Trigger export job
      console.log(`[Export API] Triggering company export for portal ${this.portalId}`);

      const exportRequest = {
        exportType: 'VIEW',  // VIEW exports all objects without needing a list ID
        format: 'CSV',       // HubSpot Export API only supports CSV format
        exportName: `company-index-${Date.now()}`,
        objectType: 'COMPANY',
        objectProperties: [...properties],
        publicAccessEnabled: false,
      };

      const triggerResponse = await this.request<{
        id: string;
        links?: { status?: string };
      }>('/crm/v3/exports/export/async', {
        method: 'POST',
        body: JSON.stringify(exportRequest),
      });

      const taskId = triggerResponse.id;
      console.log(`[Export API] Export job created: ${taskId}`);

      // 2. Poll for completion using status endpoint
      let attempts = 0;
      let status = 'PENDING';
      let downloadUrl: string | null = null;

      while (attempts < EXPORT_MAX_POLL_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, EXPORT_POLL_INTERVAL_MS));
        attempts++;

        // Use the /status endpoint path
        const pollResponse = await this.request<{
          status: string;
          result?: string;
        }>(`/crm/v3/exports/export/async/tasks/${taskId}/status`);

        status = pollResponse.status;
        downloadUrl = pollResponse.result || null;

        if (status === 'COMPLETE') {
          break;
        }

        if (status === 'FAILED' || status === 'CANCELED') {
          console.error(`[Export API] Export failed with status: ${status}`);
          return null;
        }

        if (attempts % 5 === 0) {
          console.log(`[Export API] Polling attempt ${attempts}: status=${status}`);
        }
      }

      if (status !== 'COMPLETE' || !downloadUrl) {
        console.error(`[Export API] Export timed out or missing download URL. Status: ${status}`);
        return null;
      }

      console.log(`[Export API] Export complete, downloading file`);

      // 3. Download the file (direct fetch, no auth required for presigned URL)
      const downloadResponse = await fetch(downloadUrl);
      if (!downloadResponse.ok) {
        console.error(`[Export API] Download failed: ${downloadResponse.status}`);
        return null;
      }

      const fileContent = await downloadResponse.text();

      // 4. Parse CSV export file
      const companies = parseExportFile(fileContent);
      if (companies === null) {
        console.error(`[Export API] Failed to parse export file`);
        return null;
      }

      console.log(`[Export API] Parsed ${companies.length} companies from export`);
      return companies;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[Export API] Export failed: ${msg}`);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Company Index for Batch Dedup
  // ─────────────────────────────────────────────────────────────

  /**
   * Build a company index for O(1) dedup lookups.
   * Fetches all companies with their properties for write comparison.
   * Call once at batch start, pass to dedup gate for each record.
   *
   * Uses Export API for connections with crm.export scope (faster for large portals),
   * falls back to paginated approach otherwise.
   *
   * After building indexes from HubSpot, populates external ID indexes from the
   * provider entity cache (Apollo IDs, LinkedIn URLs from prior enrichments).
   *
   * @param hasExportScope - Whether connection has crm.export scope
   * @param orgId - Organization ID for cache lookup
   */
  async buildCompanyIndex(hasExportScope = false, orgId?: string, filterTimestamp?: number): Promise<CompanyIndex> {
    const domainIndex = new Map<string, string>();
    const linkedInIndex = new Map<string, string>();
    const apolloIndex = new Map<string, string>();
    const parentIndex = new Map<string, string>();
    const childSet = new Set<string>();
    const companyMap = new Map<string, CompanyIndexEntry>();

    let totalCompanies = 0;
    let usedExportApi = false;

    // Try Export API for connections with crm.export scope (only for full scans)
    if (hasExportScope && !filterTimestamp) {
      console.log(`[buildCompanyIndex] Using Export API for portal ${this.portalId}`);
      const exportedCompanies = await this.exportCompanies();

      if (exportedCompanies) {
        usedExportApi = true;

        for (const company of exportedCompanies) {
          totalCompanies++;
          this.indexCompany(
            company,
            domainIndex,
            linkedInIndex,
            apolloIndex,
            parentIndex,
            childSet,
            companyMap
          );
        }

        console.log(`[buildCompanyIndex] Export API: indexed ${totalCompanies} companies`);
      } else {
        console.warn(`[buildCompanyIndex] Export API failed, falling back to paginated approach`);
      }
    }

    // Fall back to paginated/search approach if Export API not available or failed
    if (!usedExportApi) {
      // Fetch all properties needed for both indexing and write comparison
      const allProperties = [
        ...DEFAULT_COMPANY_PROPERTIES,
        'apollo_org_id',
        'hs_parent_company_id',
      ];

      // Use search API for incremental scans (with lastmodifieddate filter)
      if (filterTimestamp) {
        console.log(`[buildCompanyIndex] Using search API with filter (lastmodifieddate >= ${filterTimestamp})`);
        for await (const batch of this.searchCompaniesByModifiedDate(allProperties, filterTimestamp)) {
          for (const company of batch) {
            totalCompanies++;
            this.indexCompany(
              company,
              domainIndex,
              linkedInIndex,
              apolloIndex,
              parentIndex,
              childSet,
              companyMap
            );
          }
        }
        console.log(`[buildCompanyIndex] Search API: indexed ${totalCompanies} modified companies`);
      } else {
        // Full scan: use regular pagination
        console.log(`[buildCompanyIndex] Using paginated approach for portal ${this.portalId}`);
        for await (const batch of this.getAllCompanies(allProperties)) {
          for (const company of batch) {
            totalCompanies++;
            this.indexCompany(
              company,
              domainIndex,
              linkedInIndex,
              apolloIndex,
              parentIndex,
              childSet,
              companyMap
            );
          }
        }
        console.log(`[buildCompanyIndex] Paginated: indexed ${totalCompanies} companies`);
      }
    }

    // ═══════════════════════════════════════════════════════════
    // CACHE PASS: Populate external ID indexes from cache
    // ═══════════════════════════════════════════════════════════
    // This adds Apollo IDs and LinkedIn URLs from prior enrichments
    // to enable Tier 3 and 4 dedup signals beyond the current batch.
    if (orgId) {
      try {
        const cacheEntries = await getCacheEntries(orgId, 'company');
        let cacheApolloAdded = 0;
        let cacheLinkedInAdded = 0;

        for (const entry of cacheEntries) {
          const domain = entry.domain;

          // Only add to index if the domain exists in HubSpot
          // (avoids orphaned entries from deleted companies)
          if (domain && domainIndex.has(domain)) {
            const hubspotId = domainIndex.get(domain)!;

            // Add Apollo org_id if this is from Apollo provider
            if (entry.provider === 'apollo' && entry.provider_id) {
              if (!apolloIndex.has(entry.provider_id)) {
                apolloIndex.set(entry.provider_id, hubspotId);
                cacheApolloAdded++;
              }
            }

            // Add LinkedIn URL from cached canonical data
            const linkedInUrl = (entry.canonical_data as Record<string, unknown>)?.linkedin_url;
            if (linkedInUrl && typeof linkedInUrl === 'string') {
              const canonicalUrl = this.canonicalizeLinkedInUrl(linkedInUrl);
              if (canonicalUrl && !linkedInIndex.has(canonicalUrl)) {
                linkedInIndex.set(canonicalUrl, hubspotId);
                cacheLinkedInAdded++;
              }
            }
          }
        }

        if (cacheApolloAdded > 0 || cacheLinkedInAdded > 0) {
          console.log(
            `[buildCompanyIndex] Cache pass: added ${cacheApolloAdded} Apollo IDs, ${cacheLinkedInAdded} LinkedIn URLs`
          );
        }
      } catch (err) {
        // Cache errors are non-fatal
        console.warn('[buildCompanyIndex] Cache pass failed (non-fatal):', err);
      }
    }

    return {
      domainIndex,
      linkedInIndex,
      apolloIndex,
      parentIndex,
      childSet,
      companyMap,
      totalCompanies,
      companiesWithParent: parentIndex.size,
    };
  }

  /**
   * Index a single company into the lookup maps.
   * Extracted for reuse between Export API and paginated paths.
   */
  private indexCompany(
    company: HubSpotCompany,
    domainIndex: Map<string, string>,
    linkedInIndex: Map<string, string>,
    apolloIndex: Map<string, string>,
    parentIndex: Map<string, string>,
    childSet: Set<string>,
    companyMap: Map<string, CompanyIndexEntry>
  ): void {
    const domain = company.properties.domain;
    const linkedInUrl = company.properties.linkedin_company_page;
    const apolloOrgId = company.properties.apollo_org_id;
    const parentCompanyId = company.properties.hs_parent_company_id;

    // Store full company entry with raw properties
    const entry: CompanyIndexEntry = {
      hubspotId: company.id,
      domain: domain || null,
      linkedInUrl: linkedInUrl || null,
      apolloOrgId: apolloOrgId || null,
      parentId: parentCompanyId || null,
      rawProperties: company.properties,
    };
    companyMap.set(company.id, entry);

    // Index by domain
    if (domain) {
      const normalizedDomain = extractDomain(domain);
      if (normalizedDomain && !domainIndex.has(normalizedDomain)) {
        domainIndex.set(normalizedDomain, company.id);
      }
    }

    // Index by LinkedIn URL
    if (linkedInUrl) {
      const canonicalUrl = this.canonicalizeLinkedInUrl(linkedInUrl);
      if (canonicalUrl && !linkedInIndex.has(canonicalUrl)) {
        linkedInIndex.set(canonicalUrl, company.id);
      }
    }

    // Index by Apollo org_id (if present)
    if (apolloOrgId && !apolloIndex.has(apolloOrgId)) {
      apolloIndex.set(apolloOrgId, company.id);
    }

    // Index parent-child relationships
    if (parentCompanyId) {
      parentIndex.set(company.id, parentCompanyId);
      childSet.add(company.id);
    }
  }


  /**
   * Canonicalize LinkedIn company URL for consistent matching.
   */
  private canonicalizeLinkedInUrl(url: string): string | null {
    if (!url) return null;

    try {
      // Handle various LinkedIn URL formats
      const cleaned = url.toLowerCase().trim();
      const match = cleaned.match(/linkedin\.com\/(?:company|school)\/([^/?]+)/);
      if (match) {
        return `linkedin.com/company/${match[1].replace(/\/$/, '')}`;
      }
      return null;
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Schema Discovery
  // ─────────────────────────────────────────────────────────────

  /**
   * Fetch all properties for an object type.
   * Returns properties with their enum options if applicable.
   */
  async getProperties(objectType: 'companies' | 'contacts'): Promise<HubSpotProperty[]> {
    const response = await this.request<{ results: HubSpotProperty[] }>(
      `/crm/v3/properties/${objectType}`
    );
    return response.results;
  }

  /**
   * Sync workspace schema from HubSpot.
   * Fetches company and contact properties, extracts enum options.
   * Returns properties that have enum values (select/checkbox field types).
   */
  async syncWorkspaceSchema(): Promise<SchemaDiscoveryResult> {
    const companyProperties = await this.getProperties('companies');
    const contactProperties = await this.getProperties('contacts');

    const enumProperties: SchemaProperty[] = [];

    // Process company properties
    for (const prop of companyProperties) {
      if (prop.fieldType === 'select' || prop.fieldType === 'checkbox') {
        enumProperties.push({
          objectType: 'companies',
          property: prop.name,
          label: prop.label,
          fieldType: prop.fieldType,
          options: (prop.options || []).map(opt => ({
            value: opt.value,
            label: opt.label,
          })),
        });
      }
    }

    // Process contact properties
    for (const prop of contactProperties) {
      if (prop.fieldType === 'select' || prop.fieldType === 'checkbox') {
        enumProperties.push({
          objectType: 'contacts',
          property: prop.name,
          label: prop.label,
          fieldType: prop.fieldType,
          options: (prop.options || []).map(opt => ({
            value: opt.value,
            label: opt.label,
          })),
        });
      }
    }

    return {
      portalId: this.portalId,
      syncedAt: new Date().toISOString(),
      companyPropertyCount: companyProperties.length,
      contactPropertyCount: contactProperties.length,
      enumPropertyCount: enumProperties.length,
      enumProperties,
    };
  }
}

/**
 * Schema property with enum options.
 */
export interface SchemaProperty {
  objectType: 'companies' | 'contacts';
  property: string;
  label: string;
  fieldType: 'select' | 'checkbox';
  options: Array<{ value: string; label: string }>;
}

/**
 * Result of schema discovery sync.
 */
export interface SchemaDiscoveryResult {
  portalId: string;
  syncedAt: string;
  companyPropertyCount: number;
  contactPropertyCount: number;
  enumPropertyCount: number;
  enumProperties: SchemaProperty[];
}

/**
 * Validate a HubSpot access token and check scopes.
 *
 * For private app tokens (PATs), the OAuth validation endpoint doesn't work.
 * Instead, we validate by making a test API call and extracting the portal ID
 * from the account info endpoint.
 *
 * Also checks for crm.export scope which enables the Export API for faster
 * company index building.
 */
export async function validateToken(accessToken: string): Promise<TokenValidationResult> {
  try {
    // First, try the OAuth endpoint (works for OAuth tokens)
    const oauthResponse = await fetch(
      `https://api.hubapi.com/oauth/v1/access-tokens/${accessToken}`
    );

    if (oauthResponse.ok) {
      const data = await oauthResponse.json();
      const grantedScopes: string[] = data.scopes || [];
      const missingScopes = REQUIRED_SCOPES.filter(s => !grantedScopes.includes(s));

      // Check for crm.export scope (enables Export API)
      const hasExportScope = grantedScopes.includes('crm.export');
      if (hasExportScope) {
        console.log(`[validateToken] OAuth token has crm.export scope - Export API available`);
      }

      return {
        valid: missingScopes.length === 0,
        portalId: String(data.hub_id),
        scopes: grantedScopes,
        missingScopes: missingScopes.length > 0 ? missingScopes : undefined,
        hasExportScope,
        error: missingScopes.length > 0
          ? `Missing required scopes: ${missingScopes.join(', ')}`
          : undefined,
      };
    }

    // For private app tokens (PATs), validate by making a test API call
    // The account info endpoint returns the portal ID
    const accountResponse = await fetch(
      'https://api.hubapi.com/account-info/v3/details',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!accountResponse.ok) {
      if (accountResponse.status === 401) {
        return { valid: false, error: 'Invalid or expired token' };
      }
      return { valid: false, error: `Token validation failed: ${accountResponse.status}` };
    }

    const accountData = await accountResponse.json();
    const portalId = String(accountData.portalId);

    // Test that we can access companies (validates CRM scopes)
    const companyTestResponse = await fetch(
      'https://api.hubapi.com/crm/v3/objects/companies?limit=1',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!companyTestResponse.ok) {
      return {
        valid: false,
        portalId,
        error: 'Token lacks required company access scopes',
        missingScopes: ['crm.objects.companies.read'],
      };
    }

    // Test that we can access lists (validates list scopes)
    const listTestResponse = await fetch(
      'https://api.hubapi.com/crm/v3/lists?limit=1',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const hasListAccess = listTestResponse.ok;

    // Test Export API access (checks crm.export scope)
    // We try to list exports - this requires crm.export scope
    const exportTestResponse = await fetch(
      'https://api.hubapi.com/crm/v3/exports/export/async/tasks',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const hasExportScope = exportTestResponse.ok;
    if (hasExportScope) {
      console.log(`[validateToken] PAT has crm.export scope - Export API available`);
    }

    // Build scopes list based on what we can access
    const scopes: string[] = ['crm.objects.companies.read'];
    if (hasListAccess) scopes.push('crm.lists.read');
    if (hasExportScope) scopes.push('crm.export');

    // For PATs, we can't enumerate scopes - we just test functionality
    return {
      valid: true,
      portalId,
      scopes,
      missingScopes: hasListAccess ? undefined : ['crm.lists.read'],
      hasExportScope,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Token validation failed',
    };
  }
}

/**
 * Create a HubSpot client from an access token.
 * Validates the token and returns client if valid.
 */
export async function createHubSpotClient(
  accessToken: string,
  initialBurstLimit?: number
): Promise<{ client: HubSpotClient; portalId: string } | { error: string }> {
  const validation = await validateToken(accessToken);

  if (!validation.valid || !validation.portalId) {
    return { error: validation.error || 'Invalid token' };
  }

  return {
    client: new HubSpotClient(accessToken, validation.portalId, initialBurstLimit),
    portalId: validation.portalId,
  };
}
