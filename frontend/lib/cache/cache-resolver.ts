/**
 * Cache Resolver
 *
 * Resolves multiple cached provider responses into a single canonical entity.
 * Reuses the existing resolution engine from the harmonies pipeline.
 */

import type { CacheRow } from './types';
import type {
  CanonicalCompany,
  CompanyFields,
} from '../harmonies/canonical/company';
import {
  createEmptyCompany,
} from '../harmonies/canonical/company';
import {
  resolveField,
  type CandidateValue,
  type ResolvedField,
  type ResolutionStrategy,
} from '../harmonies/canonical/provenance';

/**
 * Default resolution strategy for cached data.
 * Priority-based resolution using standard provider ordering.
 */
const DEFAULT_STRATEGY: ResolutionStrategy = 'priority';

/**
 * Default provider priority order.
 * More authoritative sources first.
 */
const DEFAULT_PRIORITY_ORDER = [
  'zoominfo',  // Highest quality business data
  'apollo',    // Strong B2B data
  'clay',      // Multi-source aggregator
  'graphiq',   // Capability-focused
  'serper',    // Web search results
  'yelp',      // Local business data
];

/**
 * Company field names that can be resolved from cache.
 */
const COMPANY_FIELDS: (keyof CompanyFields)[] = [
  'name',
  'domain',
  'industry',
  'industry_raw',
  'employee_count',
  'employee_band',
  'annual_revenue',
  'revenue_band',
  'hq_country',
  'hq_state',
  'hq_city',
  'hq_address',
  'hq_postal_code',
  'founded_year',
  'linkedin_url',
  'description',
  'logo_url',
  'phone',
  'website',
  'technologies',
  'twitter_url',
  'facebook_url',
];

/**
 * Resolve multiple cache rows into a single CanonicalCompany.
 *
 * Uses the same resolution strategies as live enrichment:
 * - priority: Ordered provider list, first non-null wins
 * - recency: Most recently retrieved value wins
 * - consensus: Most common value wins
 * - conservative: Safest/lowest value wins
 *
 * @param rows - Cache rows from different providers for the same entity
 * @param strategy - Resolution strategy (default: priority)
 * @param priorityOrder - Provider priority order (default: standard order)
 * @returns Resolved CanonicalCompany or null if rows is empty
 */
export function resolve(
  rows: CacheRow[],
  strategy: ResolutionStrategy = DEFAULT_STRATEGY,
  priorityOrder: string[] = DEFAULT_PRIORITY_ORDER
): CanonicalCompany | null {
  if (rows.length === 0) {
    return null;
  }

  // Extract domain and name from first row with values
  let domain = '';
  let name = '';

  for (const row of rows) {
    const data = row.canonical_data as Record<string, unknown>;
    if (!domain && data.domain) {
      domain = String(data.domain);
    }
    if (!name && data.name) {
      name = String(data.name);
    }
    if (domain && name) break;
  }

  if (!domain && !name) {
    // No identifiers - cannot create company
    return null;
  }

  // Create base company
  const providers = rows.map((r) => r.provider);
  const company = createEmptyCompany(name || domain, domain || '', providers[0]);
  company._meta.providers_used = providers;

  // Resolve each field
  for (const fieldName of COMPANY_FIELDS) {
    const resolved = resolveFieldFromCache(
      rows,
      fieldName,
      strategy,
      priorityOrder
    );

    if (resolved) {
      (company as unknown as Record<string, ResolvedField<unknown>>)[fieldName] = resolved;
    }
  }

  // Update metadata
  company._meta.updated_at = new Date().toISOString();

  return company;
}

/**
 * Resolve a single field from cache rows.
 */
function resolveFieldFromCache<T>(
  rows: CacheRow[],
  fieldName: string,
  strategy: ResolutionStrategy,
  priorityOrder: string[]
): ResolvedField<T> | null {
  // Build candidates from cache rows
  const candidates: CandidateValue<T>[] = [];

  for (const row of rows) {
    const data = row.canonical_data as Record<string, unknown>;
    const value = data[fieldName];

    if (value !== undefined && value !== null) {
      candidates.push({
        provider: row.provider,
        value: value as T,
        retrieved_at: row.retrieved_at,
        raw_value: row.raw_response?.[fieldName],
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Use the existing resolveField function
  return resolveField<T>(candidates, strategy, { priorityOrder });
}

/**
 * Extract provider IDs from cache rows.
 * Used for dedup index population.
 */
export function extractProviderIds(rows: CacheRow[]): Map<string, string> {
  const providerIds = new Map<string, string>();

  for (const row of rows) {
    providerIds.set(row.provider, row.provider_id);
  }

  return providerIds;
}

/**
 * Get the Apollo org_id from cache rows if present.
 */
export function getApolloOrgId(rows: CacheRow[]): string | null {
  for (const row of rows) {
    if (row.provider === 'apollo') {
      return row.provider_id;
    }
  }
  return null;
}

/**
 * Get the LinkedIn URL from cache rows if present.
 */
export function getLinkedInUrl(rows: CacheRow[]): string | null {
  for (const row of rows) {
    const data = row.canonical_data as Record<string, unknown>;
    if (data.linkedin_url) {
      return String(data.linkedin_url);
    }
  }
  return null;
}
