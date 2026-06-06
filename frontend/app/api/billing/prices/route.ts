import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/admin-client';

/**
 * GET /api/billing/prices
 *
 * Returns active Stripe prices grouped by tier and billing period.
 * No auth required - prices are public information.
 */
export async function GET() {
  try {
    const { data: prices, error } = await supabaseAdmin
      .from('stripe_prices')
      .select('tier, billing_period, stripe_price_id, amount_cents')
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    const result: Record<string, Record<string, { stripe_price_id: string; amount_cents: number }>> = {};

    for (const price of prices ?? []) {
      if (!result[price.tier]) result[price.tier] = {};
      result[price.tier][price.billing_period] = {
        stripe_price_id: price.stripe_price_id,
        amount_cents: price.amount_cents,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Billing Prices] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}
