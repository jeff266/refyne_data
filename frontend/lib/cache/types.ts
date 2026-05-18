/**
 * Provider Entity Cache Types
 *
 * Type definitions for the provider entity cache system.
 */

import type { CanonicalCompany } from '../harmonies/canonical/company';

/**
 * Entity types supported by the cache.
 */
export type CacheEntityType = 'company' | 'contact';

/**
 * Enrichment provider identifiers.
 */
export type CacheProvider = 'apollo' | 'zoominfo' | 'clay' | 'serper' | 'graphiq' | 'yelp';

/**
 * TTL constants for cache entries.
 */
export const COMPANY_CACHE_TTL_DAYS = 30;
export const CONTACT_CACHE_TTL_DAYS = 7;

/**
 * Cache entry as stored in the database.
 */
export interface CacheRow {
  id: string;
  org_id: string;
  entity_type: CacheEntityType;
  provider: CacheProvider;
  provider_id: string;
  domain: string | null;
  email: string | null;
  canonical_data: Record<string, unknown>;
  raw_response: Record<string, unknown> | null;
  retrieved_at: string;
  ttl_expires_at: string;
  hit_count: number;
  created_at: string;
}

/**
 * Cache entry for creating/updating.
 */
export interface CacheEntry {
  provider: CacheProvider;
  provider_id: string;
  entity_type: CacheEntityType;
  domain?: string;
  email?: string;
  canonical_data: Record<string, unknown>;
  raw_response?: Record<string, unknown>;
  ttl_expires_at: Date;
}

/**
 * Result of a cache lookup.
 */
export interface CacheGetResult {
  hit: boolean;
  rows: CacheRow[];
}

/**
 * Enrichment source indicator.
 */
export type EnrichmentSource = 'cache' | 'live';

/**
 * Resolved company with source indicator.
 */
export interface ResolvedCompanyWithSource {
  company: CanonicalCompany;
  source: EnrichmentSource;
  providers: string[];
}

/**
 * Calculate TTL expiration date based on entity type.
 */
export function calculateTTLExpiration(entityType: CacheEntityType): Date {
  const now = new Date();
  const ttlDays = entityType === 'company' ? COMPANY_CACHE_TTL_DAYS : CONTACT_CACHE_TTL_DAYS;
  return new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
}
