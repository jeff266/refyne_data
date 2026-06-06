import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

interface CreateCheckoutRequest {
  // Primary format: tier + billing_period
  tier?: string;
  billing_period?: string;
  // Legacy format: direct price ID
  priceId?: string;
}

/**
 * POST /api/billing/create-checkout
 *
 * Creates a Stripe checkout session for the selected plan.
 * Accepts { tier, billing_period } (preferred) or { priceId } (legacy).
 *
 * Auth: any org member
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body: CreateCheckoutRequest = await request.json();
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.refynedata.com';

    // Resolve the Stripe price ID
    let resolvedPriceId: string;
    let resolvedTier: string;
    let resolvedPeriod: string;

    if (body.tier && body.billing_period) {
      // Look up price from stripe_prices table
      const { data: priceData } = await supabaseAdmin
        .from('stripe_prices')
        .select('stripe_price_id, tier, billing_period, amount_cents')
        .eq('tier', body.tier)
        .eq('billing_period', body.billing_period)
        .eq('is_active', true)
        .single();

      if (!priceData) {
        return NextResponse.json(
          { error: 'Price not found for this tier and billing period' },
          { status: 400 }
        );
      }

      resolvedPriceId = priceData.stripe_price_id;
      resolvedTier = priceData.tier;
      resolvedPeriod = priceData.billing_period;
    } else if (body.priceId) {
      // Legacy: validate direct price ID
      const { data: priceData } = await supabaseAdmin
        .from('stripe_prices')
        .select('stripe_price_id, tier, billing_period')
        .eq('stripe_price_id', body.priceId)
        .eq('is_active', true)
        .single();

      if (!priceData) {
        return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 });
      }

      resolvedPriceId = priceData.stripe_price_id;
      resolvedTier = priceData.tier;
      resolvedPeriod = priceData.billing_period;
    } else {
      return NextResponse.json(
        { error: 'Provide either { tier, billing_period } or { priceId }' },
        { status: 400 }
      );
    }

    // Get or create org_billing record
    let { data: orgBilling } = await supabaseAdmin
      .from('org_billing')
      .select('org_id, stripe_customer_id')
      .eq('org_id', ctx.orgId)
      .single();

    if (!orgBilling) {
      const { data: newOrgBilling, error: insertError } = await supabaseAdmin
        .from('org_billing')
        .insert({
          org_id: ctx.orgId,
          subscription_tier: 'trial',
          subscription_status: 'active',
        })
        .select('org_id, stripe_customer_id')
        .single();

      if (insertError || !newOrgBilling) {
        console.error('[Create Checkout] Failed to create org_billing:', insertError);
        return NextResponse.json(
          { error: 'Failed to initialize billing' },
          { status: 500 }
        );
      }

      orgBilling = newOrgBilling;
    }

    // Create Stripe customer if needed
    let customerId = orgBilling.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { org_id: ctx.orgId },
        email: ctx.userEmail,
      });

      customerId = customer.id;

      await supabaseAdmin
        .from('org_billing')
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq('org_id', ctx.orgId);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      success_url: `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/billing/upgrade`,
      metadata: {
        org_id: ctx.orgId,
        tier: resolvedTier,
        billing_period: resolvedPeriod,
      },
    });

    // Log billing event
    await supabaseAdmin.from('org_billing_events').insert({
      org_id: ctx.orgId,
      event_type: 'checkout_session_created',
      actor_id: ctx.userId,
      metadata: {
        session_id: session.id,
        price_id: resolvedPriceId,
        tier: resolvedTier,
        billing_period: resolvedPeriod,
      },
    });

    return NextResponse.json({
      checkout_url: session.url,
      // legacy field alias
      checkoutUrl: session.url,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/billing/create-checkout' });
    console.error('[Create Checkout] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
