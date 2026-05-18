/**
 * Cache Resolver Tests
 *
 * Tests for resolving multiple cached provider responses into a canonical entity.
 */

import { describe, it, expect } from 'vitest';
import {
  resolve,
  extractProviderIds,
  getApolloOrgId,
  getLinkedInUrl,
} from './cache-resolver';
import type { CacheRow } from './types';

/**
 * Create a mock cache row for testing.
 */
function createMockRow(overrides: Partial<CacheRow> = {}): CacheRow {
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    id: 'row-1',
    org_id: 'org-123',
    entity_type: 'company',
    provider: 'apollo',
    provider_id: 'apollo-12345',
    domain: 'example.com',
    email: null,
    canonical_data: {
      name: 'Example Inc',
      domain: 'example.com',
      industry: 'software',
    },
    raw_response: null,
    retrieved_at: now.toISOString(),
    ttl_expires_at: future.toISOString(),
    hit_count: 0,
    created_at: now.toISOString(),
    ...overrides,
  };
}

describe('cache-resolver', () => {
  describe('resolve()', () => {
    it('returns null for empty rows', () => {
      const result = resolve([]);
      expect(result).toBeNull();
    });

    it('resolves single provider row to correct canonical output', () => {
      const row = createMockRow({
        provider: 'apollo',
        canonical_data: {
          name: 'Test Company',
          domain: 'test.com',
          industry: 'software',
          employee_count: 150,
          annual_revenue: 5000000,
          hq_city: 'San Francisco',
          hq_state: 'CA',
          hq_country: 'US',
        },
      });

      const result = resolve([row]);

      expect(result).not.toBeNull();
      expect(result!.name.value).toBe('Test Company');
      expect(result!.domain.value).toBe('test.com');
      expect(result!.industry.value).toBe('software');
      expect(result!.employee_count.value).toBe(150);
      expect(result!.annual_revenue.value).toBe(5000000);
      expect(result!.hq_city.value).toBe('San Francisco');
      expect(result!.hq_state.value).toBe('CA');
      expect(result!.hq_country.value).toBe('US');
    });

    it('resolves two provider rows using priority strategy', () => {
      const now = new Date();

      const apolloRow = createMockRow({
        provider: 'apollo',
        provider_id: 'apollo-1',
        canonical_data: {
          name: 'Apollo Name',
          domain: 'example.com',
          employee_count: 100,
          industry: 'software',
        },
        retrieved_at: now.toISOString(),
      });

      const zoominfoRow = createMockRow({
        id: 'row-2',
        provider: 'zoominfo',
        provider_id: 'zi-1',
        canonical_data: {
          name: 'ZoomInfo Name',
          domain: 'example.com',
          employee_count: 120,
          annual_revenue: 10000000,
        },
        retrieved_at: now.toISOString(),
      });

      // Default priority: zoominfo > apollo
      const result = resolve([apolloRow, zoominfoRow]);

      expect(result).not.toBeNull();
      // ZoomInfo has higher priority for name
      expect(result!.name.value).toBe('ZoomInfo Name');
      // ZoomInfo has higher priority for employee_count
      expect(result!.employee_count.value).toBe(120);
      // Apollo provides industry (ZoomInfo doesn't have it)
      expect(result!.industry.value).toBe('software');
      // ZoomInfo provides revenue
      expect(result!.annual_revenue.value).toBe(10000000);
    });

    it('resolves using recency strategy when specified', () => {
      const older = new Date('2024-01-01T00:00:00Z');
      const newer = new Date('2024-06-01T00:00:00Z');

      const olderRow = createMockRow({
        provider: 'zoominfo',
        canonical_data: {
          name: 'Old Name',
          domain: 'example.com',
          employee_count: 100,
        },
        retrieved_at: older.toISOString(),
      });

      const newerRow = createMockRow({
        id: 'row-2',
        provider: 'apollo',
        canonical_data: {
          name: 'New Name',
          domain: 'example.com',
          employee_count: 150,
        },
        retrieved_at: newer.toISOString(),
      });

      const result = resolve([olderRow, newerRow], 'recency');

      expect(result).not.toBeNull();
      // Newer row wins
      expect(result!.name.value).toBe('New Name');
      expect(result!.employee_count.value).toBe(150);
    });

    it('resolves using consensus strategy', () => {
      const row1 = createMockRow({
        provider: 'apollo',
        canonical_data: {
          name: 'Consensus Corp',
          domain: 'consensus.com',
          industry: 'software',
        },
      });

      const row2 = createMockRow({
        id: 'row-2',
        provider: 'zoominfo',
        canonical_data: {
          name: 'Consensus Corp',
          domain: 'consensus.com',
          industry: 'technology',
        },
      });

      const row3 = createMockRow({
        id: 'row-3',
        provider: 'clay',
        canonical_data: {
          name: 'Consensus Corp',
          domain: 'consensus.com',
          industry: 'software',
        },
      });

      const result = resolve([row1, row2, row3], 'consensus');

      expect(result).not.toBeNull();
      expect(result!.name.value).toBe('Consensus Corp');
      // software appears twice, technology once - software wins
      expect(result!.industry.value).toBe('software');
    });

    it('includes all providers in _meta.providers_used', () => {
      const rows = [
        createMockRow({ provider: 'apollo' }),
        createMockRow({ id: 'row-2', provider: 'zoominfo' }),
        createMockRow({ id: 'row-3', provider: 'clay' }),
      ];

      const result = resolve(rows);

      expect(result).not.toBeNull();
      expect(result!._meta.providers_used).toContain('apollo');
      expect(result!._meta.providers_used).toContain('zoominfo');
      expect(result!._meta.providers_used).toContain('clay');
    });

    it('returns null when no rows have identifiers', () => {
      const row = createMockRow({
        canonical_data: {
          // No name or domain
          industry: 'software',
        },
      });

      const result = resolve([row]);
      expect(result).toBeNull();
    });
  });

  describe('extractProviderIds()', () => {
    it('extracts provider IDs from rows', () => {
      const rows = [
        createMockRow({ provider: 'apollo', provider_id: 'apollo-123' }),
        createMockRow({ id: 'row-2', provider: 'zoominfo', provider_id: 'zi-456' }),
      ];

      const providerIds = extractProviderIds(rows);

      expect(providerIds.get('apollo')).toBe('apollo-123');
      expect(providerIds.get('zoominfo')).toBe('zi-456');
    });
  });

  describe('getApolloOrgId()', () => {
    it('returns Apollo org_id when present', () => {
      const rows = [
        createMockRow({ provider: 'zoominfo', provider_id: 'zi-123' }),
        createMockRow({ id: 'row-2', provider: 'apollo', provider_id: 'apollo-org-456' }),
      ];

      const apolloId = getApolloOrgId(rows);
      expect(apolloId).toBe('apollo-org-456');
    });

    it('returns null when no Apollo row', () => {
      const rows = [
        createMockRow({ provider: 'zoominfo', provider_id: 'zi-123' }),
        createMockRow({ id: 'row-2', provider: 'clay', provider_id: 'clay-789' }),
      ];

      const apolloId = getApolloOrgId(rows);
      expect(apolloId).toBeNull();
    });
  });

  describe('getLinkedInUrl()', () => {
    it('returns LinkedIn URL from canonical_data', () => {
      const rows = [
        createMockRow({
          canonical_data: {
            name: 'Test Co',
            domain: 'test.com',
            linkedin_url: 'https://linkedin.com/company/test-co',
          },
        }),
      ];

      const url = getLinkedInUrl(rows);
      expect(url).toBe('https://linkedin.com/company/test-co');
    });

    it('returns first non-null LinkedIn URL', () => {
      const rows = [
        createMockRow({
          provider: 'apollo',
          canonical_data: { name: 'Test', domain: 'test.com' },
        }),
        createMockRow({
          id: 'row-2',
          provider: 'zoominfo',
          canonical_data: {
            name: 'Test',
            domain: 'test.com',
            linkedin_url: 'https://linkedin.com/company/test',
          },
        }),
      ];

      const url = getLinkedInUrl(rows);
      expect(url).toBe('https://linkedin.com/company/test');
    });

    it('returns null when no LinkedIn URL present', () => {
      const rows = [
        createMockRow({ canonical_data: { name: 'Test', domain: 'test.com' } }),
      ];

      const url = getLinkedInUrl(rows);
      expect(url).toBeNull();
    });
  });
});
