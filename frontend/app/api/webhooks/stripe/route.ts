import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { resetEnrichCredits } from '@/lib/billing/check-feature';
import { PLAN_FEATURES, Plan } from '@/lib/billing/plan-features';
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

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/stripe
 *
 * Handle Stripe webhook events for subscription lifecycle.
 *
 * Auth: Stripe signature validation
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[Stripe webhook] STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    const stripeClient = getStripeClient();
    event = stripeClient.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error('[Stripe webhook] Signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`[Stripe webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[Stripe webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe webhook] Error processing event:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orgId = session.metadata?.orgId;
  if (!orgId) {
    console.error('[Stripe webhook] No orgId in session metadata');
    return;
  }

  // Derive plan from price ID
  const plan = derivePlanFromSession(session);
  const alwaysOnAddon = hasAlwaysOnItem(session);

  await supabase!
    .from('workspace_entitlements')
    .update({
      stripe_subscription_id: session.subscription as string,
      subscription_status: 'active',
      plan,
      always_on_addon: alwaysOnAddon,
      billing_owner_user_id: session.client_reference_id,
      billing_period_start: new Date().toISOString(),
      enrich_credits_limit: PLAN_FEATURES[plan].enrich_credits,
    })
    .eq('org_id', orgId);

  console.log(`[Stripe webhook] Checkout completed for org ${orgId}, plan: ${plan}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const orgId = subscription.metadata?.orgId;
  if (!orgId) {
    console.error('[Stripe webhook] No orgId in subscription metadata');
    return;
  }

  const plan = derivePlanFromSubscription(subscription);
  const alwaysOnAddon = hasAlwaysOnInSubscription(subscription);

  await supabase!
    .from('workspace_entitlements')
    .update({
      subscription_status: subscription.status === 'active' ? 'active' : subscription.status,
      plan,
      always_on_addon: alwaysOnAddon,
      enrich_credits_limit: PLAN_FEATURES[plan].enrich_credits,
    })
    .eq('stripe_subscription_id', subscription.id);

  console.log(`[Stripe webhook] Subscription updated for org ${orgId}, plan: ${plan}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await supabase!
    .from('workspace_entitlements')
    .update({
      subscription_status: 'cancelled',
      plan: 'trial_expired',
    })
    .eq('stripe_subscription_id', subscription.id);

  console.log(`[Stripe webhook] Subscription deleted: ${subscription.id}`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const { data } = await supabase!
    .from('workspace_entitlements')
    .select('org_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!data) {
    console.error('[Stripe webhook] No org found for customer:', customerId);
    return;
  }

  // Reset credits at start of new billing period
  await resetEnrichCredits(data.org_id);

  await supabase!
    .from('workspace_entitlements')
    .update({
      billing_period_start: new Date().toISOString(),
      subscription_status: 'active',
    })
    .eq('org_id', data.org_id);

  console.log(`[Stripe webhook] Payment succeeded, credits reset for org ${data.org_id}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  await supabase!
    .from('workspace_entitlements')
    .update({
      subscription_status: 'past_due',
    })
    .eq('stripe_customer_id', customerId);

  // TODO: Send email notification to billing owner
  console.log(`[Stripe webhook] Payment failed for customer: ${customerId}`);
}

/**
 * Derive plan from checkout session line items.
 */
function derivePlanFromSession(session: Stripe.Checkout.Session): Plan {
  // In a real implementation, you'd fetch the session with expanded line_items
  // and check the price IDs against your env vars
  // For now, return a placeholder
  return 'starter';
}

/**
 * Derive plan from subscription items.
 */
function derivePlanFromSubscription(subscription: Stripe.Subscription): Plan {
  const items = subscription.items.data;

  // Check each item's price ID against env vars
  for (const item of items) {
    const priceId = item.price.id;

    if (priceId === process.env.STRIPE_PRICE_STARTER_MONTHLY ||
        priceId === process.env.STRIPE_PRICE_STARTER_ANNUAL) {
      return 'starter';
    }
    if (priceId === process.env.STRIPE_PRICE_GROWTH_MONTHLY ||
        priceId === process.env.STRIPE_PRICE_GROWTH_ANNUAL) {
      return 'growth';
    }
    if (priceId === process.env.STRIPE_PRICE_SCALE_MONTHLY ||
        priceId === process.env.STRIPE_PRICE_SCALE_ANNUAL) {
      return 'scale';
    }
    if (priceId === process.env.STRIPE_PRICE_PROSPECT_SOLO_MONTHLY) {
      return 'prospect_solo';
    }
    if (priceId === process.env.STRIPE_PRICE_PROSPECT_TEAM_MONTHLY) {
      return 'prospect_team';
    }
  }

  return 'starter'; // Default fallback
}

/**
 * Check if Always On add-on is in session line items.
 */
function hasAlwaysOnItem(session: Stripe.Checkout.Session): boolean {
  // In a real implementation, expand line_items and check for Always On price ID
  return false; // Placeholder
}

/**
 * Check if Always On add-on is in subscription items.
 */
function hasAlwaysOnInSubscription(subscription: Stripe.Subscription): boolean {
  const alwaysOnPriceId = process.env.STRIPE_PRICE_ALWAYS_ON_MONTHLY;
  if (!alwaysOnPriceId) return false;

  return subscription.items.data.some(item => item.price.id === alwaysOnPriceId);
}
