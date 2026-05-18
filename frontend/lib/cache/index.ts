/**
 * Provider Entity Cache Module
 *
 * Caches enrichment provider responses to avoid redundant API calls.
 * Supports multiple providers per entity with TTL-based expiration.
 */

// Types
export type {
  CacheEntityType,
  CacheProvider,
  CacheRow,
  CacheEntry,
  CacheGetResult,
  EnrichmentSource,
  ResolvedCompanyWithSource,
} from './types';

export {
  COMPANY_CACHE_TTL_DAYS,
  CONTACT_CACHE_TTL_DAYS,
  calculateTTLExpiration,
} from './types';

// Repository
export {
  get,
  set,
  getByProviderId,
  getAllValid,
  evictExpired,
  clearOrgCache,
} from './cache-repository';

// Resolver
export {
  resolve,
  extractProviderIds,
  getApolloOrgId,
  getLinkedInUrl,
} from './cache-resolver';
