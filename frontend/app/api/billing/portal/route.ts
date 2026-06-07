import { NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { getStripeClient } from '@/lib/billing/stripe-client';
import { requireAdmin } from '@/lib/auth/roles';

/**
 * POST /api/billing/portal
 *
 * Create Stripe customer portal session for subscription management.
 * Returns URL to redirect user to Stripe's hosted portal.
 *
 * Auth: Requires authenticated user
 */
export async function POST() {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  requireAdmin(ctx.orgRole);

  try {
    // Query org_billing for stripe_customer_id
    const { data: billing, error } = await supabaseAdmin
      .from('org_billing')
      .select('stripe_customer_id')
      .eq('org_id', ctx.orgId)
      .single();

    if (error || !billing?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'no_subscription' },
        { status: 400 }
      );
    }

    // Create Stripe customer portal session
    const stripeClient = getStripeClient();
    const session = await stripeClient.billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing`,
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
