/**
 * Dashboard Redesign Tests
 *
 * Tests for new dashboard API routes and UI components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
};

vi.mock('@/lib/queue/redis', () => ({
  getRedisConnection: () => mockRedis,
}));

// Mock Supabase
const mockSupabaseAdmin = {
  from: vi.fn(),
};

vi.mock('@/lib/db/admin-client', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

// Mock HubSpot token
vi.mock('@/lib/hubspot/get-access-token', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-token'),
}));

// Mock auth
vi.mock('@/lib/auth/clerk-helpers', () => ({
  getOrgContext: vi.fn().mockResolvedValue({
    orgId: 'org_test123',
    userId: 'user_test456',
    orgRole: 'org:admin',
  }),
  authError: vi.fn(),
}));

describe('Dashboard API Routes', () => {
  // Shared mock functions for Supabase chain
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockGte = vi.fn();
  const mockNot = vi.fn();
  const mockOr = vi.fn();

  const setupSupabaseMocks = () => {
    mockFrom.mockImplementation((table: string) => {
      const mockData = {
        normalization_runs: [{ records_processed: 100 }],
        dedup_clusters: [],
        dedup_pairs: [],
        arrangement_run_progress: [{ fields_updated: 50 }],
        csv_imports: [{ id: '1' }],
      };

      const mockCounts = {
        dedup_clusters: 5,
      };

      const finalResult = {
        data: mockData[table as keyof typeof mockData] || [],
        count: mockCounts[table as keyof typeof mockCounts] || 0,
        error: null,
      };

      // Create fully chainable mock - any method can call any other method
      const createChain = (): any => {
        const chain: any = {};

        chain.eq = (...args: any[]) => {
          mockEq(...args); // Track on module-level mock
          return chain;
        };

        chain.gte = (...args: any[]) => {
          mockGte(...args); // Track on module-level mock
          return chain;
        };

        chain.not = (...args: any[]) => {
          mockNot(...args); // Track on module-level mock
          return Promise.resolve(finalResult);
        };

        chain.or = (...args: any[]) => {
          mockOr(...args); // Track on module-level mock
          return Promise.resolve(finalResult);
        };

        chain.then = (resolve: any) => Promise.resolve(finalResult).then(resolve);

        return chain;
      };

      const chain = createChain();

      // Track calls on module-level mocks
      const selectMock = (...args: any[]) => {
        mockSelect(...args);
        return chain;
      };

      return { select: selectMock };
    });

    mockSupabaseAdmin.from = mockFrom;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue(null); // Clear cache by default
    setupSupabaseMocks();
    // Reset module cache to ensure fresh imports
    vi.resetModules();
  });

  describe('GET /api/dashboard/summary', () => {
    it('should return summary with lastNight stats and pendingAttention items', async () => {
      const { GET } = await import('@/app/api/dashboard/summary/route');
      const request = new Request('http://localhost:3000/api/dashboard/summary');
      const response = await GET(request as any);
      const data = await response.json();

      expect(data).toHaveProperty('lastNight');
      expect(data).toHaveProperty('pendingAttention');
      expect(data.lastNight).toHaveProperty('recordsNormalized');
      expect(data.lastNight).toHaveProperty('dupesFound');
      expect(data.lastNight).toHaveProperty('fieldsFilled');
      expect(data.lastNight).toHaveProperty('importsProcessed');
    });

    it('should cache results in Redis with 15 minute TTL', async () => {
      const { GET } = await import('@/app/api/dashboard/summary/route');
      const request = new Request('http://localhost:3000/api/dashboard/summary');
      await GET(request as any);

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('dashboard:summary:org_test123'),
        expect.any(String),
        'EX',
        15 * 60
      );
    });

    it('should return cached data when available', async () => {
      const cachedData = {
        lastNight: {
          recordsNormalized: 50,
          dupesFound: 3,
          fieldsFilled: 100,
          importsProcessed: 2,
        },
        pendingAttention: [],
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const { GET } = await import('@/app/api/dashboard/summary/route');
      const request = new Request('http://localhost:3000/api/dashboard/summary');
      const response = await GET(request as any);
      const data = await response.json();

      expect(data).toEqual(cachedData);
      expect(mockSupabaseAdmin.from).not.toHaveBeenCalled();
    });

    it('should bust cache when refresh=true', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ cached: true }));

      const { GET } = await import('@/app/api/dashboard/summary/route');
      const request = new Request('http://localhost:3000/api/dashboard/summary?refresh=true');
      await GET(request as any);

      // Should query database even if cache exists
      expect(mockSupabaseAdmin.from).toHaveBeenCalled();
    });

    it('should filter data by 24 hour window', async () => {
      const { GET } = await import('@/app/api/dashboard/summary/route');
      const request = new Request('http://localhost:3000/api/dashboard/summary');
      await GET(request as any);

      // Verify gte() was called with a timestamp from ~24 hours ago
      expect(mockGte).toHaveBeenCalled();
      const gteCall = mockGte.mock.calls.find((call) => call[0] === 'completed_at' || call[0] === 'created_at');
      expect(gteCall).toBeDefined();

      const timestamp = new Date(gteCall[1]); // Second argument is the timestamp value
      const now = new Date();
      const diff = now.getTime() - timestamp.getTime();

      // Should be approximately 24 hours (allow 1 minute margin)
      expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(diff).toBeLessThan(25 * 60 * 60 * 1000);
    });
  });

  describe('GET /api/dashboard/fill-rates', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
      mockRedis.get.mockResolvedValue(null); // Clear Redis cache for fill-rates tests
    });

    it('should return fill rates for company objectType', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { properties: { industry: 'Tech', numberofemployees: '100', phone: '' } },
            { properties: { industry: 'Finance', numberofemployees: '', phone: '123-456-7890' } },
          ],
        }),
      });

      const { GET } = await import('@/app/api/dashboard/fill-rates/route');
      const request = new Request('http://localhost:3000/api/dashboard/fill-rates?objectType=company');
      const response = await GET(request as any);
      const data = await response.json();

      expect(data).toHaveProperty('fillRates');
      expect(data.fillRates).toBeInstanceOf(Array);
      expect(data.fillRates[0]).toHaveProperty('name');
      expect(data.fillRates[0]).toHaveProperty('label');
      expect(data.fillRates[0]).toHaveProperty('rate');
    });

    it('should return fill rates for contact objectType', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { properties: { email: 'test@test.com', phone: '', jobtitle: 'Engineer' } },
          ],
        }),
      });

      const { GET } = await import('@/app/api/dashboard/fill-rates/route');
      const request = new Request('http://localhost:3000/api/dashboard/fill-rates?objectType=contact');
      const response = await GET(request as any);
      const data = await response.json();

      expect(data.fillRates).toBeDefined();
    });

    it('should cache results with 1 hour TTL', async () => {
      mockRedis.get.mockResolvedValue(null);

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const { GET } = await import('@/app/api/dashboard/fill-rates/route');
      const request = new Request('http://localhost:3000/api/dashboard/fill-rates?objectType=company');
      await GET(request as any);

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('dashboard:fill-rates:org_test123:company'),
        expect.any(String),
        'EX',
        60 * 60
      );
    });

    it('should validate objectType parameter', async () => {
      const { GET } = await import('@/app/api/dashboard/fill-rates/route');
      const request = new Request('http://localhost:3000/api/dashboard/fill-rates?objectType=invalid');
      const response = await GET(request as any);

      expect(response.status).toBe(400);
    });
  });
});

describe('Always On Integration', () => {
  describe('GET /api/settings/always-on-status', () => {
    it('should return enabled=true when digest_enabled is true', async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: { digest_enabled: true },
      });

      mockSupabaseAdmin.from = mockFrom;
      mockFrom.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const { GET } = await import('@/app/api/settings/always-on-status/route');
      const response = await GET();
      const data = await response.json();

      expect(data.enabled).toBe(true);
    });

    it('should return enabled=false when no config exists', async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
      });

      mockSupabaseAdmin.from = mockFrom;
      mockFrom.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const { GET } = await import('@/app/api/settings/always-on-status/route');
      const response = await GET();
      const data = await response.json();

      expect(data.enabled).toBe(false);
    });
  });
});
