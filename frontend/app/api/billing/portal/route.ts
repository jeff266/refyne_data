import { NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
});

/**
 * POST /api/billing/portal
 *
 * Create Stripe customer portal session for subscription management.
 *
 * Auth: org:admin
 */
export async function POST() {
  let ctx;
  try {
    ctx = requireAdmin();
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
    const { data: entitlements } = await supabase
      .from('workspace_entitlements')
      .select('stripe_customer_id')
      .eq('org_id', ctx.orgId)
      .single();

    if (!entitlements?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer found. Please subscribe first.' },
        { status: 400 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: entitlements.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    });

    return NextResponse.json({ portalUrl: session.url });
  } catch (error) {
    console.error('[POST /api/billing/portal] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
