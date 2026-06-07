/**
 * Update stripe_prices table to use test price IDs
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function updatePrices() {
  const { supabaseAdmin } = await import('../lib/db/admin-client');

  const testPrices = [
    { tier: 'starter', billing_period: 'monthly', stripe_price_id: 'price_1TfWguD7K17UO95ddE4l6c3v', amount_cents: 14900 },
    { tier: 'starter', billing_period: 'annual', stripe_price_id: 'price_1TfWgvD7K17UO95dYrUkv5hB', amount_cents: 142800 },
    { tier: 'growth', billing_period: 'monthly', stripe_price_id: 'price_1TfWgvD7K17UO95d6lXJvXL6', amount_cents: 24900 },
    { tier: 'growth', billing_period: 'annual', stripe_price_id: 'price_1TfWgwD7K17UO95dJS24xKci', amount_cents: 238800 },
    { tier: 'scale', billing_period: 'monthly', stripe_price_id: 'price_1TfWgwD7K17UO95d4UxFhVzn', amount_cents: 39900 },
    { tier: 'scale', billing_period: 'annual', stripe_price_id: 'price_1TfWgxD7K17UO95dbcb0UzJL', amount_cents: 382800 },
  ];

  console.log('🔄 Updating stripe_prices table with TEST price IDs...\n');

  for (const price of testPrices) {
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

  console.log('\n✅ All prices updated to TEST mode!');
  console.log('\n🔍 Verifying...\n');

  const { data } = await supabaseAdmin
    .from('stripe_prices')
    .select('tier, billing_period, stripe_price_id')
    .order('tier', { ascending: true });

  data?.forEach((p) => {
    console.log(`   ${p.tier.padEnd(10)} ${p.billing_period.padEnd(10)} ${p.stripe_price_id}`);
  });

  console.log('');
  process.exit(0);
}

updatePrices();
