import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/hubspot/owners/batch/route';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { getOrgContext } from '@/lib/auth/clerk-helpers';
import { getAccessToken } from '@/lib/hubspot/get-access-token';

// Mock dependencies
vi.mock('@/lib/auth/clerk-helpers');
vi.mock('@/lib/hubspot/get-access-token');
vi.mock('@/lib/db/admin-client', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

describe('POST /api/hubspot/owners/batch', () => {
  const mockOrgId = 'org_test123';
  const mockPortalId = 'portal_456';
  const mockAccessToken = 'test_token_abc';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock getOrgContext to return test org
    vi.mocked(getOrgContext).mockResolvedValue({
      orgId: mockOrgId,
      userId: 'user_123',
    });

    // Mock getAccessToken
    vi.mocked(getAccessToken).mockResolvedValue(mockAccessToken);

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns cached owners without calling HubSpot API (cache hit)', async () => {
    const ownerIds = ['12345', '67890'];
    const cachedData = [
      {
        owner_id: '12345',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      },
      {
        owner_id: '67890',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
      },
    ];

    // Mock hubspot_connections query
    const mockConnectionsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { portal_id: mockPortalId },
        error: null,
      }),
    };

    // Mock hubspot_owners_cache query (cache hit)
    const mockCacheQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({
        data: cachedData,
        error: null,
      }),
    };

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'hubspot_connections') return mockConnectionsQuery as any;
      if (table === 'hubspot_owners_cache') return mockCacheQuery as any;
      return {} as any;
    });

    const request = new NextRequest('http://localhost:3000/api/hubspot/owners/batch', {
      method: 'POST',
      body: JSON.stringify({ ownerIds }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Assert: Returns cached owners
    expect(data.owners).toEqual({
      '12345': { name: 'John Doe', email: 'john@example.com' },
      '67890': { name: 'Jane Smith', email: 'jane@example.com' },
    });

    // Assert: Did NOT call HubSpot API (cache hit)
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches from HubSpot and stores in cache (cache miss)', async () => {
    const ownerIds = ['99999'];
    const hubspotOwnerData = {
      id: '99999',
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice@example.com',
      archived: false,
    };

    // Mock hubspot_connections query
    const mockConnectionsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { portal_id: mockPortalId },
        error: null,
      }),
    };

    // Mock hubspot_owners_cache query (cache miss - no data)
    const mockCacheSelectQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({
        data: [], // Empty - cache miss
        error: null,
      }),
    };

    // Mock cache upsert
    const mockCacheUpsertQuery = {
      upsert: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };

    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'hubspot_connections') return mockConnectionsQuery as any;
      if (table === 'hubspot_owners_cache') {
        callCount++;
        if (callCount === 1) return mockCacheSelectQuery as any; // First call is SELECT
        return mockCacheUpsertQuery as any; // Subsequent calls are UPSERT
      }
      return {} as any;
    });

    // Mock HubSpot API response
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => hubspotOwnerData,
    } as Response);

    const request = new NextRequest('http://localhost:3000/api/hubspot/owners/batch', {
      method: 'POST',
      body: JSON.stringify({ ownerIds }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Assert: Returns owner data from HubSpot
    expect(data.owners).toEqual({
      '99999': { name: 'Alice Johnson', email: 'alice@example.com' },
    });

    // Assert: Called HubSpot API
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.hubapi.com/crm/v3/owners/99999',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockAccessToken}`,
        }),
      })
    );

    // Assert: Stored in cache
    expect(mockCacheUpsertQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: mockOrgId,
        portal_id: mockPortalId,
        owner_id: '99999',
        first_name: 'Alice',
        last_name: 'Johnson',
        email: 'alice@example.com',
        is_active: true,
      }),
      { onConflict: 'org_id,portal_id,owner_id' }
    );
  });
});
