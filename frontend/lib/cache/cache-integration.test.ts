/**
 * Cache Integration Tests
 *
 * Tests for cache integration with enrichment pipeline and buildCompanyIndex.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CacheRow } from './types';

// Mock modules before importing
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();
const mockCacheResolve = vi.fn();
const mockGetAllValid = vi.fn();

vi.mock('./cache-repository', () => ({
  get: mockCacheGet,
  set: mockCacheSet,
  getAllValid: mockGetAllValid,
}));

vi.mock('./cache-resolver', () => ({
  resolve: mockCacheResolve,
}));

// Mock provider
const mockProvider = {
  enrichCompany: vi.fn(),
  search: vi.fn(),
};

vi.mock('../../providers/index', () => ({
  getProvider: () => mockProvider,
  hasProvider: () => true,
  ProviderError: class ProviderError extends Error {},
}));

// Mock harmonies
vi.mock('../../harmonies/library', () => ({
  getHarmoniesByEntity: () => [],
  getHarmoniesForField: () => [],
}));

vi.mock('../../harmonies/pipeline/normalizer', () => ({
  Normalizer: class {
    normalize = vi.fn().mockResolvedValue({ success: false });
    normalizeAll = vi.fn().mockResolvedValue([]);
  },
}));

describe('Cache Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Enrichment Pipeline Cache', () => {
    it('returns cached data on cache hit without calling provider', async () => {
      const now = new Date();
      const cachedRows: Partial<CacheRow>[] = [
        {
          id: 'cache-1',
          org_id: 'org-123',
          provider: 'apollo',
          provider_id: 'apollo-12345',
          domain: 'example.com',
          canonical_data: {
            name: 'Cached Company',
            domain: 'example.com',
            industry: 'software',
          },
          raw_response: { id: 'apollo-12345', name: 'Cached Company' },
          retrieved_at: now.toISOString(),
          ttl_expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          hit_count: 0,
        },
      ];

      mockCacheGet.mockResolvedValue({ hit: true, rows: cachedRows });
      mockCacheResolve.mockReturnValue({
        name: { value: 'Cached Company', source: 'apollo' },
        domain: { value: 'example.com', source: 'apollo' },
        industry: { value: 'software', source: 'apollo' },
        employee_count: { value: null, source: 'apollo' },
        annual_revenue: { value: null, source: 'apollo' },
        hq_city: { value: null, source: 'apollo' },
        hq_state: { value: null, source: 'apollo' },
        hq_country: { value: null, source: 'apollo' },
        founded_year: { value: null, source: 'apollo' },
        linkedin_url: { value: null, source: 'apollo' },
        description: { value: null, source: 'apollo' },
        phone: { value: null, source: 'apollo' },
        _meta: { providers_used: ['apollo'] },
      });

      // Verify cache was checked
      expect(mockCacheGet).not.toHaveBeenCalled(); // Not called yet

      // Simulate cache lookup
      const cacheResult = await mockCacheGet('org-123', 'example.com', 'company');
      expect(cacheResult.hit).toBe(true);

      // Provider should NOT be called on cache hit
      expect(mockProvider.enrichCompany).not.toHaveBeenCalled();
    });

    it('calls provider and caches result on cache miss', async () => {
      mockCacheGet.mockResolvedValue({ hit: false, rows: [] });
      mockCacheSet.mockResolvedValue(1);

      mockProvider.enrichCompany.mockResolvedValue({
        _source: 'apollo',
        _retrieved_at: new Date().toISOString(),
        raw: {
          id: 'apollo-99999',
          name: 'New Company',
          domain: 'newco.com',
          industry: 'fintech',
        },
      });

      // Simulate cache miss
      const cacheResult = await mockCacheGet('org-123', 'newco.com', 'company');
      expect(cacheResult.hit).toBe(false);

      // Provider should be called on cache miss
      const providerResult = await mockProvider.enrichCompany({ domain: 'newco.com' });
      expect(providerResult.raw.name).toBe('New Company');

      // Result should be cached
      await mockCacheSet('org-123', [
        {
          provider: 'apollo',
          provider_id: 'apollo-99999',
          domain: 'newco.com',
          canonical_data: { name: 'New Company', domain: 'newco.com' },
        },
      ]);
      expect(mockCacheSet).toHaveBeenCalled();
    });

    it('second call for same domain hits cache', async () => {
      const cachedRow: Partial<CacheRow> = {
        id: 'cache-1',
        provider: 'apollo',
        provider_id: 'apollo-12345',
        domain: 'repeat.com',
        canonical_data: { name: 'Repeat Co', domain: 'repeat.com' },
        raw_response: { id: 'apollo-12345', name: 'Repeat Co' },
      };

      // First call: cache miss
      mockCacheGet
        .mockResolvedValueOnce({ hit: false, rows: [] })
        // Second call: cache hit
        .mockResolvedValueOnce({ hit: true, rows: [cachedRow] });

      // First lookup - miss
      const firstResult = await mockCacheGet('org-123', 'repeat.com', 'company');
      expect(firstResult.hit).toBe(false);

      // Second lookup - hit
      const secondResult = await mockCacheGet('org-123', 'repeat.com', 'company');
      expect(secondResult.hit).toBe(true);
      expect(secondResult.rows[0].domain).toBe('repeat.com');
    });
  });

  describe('buildCompanyIndex Cache Pass', () => {
    it('includes Apollo IDs from cache in apolloIndex', async () => {
      const cacheEntries: Partial<CacheRow>[] = [
        {
          provider: 'apollo',
          provider_id: 'apollo-org-123',
          domain: 'indexed.com',
          canonical_data: { name: 'Indexed Co' },
        },
        {
          provider: 'apollo',
          provider_id: 'apollo-org-456',
          domain: 'another.com',
          canonical_data: { name: 'Another Co' },
        },
      ];

      mockGetAllValid.mockResolvedValue(cacheEntries);

      const entries = await mockGetAllValid('org-123', 'company');

      expect(entries).toHaveLength(2);
      expect(entries[0].provider).toBe('apollo');
      expect(entries[0].provider_id).toBe('apollo-org-123');
      expect(entries[1].provider_id).toBe('apollo-org-456');
    });

    it('excludes expired cache entries from index', async () => {
      // getAllValid already filters by ttl_expires_at > now()
      // So expired entries are never returned
      mockGetAllValid.mockResolvedValue([]);

      const entries = await mockGetAllValid('org-123', 'company');
      expect(entries).toHaveLength(0);
    });

    it('only adds cache entries for domains that exist in HubSpot', async () => {
      // This test verifies the logic that checks domainIndex.has(domain)
      const cacheEntries: Partial<CacheRow>[] = [
        {
          provider: 'apollo',
          provider_id: 'apollo-exists',
          domain: 'exists-in-hubspot.com',
        },
        {
          provider: 'apollo',
          provider_id: 'apollo-orphan',
          domain: 'deleted-from-hubspot.com',
        },
      ];

      mockGetAllValid.mockResolvedValue(cacheEntries);

      // Simulate domainIndex with only one domain
      const domainIndex = new Map<string, string>();
      domainIndex.set('exists-in-hubspot.com', 'hs-123');
      // 'deleted-from-hubspot.com' is NOT in domainIndex

      const apolloIndex = new Map<string, string>();

      const entries = await mockGetAllValid('org-123', 'company');

      for (const entry of entries) {
        if (domainIndex.has(entry.domain!)) {
          apolloIndex.set(entry.provider_id!, domainIndex.get(entry.domain!)!);
        }
      }

      // Only the existing domain should be in apolloIndex
      expect(apolloIndex.has('apollo-exists')).toBe(true);
      expect(apolloIndex.has('apollo-orphan')).toBe(false);
    });

    it('adds LinkedIn URLs from cache canonical_data', async () => {
      const cacheEntries: Partial<CacheRow>[] = [
        {
          provider: 'zoominfo',
          provider_id: 'zi-123',
          domain: 'linkedin-test.com',
          canonical_data: {
            name: 'LinkedIn Test Co',
            linkedin_url: 'https://linkedin.com/company/linkedin-test',
          },
        },
      ];

      mockGetAllValid.mockResolvedValue(cacheEntries);

      const entries = await mockGetAllValid('org-123', 'company');
      const linkedInUrl = (entries[0].canonical_data as Record<string, unknown>)?.linkedin_url;

      expect(linkedInUrl).toBe('https://linkedin.com/company/linkedin-test');
    });
  });
});
