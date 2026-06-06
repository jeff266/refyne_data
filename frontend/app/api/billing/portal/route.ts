import { NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import Stripe from 'stripe';

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
 * POST /api/billing/portal
 *
 * Create Stripe customer portal session for subscription management.
 * Returns { url } to redirect the user.
 *
 * Auth: any org member
 */
export async function POST() {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { data: orgBilling } = await supabaseAdmin
      .from('org_billing')
      .select('stripe_customer_id')
      .eq('org_id', ctx.orgId)
      .single();

    if (!orgBilling?.stripe_customer_id) {
      return NextResponse.json({ error: 'no_subscription' }, { status: 400 });
    }

    const stripeClient = getStripeClient();
    const session = await stripeClient.billingPortal.sessions.create({
      customer: orgBilling.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.refynedata.com'}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[POST /api/billing/portal] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
