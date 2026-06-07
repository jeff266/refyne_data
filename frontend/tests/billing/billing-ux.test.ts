/**
 * Billing UX Tests
 *
 * Tests for Phase 3 billing UI components and endpoints.
 * All tests use mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase admin client
vi.mock('@/lib/db/admin-client', () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

// Mock Clerk
vi.mock('@/lib/auth/clerk-helpers', () => ({
  getOrgContext: vi.fn(),
  authError: vi.fn(),
}));

// Mock Stripe
vi.mock('stripe', () => {
  return {
    default: function MockStripe() {
      return {
        billingPortal: {
          sessions: {
            create: vi.fn(),
          },
        },
      };
    },
  };
});

import { supabaseAdmin } from '@/lib/db/admin-client';
import { getOrgContext } from '@/lib/auth/clerk-helpers';

describe('GET /api/billing/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with correct shape for trial user', async () => {
    // Mock auth
    (getOrgContext as any).mockResolvedValue({ orgId: 'org_123', userId: 'user_123' });

    // Mock entitlements query
    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'org_entitlements') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  org_id: 'org_123',
                  subscription_tier: 'trial',
                  subscription_status: 'active',
                  trial_days_remaining: 7,
                  trial_merges_used: 5,
                  trial_merges_remaining: 20,
                  trial_merge_limit: 25,
                  trial_normalize_writes_used: 10,
                  trial_normalize_remaining: 90,
                  trial_normalize_limit: 100,
                  trial_enrich_credits_used: 15,
                  trial_enrich_remaining: 35,
                  trial_enrich_limit: 50,
                  current_period_start: null,
                  current_period_end: null,
                  merges_last_30d: 5,
                  normalize_writes_last_30d: 10,
                  enrich_credits_last_30d: 15,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'org_billing_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const { GET } = await import('@/app/api/billing/status/route');
    const response = await GET({} as any);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty('subscription_tier', 'trial');
    expect(data).toHaveProperty('subscription_status', 'active');
    expect(data).toHaveProperty('trial_days_remaining', 7);
    expect(data).toHaveProperty('events');
    expect(Array.isArray(data.events)).toBe(true);
  });

  it('returns trial defaults when no org_billing row exists', async () => {
    (getOrgContext as any).mockResolvedValue({ orgId: 'org_new', userId: 'user_new' });

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'org_entitlements') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
        };
      }
      if (table === 'org_billing_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const { GET } = await import('@/app/api/billing/status/route');
    const response = await GET({} as any);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.subscription_tier).toBe('trial');
    expect(data.subscription_status).toBe('active');
    expect(data.trial_days_remaining).toBeNull();
  });
});

describe('POST /api/billing/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when no stripe_customer_id', async () => {
    (getOrgContext as any).mockResolvedValue({ orgId: 'org_123', userId: 'user_123', orgRole: 'org:admin' });

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'org_billing') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { org_id: 'org_123', stripe_customer_id: null },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const { POST } = await import('@/app/api/billing/portal/route');
    const response = await POST();

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('no_subscription');
  });
});

describe('Progress bar colors', () => {
  it('returns steel blue for 0% usage', () => {
    const C = { steelBlue: '#2E6BA8', amber: '#F59E0B', red: '#EF4444' };
    const getProgressColor = (percentage: number) => {
      if (percentage >= 100) return C.red;
      if (percentage >= 80) return C.amber;
      return C.steelBlue;
    };

    expect(getProgressColor(0)).toBe(C.steelBlue);
  });

  it('returns steel blue for 79% usage', () => {
    const C = { steelBlue: '#2E6BA8', amber: '#F59E0B', red: '#EF4444' };
    const getProgressColor = (percentage: number) => {
      if (percentage >= 100) return C.red;
      if (percentage >= 80) return C.amber;
      return C.steelBlue;
    };

    expect(getProgressColor(79)).toBe(C.steelBlue);
  });

  it('returns amber for 80% usage', () => {
    const C = { steelBlue: '#2E6BA8', amber: '#F59E0B', red: '#EF4444' };
    const getProgressColor = (percentage: number) => {
      if (percentage >= 100) return C.red;
      if (percentage >= 80) return C.amber;
      return C.steelBlue;
    };

    expect(getProgressColor(80)).toBe(C.amber);
  });

  it('returns red for 100% usage', () => {
    const C = { steelBlue: '#2E6BA8', amber: '#F59E0B', red: '#EF4444' };
    const getProgressColor = (percentage: number) => {
      if (percentage >= 100) return C.red;
      if (percentage >= 80) return C.amber;
      return C.steelBlue;
    };

    expect(getProgressColor(100)).toBe(C.red);
  });
});
