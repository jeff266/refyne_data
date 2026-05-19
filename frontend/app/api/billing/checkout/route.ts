import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';
import Stripe from 'stripe';

// Lazy initialization to avoid build-time errors when STRIPE_SECRET_KEY is not set
let stripe: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-04-22.dahlia',
    });
  }
  return stripe;
}

/**
 * POST /api/billing/checkout
 *
 * Create Stripe checkout session for plan upgrade.
 *
 * Auth: org:admin (billing owner only)
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const {
      priceId,
      interval,
      addAlwaysOn = false,
      successUrl,
      cancelUrl,
    } = body;

    if (!priceId || !interval) {
      return NextResponse.json(
        { error: 'priceId and interval are required' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const { data: entitlements } = await supabase
      .from('workspace_entitlements')
      .select('stripe_customer_id, org_name')
      .eq('org_id', ctx.orgId)
      .single();

    let customerId = entitlements?.stripe_customer_id;

    if (!customerId) {
      // Create new Stripe customer
      const stripeClient = getStripeClient();
      const customer = await stripeClient.customers.create({
        email: ctx.userEmail,
        name: entitlements?.org_name ?? ctx.orgId,
        metadata: {
          orgId: ctx.orgId,
          userId: ctx.userId,
        },
      });

      customerId = customer.id;

      // Save customer ID
      await supabase
        .from('workspace_entitlements')
        .update({ stripe_customer_id: customerId })
        .eq('org_id', ctx.orgId);
    }

    // Build line items
    const lineItems = [
      { price: priceId, quantity: 1 },
    ];

    // Add Always On add-on if requested
    if (addAlwaysOn) {
      const alwaysOnPriceId = process.env.STRIPE_PRICE_ALWAYS_ON_MONTHLY;
      if (!alwaysOnPriceId) {
        return NextResponse.json(
          { error: 'Always On add-on not configured' },
          { status: 500 }
        );
      }
      lineItems.push({ price: alwaysOnPriceId, quantity: 1 });
    }

    // Create checkout session
    const stripeClient = getStripeClient();
    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: lineItems,
      success_url:
        successUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?upgraded=true`,
      cancel_url: cancelUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
      subscription_data: {
        trial_end: undefined, // Trial already tracked in our DB
        metadata: {
          orgId: ctx.orgId,
          userId: ctx.userId,
        },
      },
      client_reference_id: ctx.userId,
      metadata: {
        orgId: ctx.orgId,
      },
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error('[POST /api/billing/checkout] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
