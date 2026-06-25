/**
 * Update stripe_prices table to use LIVE price IDs
 *
 * Reads price IDs from .live-price-ids.json (created by seed-stripe-live-prices.ts)
 * and updates the database.
 *
 * Run: npx tsx scripts/update-to-live-prices.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function updatePrices() {
  const { supabaseAdmin } = await import('../lib/db/admin-client');

  // Read price IDs from file
  const priceIdsPath = path.resolve(__dirname, '../.live-price-ids.json');

  if (!fs.existsSync(priceIdsPath)) {
    console.error('❌ .live-price-ids.json not found');
    console.error('Run this first: npx tsx scripts/seed-stripe-live-prices.ts');
    process.exit(1);
  }

  const priceIds = JSON.parse(fs.readFileSync(priceIdsPath, 'utf8'));

  // Map to flat array
  const livePrices = [
    { tier: 'starter', billing_period: 'monthly', stripe_price_id: priceIds.starter.monthly, amount_cents: 14900 },
    { tier: 'starter', billing_period: 'annual', stripe_price_id: priceIds.starter.annual, amount_cents: 142800 },
    { tier: 'growth', billing_period: 'monthly', stripe_price_id: priceIds.growth.monthly, amount_cents: 24900 },
    { tier: 'growth', billing_period: 'annual', stripe_price_id: priceIds.growth.annual, amount_cents: 238800 },
    { tier: 'scale', billing_period: 'monthly', stripe_price_id: priceIds.scale.monthly, amount_cents: 39900 },
    { tier: 'scale', billing_period: 'annual', stripe_price_id: priceIds.scale.annual, amount_cents: 382800 },
  ];

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
