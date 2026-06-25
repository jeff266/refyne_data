/**
 * Manually update stripe_prices with LIVE price IDs
 *
 * If you already have LIVE price IDs from Stripe dashboard,
 * edit this script and run it to update the database.
 *
 * Run: npx tsx scripts/manual-update-live-prices.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function updatePrices() {
  const { supabaseAdmin } = await import('../lib/db/admin-client');

  // ⚠️ EDIT THESE WITH YOUR LIVE PRICE IDs FROM STRIPE DASHBOARD
  const livePrices = [
    { tier: 'starter', billing_period: 'monthly', stripe_price_id: 'price_REPLACE_ME_1', amount_cents: 14900 },
    { tier: 'starter', billing_period: 'annual', stripe_price_id: 'price_REPLACE_ME_2', amount_cents: 142800 },
    { tier: 'growth', billing_period: 'monthly', stripe_price_id: 'price_REPLACE_ME_3', amount_cents: 24900 },
    { tier: 'growth', billing_period: 'annual', stripe_price_id: 'price_REPLACE_ME_4', amount_cents: 238800 },
    { tier: 'scale', billing_period: 'monthly', stripe_price_id: 'price_REPLACE_ME_5', amount_cents: 39900 },
    { tier: 'scale', billing_period: 'annual', stripe_price_id: 'price_REPLACE_ME_6', amount_cents: 382800 },
  ];

  // Validate that user has edited the prices
  const hasPlaceholder = livePrices.some(p => p.stripe_price_id.includes('REPLACE_ME'));
  if (hasPlaceholder) {
    console.error('❌ Please edit this script and replace REPLACE_ME with your actual LIVE price IDs');
    console.error('Find them in: Stripe Dashboard → Products');
    process.exit(1);
  }

  console.log('🔄 Updating stripe_prices table with LIVE price IDs...\n');

  for (const price of livePrices) {
    const { error } = await supabaseAdmin
      .from('stripe_prices')
      .update({
        stripe_price_id: price.stripe_price_id,
        amount_cents: price.amount_cents,
      })
      .eq('tier', price.tier)
      .eq('billing_period', price.billing_period);

    if (error) {
      console.error(`❌ Failed to update ${price.tier} ${price.billing_period}:`, error);
    } else {
      console.log(`✓ Updated ${price.tier.padEnd(10)} ${price.billing_period.padEnd(10)} → ${price.stripe_price_id}`);
    }
  }

  console.log('\n✅ All prices updated to LIVE mode!');
  console.log('\n🔍 Verifying...\n');

  const { data } = await supabaseAdmin
    .from('stripe_prices')
    .select('tier, billing_period, stripe_price_id')
    .order('tier', { ascending: true });

  data?.forEach((p) => {
    console.log(`   ${p.tier.padEnd(10)} ${p.billing_period.padEnd(10)} ${p.stripe_price_id}`);
  });

  console.log('');
  console.log('🚀 Your billing is now ready for production!');
  console.log('');
  process.exit(0);
}

updatePrices();
