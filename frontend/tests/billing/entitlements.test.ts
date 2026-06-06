/**
 * Entitlements Tests
 *
 * Tests canPerformAction() and getLimitStatus() with mocked DB.
 * No real database calls - uses vi.mock.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { consumeUsage } from '@/lib/billing/enforce';
import { getLimitStatus } from '@/lib/billing/entitlements';

// Mock Supabase admin client
vi.mock('@/lib/db/admin-client', () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { supabaseAdmin } from '@/lib/db/admin-client';

// Helper to create mock entitlements
function mockEntitlements(overrides: any = {}) {
  return {
    org_id: 'test-org',
    subscription_tier: 'trial',
    subscription_status: 'active',
    trial_merges_used: 0,
    trial_normalize_writes_used: 0,
    trial_enrich_credits_used: 0,
    trial_merge_limit: 25,
    trial_normalize_limit: 100,
    trial_enrich_limit: 50,
    trial_merges_remaining: 25,
    trial_normalize_remaining: 100,
    trial_enrich_remaining: 50,
    trial_end_date: new Date(Date.now() + 7 * 86400000).toISOString(),
    trial_days_remaining: 7,
    trial_start_date: new Date().toISOString(),
    merges_last_30d: 0,
    normalize_writes_last_30d: 0,
    enrich_credits_last_30d: 0,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    pro_monthly_enrich_credits: null,
    enterprise_monthly_enrich_credits: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('canPerformAction()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('trial + active + not expired + has remaining → allowed', async () => {
    const entitlements = mockEntitlements({ trial_merges_remaining: 10 });

    // Mock getEntitlements to return our test data
    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: entitlements,
            error: null,
          }),
        }),
      }),
    });

    // Mock RPC for trial counter increment
    (supabaseAdmin.rpc as any).mockResolvedValue({
      data: true,
      error: null,
    });

    const result = await consumeUsage('test-org', 'merge', 1);

    expect(result.allowed).toBe(true);
  });

  it('trial + active + expired (trial_end_date in past) → blocked', async () => {
    const entitlements = mockEntitlements({
      trial_end_date: new Date(Date.now() - 1000).toISOString(),
      trial_days_remaining: -0.01,
    });

    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: entitlements,
            error: null,
          }),
        }),
      }),
    });

    const result = await consumeUsage('test-org', 'merge', 1);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('trial + active + no remaining → blocked', async () => {
    const entitlements = mockEntitlements({ trial_merges_remaining: 0 });

    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: entitlements,
            error: null,
          }),
        }),
      }),
    });

    const result = await consumeUsage('test-org', 'merge', 1);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('limit');
  });

  it('starter + active → allowed (no limits)', async () => {
    const entitlements = mockEntitlements({
      subscription_tier: 'starter',
      subscription_status: 'active',
    });

    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: entitlements,
            error: null,
          }),
        }),
      }),
    });

    (supabaseAdmin.rpc as any).mockResolvedValue({
      data: null,
      error: null,
    });

    // Test all three action types
    const mergeResult = await consumeUsage('test-org', 'merge', 1);
    expect(mergeResult.allowed).toBe(true);

    const normalizeResult = await consumeUsage('test-org', 'normalize_write', 1);
    expect(normalizeResult.allowed).toBe(true);

    const enrichResult = await consumeUsage('test-org', 'enrich_credit', 1);
    expect(enrichResult.allowed).toBe(true);
  });

  it('growth + active → allowed', async () => {
    const entitlements = mockEntitlements({
      subscription_tier: 'growth',
      subscription_status: 'active',
    });

    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: entitlements,
            error: null,
          }),
        }),
      }),
    });

    (supabaseAdmin.rpc as any).mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await consumeUsage('test-org', 'merge', 1);
    expect(result.allowed).toBe(true);
  });

  it('scale + active → allowed', async () => {
    const entitlements = mockEntitlements({
      subscription_tier: 'scale',
      subscription_status: 'active',
    });

    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: entitlements,
            error: null,
          }),
        }),
      }),
    });

    (supabaseAdmin.rpc as any).mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await consumeUsage('test-org', 'merge', 1);
    expect(result.allowed).toBe(true);
  });

  it('starter + past_due → allowed (grace)', async () => {
    const entitlements = mockEntitlements({
      subscription_tier: 'starter',
      subscription_status: 'past_due',
    });

    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: entitlements,
            error: null,
          }),
        }),
      }),
    });

    (supabaseAdmin.rpc as any).mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await consumeUsage('test-org', 'merge', 1);
    expect(result.allowed).toBe(true);
  });

  it('starter + cancelled → blocked', async () => {
    const entitlements = mockEntitlements({
      subscription_tier: 'starter',
      subscription_status: 'cancelled',
    });

    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: entitlements,
            error: null,
          }),
        }),
      }),
    });

    const result = await consumeUsage('test-org', 'merge', 1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('cancelled');
  });

  it('trial + cancelled → blocked', async () => {
    const entitlements = mockEntitlements({
      subscription_tier: 'trial',
      subscription_status: 'cancelled',
    });

    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: entitlements,
            error: null,
          }),
        }),
      }),
    });

    const result = await consumeUsage('test-org', 'merge', 1);
    expect(result.allowed).toBe(false);
  });
});

describe('getLimitStatus()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('trial with 5 merges remaining → returns warning message', async () => {
    const entitlements = mockEntitlements({
      trial_merges_remaining: 5,
      trial_merges_used: 20,
    });

    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: entitlements,
            error: null,
          }),
        }),
      }),
    });

    const status = await getLimitStatus('test-org', 'merge');

    expect(status).toContain('5');
    expect(status).toContain('remaining');
  });

  it('trial expired → returns upgrade message', async () => {
    const entitlements = mockEntitlements({
      trial_days_remaining: -1,
    });

    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: entitlements,
            error: null,
          }),
        }),
      }),
    });

    const status = await getLimitStatus('test-org', 'merge');

    expect(status).toContain('expired');
    expect(status).toContain('Upgrade');
  });

  it('starter active → returns null (no limit message)', async () => {
    const entitlements = mockEntitlements({
      subscription_tier: 'starter',
      subscription_status: 'active',
    });

    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: entitlements,
            error: null,
          }),
        }),
      }),
    });

    const status = await getLimitStatus('test-org', 'merge');

    expect(status).toBeNull();
  });

  it('past_due → returns payment warning message', async () => {
    const entitlements = mockEntitlements({
      subscription_tier: 'starter',
      subscription_status: 'past_due',
    });

    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: entitlements,
            error: null,
          }),
        }),
      }),
    });

    const status = await getLimitStatus('test-org', 'merge');

    expect(status).toContain('past due');
    expect(status).toContain('payment');
  });
});
