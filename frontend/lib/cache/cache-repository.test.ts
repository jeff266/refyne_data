/**
 * Cache Repository Tests
 *
 * Tests for the provider entity cache data access layer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CacheRow, CacheEntry, CacheEntityType } from './types';
import { COMPANY_CACHE_TTL_DAYS, calculateTTLExpiration } from './types';

// Create hoisted mock for supabase
const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../db/supabase', () => ({
  supabase: mockSupabase,
  isSupabaseConfigured: () => true,
}));

// Import after mocking
import { get, set, evictExpired, clearOrgCache } from './cache-repository';

describe('cache-repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get()', () => {
    it('returns empty array on cache miss', async () => {
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const gtMock = vi.fn().mockResolvedValue({ data: [], error: null });

      mockSupabase.from.mockReturnValue({
        select: selectMock,
        eq: eqMock,
        gt: gtMock,
      });

      const result = await get('org-123', 'example.com', 'company');

      expect(result.hit).toBe(false);
      expect(result.rows).toHaveLength(0);
    });

    it('returns rows on cache hit within TTL', async () => {
      const now = new Date();
      const futureExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const cachedRows: Partial<CacheRow>[] = [
        {
          id: 'cache-1',
          org_id: 'org-123',
          entity_type: 'company',
          provider: 'apollo',
          provider_id: 'apollo-12345',
          domain: 'example.com',
          canonical_data: { name: 'Example Inc' },
          retrieved_at: now.toISOString(),
          ttl_expires_at: futureExpiry.toISOString(),
          hit_count: 0,
        },
      ];

      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const gtMock = vi.fn().mockResolvedValue({ data: cachedRows, error: null });

      mockSupabase.from.mockReturnValue({
        select: selectMock,
        eq: eqMock,
        gt: gtMock,
      });

      // Mock RPC for hit count increment (fire-and-forget)
      mockSupabase.rpc.mockResolvedValue({ error: null });

      const result = await get('org-123', 'example.com', 'company');

      expect(result.hit).toBe(true);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].provider).toBe('apollo');
      expect(result.rows[0].domain).toBe('example.com');
    });

    it('returns empty array when TTL expired', async () => {
      // The gt() filter ensures expired rows are not returned
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const gtMock = vi.fn().mockResolvedValue({ data: [], error: null });

      mockSupabase.from.mockReturnValue({
        select: selectMock,
        eq: eqMock,
        gt: gtMock,
      });

      const result = await get('org-123', 'example.com', 'company');

      expect(result.hit).toBe(false);
      expect(result.rows).toHaveLength(0);
    });

    it('uses email for contact lookups', async () => {
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const gtMock = vi.fn().mockResolvedValue({ data: [], error: null });

      mockSupabase.from.mockReturnValue({
        select: selectMock,
        eq: eqMock,
        gt: gtMock,
      });

      await get('org-123', 'john@example.com', 'contact');

      // Verify 'email' column was used, not 'domain'
      expect(eqMock).toHaveBeenCalledWith('email', 'john@example.com');
    });
  });

  describe('set()', () => {
    it('upserts entries and sets ttl_expires_at', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from.mockReturnValue({
        upsert: upsertMock,
      });

      const entries: CacheEntry[] = [
        {
          provider: 'apollo',
          provider_id: 'apollo-12345',
          entity_type: 'company',
          domain: 'example.com',
          canonical_data: { name: 'Example Inc' },
          ttl_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      ];

      const count = await set('org-123', entries);

      expect(count).toBe(1);
      expect(upsertMock).toHaveBeenCalledTimes(1);
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: 'org-123',
          provider: 'apollo',
          provider_id: 'apollo-12345',
          domain: 'example.com',
          hit_count: 0,
        }),
        { onConflict: 'org_id,provider,provider_id' }
      );
    });

    it('resets hit_count to 0 on upsert', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from.mockReturnValue({
        upsert: upsertMock,
      });

      const entries: CacheEntry[] = [
        {
          provider: 'zoominfo',
          provider_id: 'zi-99999',
          entity_type: 'company',
          domain: 'test.com',
          canonical_data: { name: 'Test Co' },
          ttl_expires_at: calculateTTLExpiration('company'),
        },
      ];

      await set('org-123', entries);

      // Verify hit_count is 0
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hit_count: 0,
        }),
        expect.any(Object)
      );
    });

    it('handles multiple entries', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from.mockReturnValue({
        upsert: upsertMock,
      });

      const entries: CacheEntry[] = [
        {
          provider: 'apollo',
          provider_id: 'apollo-1',
          entity_type: 'company',
          domain: 'a.com',
          canonical_data: { name: 'A' },
          ttl_expires_at: calculateTTLExpiration('company'),
        },
        {
          provider: 'zoominfo',
          provider_id: 'zi-2',
          entity_type: 'company',
          domain: 'a.com',
          canonical_data: { name: 'A Corp' },
          ttl_expires_at: calculateTTLExpiration('company'),
        },
      ];

      const count = await set('org-123', entries);

      expect(count).toBe(2);
      expect(upsertMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('evictExpired()', () => {
    it('deletes only expired rows and returns count', async () => {
      const deletedIds = [{ id: '1' }, { id: '2' }, { id: '3' }];

      const deleteMock = vi.fn().mockReturnThis();
      const ltMock = vi.fn().mockReturnThis();
      const selectMock = vi.fn().mockResolvedValue({ data: deletedIds, error: null });

      mockSupabase.from.mockReturnValue({
        delete: deleteMock,
        lt: ltMock,
        select: selectMock,
      });

      const count = await evictExpired();

      expect(count).toBe(3);
      expect(deleteMock).toHaveBeenCalled();
      expect(ltMock).toHaveBeenCalledWith('ttl_expires_at', expect.any(String));
    });

    it('returns 0 when no expired entries', async () => {
      const deleteMock = vi.fn().mockReturnThis();
      const ltMock = vi.fn().mockReturnThis();
      const selectMock = vi.fn().mockResolvedValue({ data: [], error: null });

      mockSupabase.from.mockReturnValue({
        delete: deleteMock,
        lt: ltMock,
        select: selectMock,
      });

      const count = await evictExpired();

      expect(count).toBe(0);
    });
  });

  describe('TTL calculation', () => {
    it('calculates company TTL as 30 days', () => {
      const now = Date.now();
      const expiry = calculateTTLExpiration('company');
      const diffDays = (expiry.getTime() - now) / (24 * 60 * 60 * 1000);

      expect(Math.round(diffDays)).toBe(COMPANY_CACHE_TTL_DAYS);
    });

    it('calculates contact TTL as 7 days', () => {
      const now = Date.now();
      const expiry = calculateTTLExpiration('contact');
      const diffDays = (expiry.getTime() - now) / (24 * 60 * 60 * 1000);

      expect(Math.round(diffDays)).toBe(7);
    });
  });
});
