import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { captureException } from '@/lib/monitoring/sentry';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events:
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_failed
 * - invoice.payment_succeeded
 *
 * Updates org_billing table based on subscription changes.
 */
export async function POST(req: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await req.text();
    const headersList = headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('[Stripe Webhook] No signature header');
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

    // Check idempotency - have we processed this event before?
    const { data: existing } = await supabaseAdmin
      .from('stripe_webhook_events')
      .select('id')
      .eq('id', event.id)
      .single();

    if (existing) {
      console.log(`[Stripe Webhook] Event ${event.id} already processed (idempotent)`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Process event based on type
    let orgId: string | null = null;

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        orgId = await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        orgId = await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        orgId = await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_succeeded':
        orgId = await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    // Record event in idempotency table
    await supabaseAdmin.from('stripe_webhook_events').insert({
      id: event.id,
      event_type: event.type,
      processed_at: new Date().toISOString(),
      org_id: orgId,
      metadata: event.data.object as any,
    });

    console.log(`[Stripe Webhook] Event ${event.id} processed successfully`);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Processing error:', error);
    captureException(error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle subscription.created and subscription.updated
 * Maps Stripe price ID to tier and updates org_billing
 */
async function handleSubscriptionChange(subscription: Stripe.Subscription): Promise<string | null> {
  const customerId = subscription.customer as string;

  // Look up org by stripe_customer_id
  const { data: orgBilling } = await supabaseAdmin
    .from('org_billing')
    .select('org_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!orgBilling) {
    console.error(`[Stripe Webhook] No org found for customer ${customerId}`);
    return null;
  }

  const orgId = orgBilling.org_id;

  // Get price ID from subscription (first item)
  const priceId = subscription.items.data[0]?.price.id;

  if (!priceId) {
    console.error(`[Stripe Webhook] No price ID on subscription ${subscription.id}`);
    return orgId;
  }

  // Look up tier from stripe_prices table
  const { data: priceData } = await supabaseAdmin
    .from('stripe_prices')
    .select('tier, billing_period')
    .eq('stripe_price_id', priceId)
    .single();

  if (!priceData) {
    console.error(`[Stripe Webhook] Unknown price ID: ${priceId}`);
    return orgId;
  }

  const tier = priceData.tier;
  const status = subscription.status === 'active' ? 'active' : 'past_due';

  // Update org_billing
  const { error } = await supabaseAdmin
    .from('org_billing')
    .update({
      subscription_tier: tier,
      subscription_status: status,
      stripe_subscription_id: subscription.id,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId);

  if (error) {
    console.error('[Stripe Webhook] Failed to update org_billing:', error);
  } else {
    console.log(`[Stripe Webhook] Updated org ${orgId} to tier ${tier}, status ${status}`);
  }

  // Log billing event
  await supabaseAdmin.from('org_billing_events').insert({
    org_id: orgId,
    event_type: subscription.status === 'active' ? 'subscription_activated' : 'subscription_updated',
    actor_id: null, // System event
    metadata: {
      stripe_subscription_id: subscription.id,
      tier,
      status,
      period_start: subscription.current_period_start,
      period_end: subscription.current_period_end,
    },
  });

  return orgId;
}

/**
 * Handle subscription.deleted
 * Revert to trial tier with cancelled status
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<string | null> {
  const customerId = subscription.customer as string;

  // Look up org by stripe_customer_id
  const { data: orgBilling } = await supabaseAdmin
    .from('org_billing')
    .select('org_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!orgBilling) {
    console.error(`[Stripe Webhook] No org found for customer ${customerId}`);
    return null;
  }

  const orgId = orgBilling.org_id;

  // Revert to trial, set status to cancelled
  const { error } = await supabaseAdmin
    .from('org_billing')
    .update({
      subscription_tier: 'trial',
      subscription_status: 'cancelled',
      stripe_subscription_id: null,
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId);

  if (error) {
    console.error('[Stripe Webhook] Failed to update org_billing:', error);
  } else {
    console.log(`[Stripe Webhook] Cancelled subscription for org ${orgId}`);
  }

  // Log billing event
  await supabaseAdmin.from('org_billing_events').insert({
    org_id: orgId,
    event_type: 'subscription_cancelled',
    actor_id: null, // System event
    metadata: {
      stripe_subscription_id: subscription.id,
      cancelled_at: subscription.canceled_at,
    },
  });

  return orgId;
}

/**
 * Handle invoice.payment_failed
 * Set status to past_due (still allow usage with grace period)
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<string | null> {
  const customerId = invoice.customer as string;

  // Look up org by stripe_customer_id
  const { data: orgBilling } = await supabaseAdmin
    .from('org_billing')
    .select('org_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!orgBilling) {
    console.error(`[Stripe Webhook] No org found for customer ${customerId}`);
    return null;
  }

  const orgId = orgBilling.org_id;

  // Set status to past_due
  const { error } = await supabaseAdmin
    .from('org_billing')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId);

  if (error) {
    console.error('[Stripe Webhook] Failed to update org_billing:', error);
  } else {
    console.log(`[Stripe Webhook] Payment failed for org ${orgId}, status now past_due`);
  }

  // Log billing event
  await supabaseAdmin.from('org_billing_events').insert({
    org_id: orgId,
    event_type: 'payment_failed',
    actor_id: null, // System event
    metadata: {
      invoice_id: invoice.id,
      amount_due: invoice.amount_due,
      attempt_count: invoice.attempt_count,
    },
  });

  return orgId;
}

/**
 * Handle invoice.payment_succeeded
 * Clear past_due status, set to active
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<string | null> {
  const customerId = invoice.customer as string;

  // Look up org by stripe_customer_id
  const { data: orgBilling } = await supabaseAdmin
    .from('org_billing')
    .select('org_id, subscription_status')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!orgBilling) {
    console.error(`[Stripe Webhook] No org found for customer ${customerId}`);
    return null;
  }

  const orgId = orgBilling.org_id;

  // Only update if currently past_due (to avoid overwriting other statuses)
  if (orgBilling.subscription_status === 'past_due') {
    const { error } = await supabaseAdmin
      .from('org_billing')
      .update({
        subscription_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId);

    if (error) {
      console.error('[Stripe Webhook] Failed to update org_billing:', error);
    } else {
      console.log(`[Stripe Webhook] Payment succeeded for org ${orgId}, status now active`);
    }
  }

  // Log billing event
  await supabaseAdmin.from('org_billing_events').insert({
    org_id: orgId,
    event_type: 'payment_succeeded',
    actor_id: null, // System event
    metadata: {
      invoice_id: invoice.id,
      amount_paid: invoice.amount_paid,
    },
  });

  return orgId;
}
