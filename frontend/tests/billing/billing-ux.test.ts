/**
 * Billing UX Tests - Phase 3
 *
 * Tests billing status endpoint shape, portal 400 behaviour,
 * progress-bar color logic, and TrialWidget visibility guard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Progress-bar color threshold logic (pure)
// ---------------------------------------------------------------------------

function progressBarColor(pct: number): string {
  if (pct >= 100) return 'red';
  if (pct >= 80) return 'amber';
  return 'steel';
}

describe('progressBarColor()', () => {
  it('0% → steel', () => {
    expect(progressBarColor(0)).toBe('steel');
  });

  it('79% → steel', () => {
    expect(progressBarColor(79)).toBe('steel');
  });

  it('80% → amber', () => {
    expect(progressBarColor(80)).toBe('amber');
  });

  it('99% → amber', () => {
    expect(progressBarColor(99)).toBe('amber');
  });

  it('100% → red', () => {
    expect(progressBarColor(100)).toBe('red');
  });

  it('over 100% (capped) → red', () => {
    expect(progressBarColor(110)).toBe('red');
  });
});

// ---------------------------------------------------------------------------
// 2. Trial widget visibility guard (pure)
// ---------------------------------------------------------------------------

function shouldShowTrialWidget(tier: string, status: string): boolean {
  return tier === 'trial' && status === 'active';
}

describe('shouldShowTrialWidget()', () => {
  it('trial + active → show', () => {
    expect(shouldShowTrialWidget('trial', 'active')).toBe(true);
  });

  it('starter + active → hide', () => {
    expect(shouldShowTrialWidget('starter', 'active')).toBe(false);
  });

  it('growth + active → hide', () => {
    expect(shouldShowTrialWidget('growth', 'active')).toBe(false);
  });

  it('scale + active → hide', () => {
    expect(shouldShowTrialWidget('scale', 'active')).toBe(false);
  });

  it('trial + cancelled → hide', () => {
    expect(shouldShowTrialWidget('trial', 'cancelled')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. BillingTab section visibility logic (pure)
// ---------------------------------------------------------------------------

function shouldShowDangerZone(status: string, tier: string, hasCustomer: boolean): boolean {
  return (status === 'active' || status === 'past_due') &&
    hasCustomer &&
    ['starter', 'growth', 'scale'].includes(tier);
}

describe('shouldShowDangerZone()', () => {
  it('starter + active + has customer → show', () => {
    expect(shouldShowDangerZone('active', 'starter', true)).toBe(true);
  });

  it('growth + past_due + has customer → show', () => {
    expect(shouldShowDangerZone('past_due', 'growth', true)).toBe(true);
  });

  it('trial + active + no customer → hide', () => {
    expect(shouldShowDangerZone('active', 'trial', false)).toBe(false);
  });

  it('starter + cancelled + has customer → hide', () => {
    expect(shouldShowDangerZone('cancelled', 'starter', true)).toBe(false);
  });

  it('starter + active + no customer → hide', () => {
    expect(shouldShowDangerZone('active', 'starter', false)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. GET /api/billing/status - returns 200 with correct shape
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/clerk-helpers', () => ({
  getOrgContext: vi.fn().mockResolvedValue({
    orgId: 'test-org',
    orgRole: 'org:admin',
    userId: 'user-1',
    userEmail: 'test@example.com',
  }),
  authError: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/db/admin-client', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import { supabaseAdmin } from '@/lib/db/admin-client';
import { GET as billingStatusGET } from '@/app/api/billing/status/route';
import { NextRequest } from 'next/server';

function mockEntitlementsQuery(entitlements: any) {
  (supabaseAdmin.from as any).mockImplementation((table: string) => {
    if (table === 'org_entitlements') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: entitlements, error: null }),
          }),
        }),
      };
    }
    if (table === 'org_billing_events') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      };
    }
    return { select: vi.fn().mockReturnThis() };
  });
}

describe('GET /api/billing/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with correct shape for trial org', async () => {
    const entitlements = {
      org_id: 'test-org',
      subscription_tier: 'trial',
      subscription_status: 'active',
      stripe_customer_id: null,
      trial_days_remaining: 10,
      trial_merges_used: 5,
      trial_normalize_writes_used: 20,
      trial_enrich_credits_used: 10,
      trial_merge_limit: 25,
      trial_normalize_limit: 100,
      trial_enrich_limit: 50,
      merges_last_30d: 0,
      normalize_writes_last_30d: 0,
      enrich_credits_last_30d: 0,
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
    };

    mockEntitlementsQuery(entitlements);

    const req = new NextRequest('http://localhost/api/billing/status');
    const res = await billingStatusGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      subscription_tier: 'trial',
      subscription_status: 'active',
      stripe_customer_id: null,
      trial_days_remaining: 10,
      trial_merges_used: 5,
      events: [],
    });
    expect(Array.isArray(body.events)).toBe(true);
  });

  it('returns trial defaults when no org_billing row exists', async () => {
    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'org_entitlements') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'org_billing_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnThis() };
    });

    const req = new NextRequest('http://localhost/api/billing/status');
    const res = await billingStatusGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.subscription_tier).toBe('trial');
    expect(body.subscription_status).toBe('active');
    expect(body.events).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. POST /api/billing/portal - returns 400 when no stripe_customer_id
// ---------------------------------------------------------------------------

vi.mock('stripe', () => ({
  default: class MockStripe {
    billingPortal = { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/portal' }) } };
  },
}));

import { POST as portalPOST } from '@/app/api/billing/portal/route';

describe('POST /api/billing/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when no stripe_customer_id', async () => {
    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { stripe_customer_id: null },
            error: null,
          }),
        }),
      }),
    });

    const res = await portalPOST();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('no_subscription');
  });

  it('returns 400 when org_billing row missing', async () => {
    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const res = await portalPOST();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('no_subscription');
  });

});
