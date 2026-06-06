import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/admin-client';

/**
 * GET /api/billing/prices
 *
 * Returns active Stripe prices organized by tier and billing period.
 * No authentication required - public pricing information.
 *
 * Returns:
 * {
 *   starter: {
 *     monthly: { stripe_price_id, amount_cents },
 *     annual:  { stripe_price_id, amount_cents }
 *   },
 *   growth: { ... },
 *   scale:  { ... }
 * }
 */
export async function GET() {
  try {
    // Query all active prices from stripe_prices table
    const { data: prices, error } = await supabaseAdmin
      .from('stripe_prices')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('[GET /api/billing/prices] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch prices' },
        { status: 500 }
      );
    }

    // Organize prices by tier and billing period
    const organized: Record<string, Record<string, { stripe_price_id: string; amount_cents: number }>> = {
      starter: {},
      growth: {},
      scale: {},
    };

    for (const price of prices || []) {
      const tier = price.tier;
      const period = price.billing_period;

      if (tier && period && (tier === 'starter' || tier === 'growth' || tier === 'scale')) {
        organized[tier][period] = {
          stripe_price_id: price.stripe_price_id,
          amount_cents: price.amount_cents,
        };
      }
    }

    return NextResponse.json(organized);
  } catch (error) {
    console.error('[GET /api/billing/prices] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}
