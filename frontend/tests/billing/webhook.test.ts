/**
 * Stripe Webhook Tests
 *
 * Tests POST /api/webhooks/stripe handler with mocked Stripe and DB.
 * No real Stripe or database calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/webhooks/stripe/route';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';

// Mock Stripe
vi.mock('stripe', () => {
  const MockStripe = vi.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: vi.fn(),
    },
  }));

  return { default: MockStripe };
});

// Mock Supabase
vi.mock('@/lib/db/admin-client', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

// Mock Sentry
vi.mock('@/lib/monitoring/sentry', () => ({
  captureException: vi.fn(),
}));

import { supabaseAdmin } from '@/lib/db/admin-client';

// Helper to create mock Stripe event
function makeStripeEvent(type: string, data: any): Stripe.Event {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2024-11-20.acacia',
    created: Date.now(),
    type,
    data: {
      object: data as any,
    },
    livemode: false,
    pending_webhooks: 0,
    request: {
      id: null,
      idempotency_key: null,
    },
  };
}

// Helper to create mock NextRequest
function createMockRequest(body: string): NextRequest {
  const headers = new Headers();
  headers.set('stripe-signature', 'test_signature');

  return {
    text: vi.fn().mockResolvedValue(body),
    headers,
  } as any;
}

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default Stripe mock behavior
    const Stripe = require('stripe').default;
    const mockStripeInstance = new Stripe();
    (mockStripeInstance.webhooks.constructEvent as any).mockImplementation(() => {
      return makeStripeEvent('customer.subscription.created', {});
    });
  });

  it('rejects invalid signature', async () => {
    const Stripe = require('stripe').default;
    const mockStripeInstance = new Stripe();

    // Mock signature verification failure
    const signatureError = new Error('Invalid signature') as any;
    signatureError.type = 'StripeSignatureVerificationError';
    (mockStripeInstance.webhooks.constructEvent as any).mockImplementation(() => {
      throw signatureError;
    });

    const request = createMockRequest('{}');
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('signature');
  });

  it('idempotency - duplicate event ignored', async () => {
    const eventId = `evt_test_${Date.now()}`;
    const event = makeStripeEvent('customer.subscription.created', {
      id: 'sub_123',
      customer: 'cus_123',
    });
    event.id = eventId;

    const Stripe = require('stripe').default;
    const mockStripeInstance = new Stripe();
    (mockStripeInstance.webhooks.constructEvent as any).mockReturnValue(event);

    // Mock idempotency check - event already exists
    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'stripe_webhook_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: eventId }, // Event already processed
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn(), insert: vi.fn() };
    });

    const request = createMockRequest('{}');
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.duplicate).toBe(true);
  });

  it('customer.subscription.created → upserts org_billing', async () => {
    const event = makeStripeEvent('customer.subscription.created', {
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      items: {
        data: [
          {
            price: {
              id: 'price_1TYa5ZD7K17UO95drYf0cCRi',
            },
          },
        ],
      },
      current_period_start: 1234567890,
      current_period_end: 1234571490,
      cancel_at_period_end: false,
    });

    const Stripe = require('stripe').default;
    const mockStripeInstance = new Stripe();
    (mockStripeInstance.webhooks.constructEvent as any).mockReturnValue(event);

    let updateCalled = false;
    let insertCalled = false;

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'stripe_webhook_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null, // Event not processed yet
                error: { code: 'PGRST116' },
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            data: null,
            error: null,
          }),
        };
      }

      if (table === 'org_billing') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { org_id: 'org_abc' },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockImplementation(() => {
            updateCalled = true;
            return {
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            };
          }),
        };
      }

      if (table === 'stripe_prices') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { tier: 'starter', billing_period: 'monthly' },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'org_billing_events') {
        return {
          insert: vi.fn().mockImplementation(() => {
            insertCalled = true;
            return {
              data: null,
              error: null,
            };
          }),
        };
      }

      return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
    });

    const request = createMockRequest('{}');
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(updateCalled).toBe(true);
    expect(insertCalled).toBe(true);
  });

  it('customer.subscription.updated → updates tier on upgrade', async () => {
    const event = makeStripeEvent('customer.subscription.updated', {
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      items: {
        data: [
          {
            price: {
              id: 'price_growth_monthly',
            },
          },
        ],
      },
      current_period_start: 1234567890,
      current_period_end: 1234571490,
      cancel_at_period_end: false,
    });

    const Stripe = require('stripe').default;
    const mockStripeInstance = new Stripe();
    (mockStripeInstance.webhooks.constructEvent as any).mockReturnValue(event);

    let updatedTier: string | null = null;

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'stripe_webhook_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }

      if (table === 'org_billing') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { org_id: 'org_abc' },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockImplementation((updates: any) => {
            updatedTier = updates.subscription_tier;
            return {
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }),
        };
      }

      if (table === 'stripe_prices') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { tier: 'growth', billing_period: 'monthly' },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'org_billing_events') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }

      return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
    });

    const request = createMockRequest('{}');
    await POST(request);

    expect(updatedTier).toBe('growth');
  });

  it('customer.subscription.deleted → reverts to trial', async () => {
    const event = makeStripeEvent('customer.subscription.deleted', {
      id: 'sub_123',
      customer: 'cus_123',
      canceled_at: 1234567890,
    });

    const Stripe = require('stripe').default;
    const mockStripeInstance = new Stripe();
    (mockStripeInstance.webhooks.constructEvent as any).mockReturnValue(event);

    let updatedData: any = null;

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'stripe_webhook_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }

      if (table === 'org_billing') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { org_id: 'org_abc' },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockImplementation((updates: any) => {
            updatedData = updates;
            return {
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }),
        };
      }

      if (table === 'org_billing_events') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }

      return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
    });

    const request = createMockRequest('{}');
    await POST(request);

    expect(updatedData.subscription_tier).toBe('trial');
    expect(updatedData.subscription_status).toBe('cancelled');
  });

  it('invoice.payment_failed → sets past_due', async () => {
    const event = makeStripeEvent('invoice.payment_failed', {
      id: 'in_123',
      customer: 'cus_123',
      subscription: 'sub_123',
      amount_due: 2990,
      attempt_count: 1,
    });

    const Stripe = require('stripe').default;
    const mockStripeInstance = new Stripe();
    (mockStripeInstance.webhooks.constructEvent as any).mockReturnValue(event);

    let updatedStatus: string | null = null;

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'stripe_webhook_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }

      if (table === 'org_billing') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { org_id: 'org_abc' },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockImplementation((updates: any) => {
            updatedStatus = updates.subscription_status;
            return {
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }),
        };
      }

      if (table === 'org_billing_events') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }

      return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
    });

    const request = createMockRequest('{}');
    await POST(request);

    expect(updatedStatus).toBe('past_due');
  });

  it('invoice.payment_succeeded → clears past_due', async () => {
    const event = makeStripeEvent('invoice.payment_succeeded', {
      id: 'in_123',
      customer: 'cus_123',
      subscription: 'sub_123',
      amount_paid: 2990,
    });

    const Stripe = require('stripe').default;
    const mockStripeInstance = new Stripe();
    (mockStripeInstance.webhooks.constructEvent as any).mockReturnValue(event);

    let updatedStatus: string | null = null;

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'stripe_webhook_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }

      if (table === 'org_billing') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { org_id: 'org_abc', subscription_status: 'past_due' },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockImplementation((updates: any) => {
            updatedStatus = updates.subscription_status;
            return {
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }),
        };
      }

      if (table === 'org_billing_events') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }

      return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
    });

    const request = createMockRequest('{}');
    await POST(request);

    expect(updatedStatus).toBe('active');
  });

  it('unknown event type → returns 200, no DB writes', async () => {
    const event = makeStripeEvent('payment_intent.created', {
      id: 'pi_123',
    });

    const Stripe = require('stripe').default;
    const mockStripeInstance = new Stripe();
    (mockStripeInstance.webhooks.constructEvent as any).mockReturnValue(event);

    let dbWriteCalled = false;

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'stripe_webhook_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }

      if (table === 'org_billing' || table === 'org_billing_events') {
        dbWriteCalled = true;
      }

      return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
    });

    const request = createMockRequest('{}');
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(dbWriteCalled).toBe(false);
  });
});
