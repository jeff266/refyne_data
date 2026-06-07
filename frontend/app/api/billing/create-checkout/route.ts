import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getStripeClient, isStripeTestMode } from '@/lib/billing/stripe-client';

interface CreateCheckoutRequest {
  tier: string;
  billing_period: string;
}

/**
 * POST /api/billing/create-checkout
 *
 * Creates a Stripe checkout session for the selected tier and billing period.
 * - Looks up price_id from stripe_prices table
 * - Creates Stripe customer if needed
 * - Returns checkout URL to redirect user
 * - Webhook handles subscription creation
 *
 * Auth: Requires authenticated user
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    // Initialize Stripe client inside handler to pick up current env vars
    const stripe = getStripeClient();
    const testMode = isStripeTestMode();
    console.log(`[Create Checkout] Stripe mode: ${testMode ? 'TEST' : 'LIVE'}`);

    const body: CreateCheckoutRequest = await request.json();

    if (!body.tier || !body.billing_period) {
      return NextResponse.json(
        { error: 'Missing tier or billing_period' },
        { status: 400 }
      );
    }

    // Look up price ID from tier and billing period
    const { data: priceData, error: priceError } = await supabaseAdmin
      .from('stripe_prices')
      .select('stripe_price_id, tier, billing_period, amount_cents')
      .eq('tier', body.tier)
      .eq('billing_period', body.billing_period)
      .eq('is_active', true)
      .single();

    if (priceError || !priceData) {
      console.error('[Create Checkout] Price lookup failed:', priceError);
      return NextResponse.json(
        { error: 'Invalid tier or billing period' },
        { status: 400 }
      );
    }

    // Get or create org_billing record
    let { data: orgBilling } = await supabaseAdmin
      .from('org_billing')
      .select('org_id, stripe_customer_id')
      .eq('org_id', ctx.orgId)
      .single();

    // Create org_billing record if it doesn't exist
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
        metadata: {
          org_id: ctx.orgId,
        },
        email: ctx.userEmail,
      });

      customerId = customer.id;

      // Update org_billing with customer ID
      await supabaseAdmin
        .from('org_billing')
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', ctx.orgId);

      console.log(`[Create Checkout] Created Stripe customer ${customerId} for org ${ctx.orgId}`);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceData.stripe_price_id,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/upgrade`,
      metadata: {
        org_id: ctx.orgId,
        tier: priceData.tier,
        billing_period: priceData.billing_period,
      },
    });

    console.log(`[Create Checkout] Created checkout session ${session.id} for org ${ctx.orgId} (mode: ${testMode ? 'TEST' : 'LIVE'})`);

    // Log billing event
    await supabaseAdmin.from('org_billing_events').insert({
      org_id: ctx.orgId,
      event_type: 'checkout_session_created',
      actor_id: ctx.userId,
      metadata: {
        session_id: session.id,
        price_id: priceData.stripe_price_id,
        tier: priceData.tier,
        billing_period: priceData.billing_period,
      },
    });

    return NextResponse.json({
      checkout_url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/billing/create-checkout' });
    console.error('[Create Checkout] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create checkout session',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
