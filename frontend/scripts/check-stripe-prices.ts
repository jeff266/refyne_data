/**
 * Check stripe_prices table to verify test vs live price IDs
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function checkPrices() {
  // Dynamic import to load after env vars
  const { supabaseAdmin } = await import('../lib/db/admin-client');

  const { data, error } = await supabaseAdmin
    .from('stripe_prices')
    .select('tier, billing_period, stripe_price_id, amount_cents, is_active')
    .order('tier', { ascending: true });

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('\nstripe_prices table:');
  console.log('═'.repeat(100));

  if (!data || data.length === 0) {
    console.log('⚠️  No prices found in database!');
    console.log('\nYou need to:');
    console.log('1. Run: npx tsx scripts/seed-stripe-test-prices.ts');
    console.log('2. Insert the generated SQL into stripe_prices table');
  } else {
    data.forEach((price) => {
      const isTest = price.stripe_price_id.startsWith('price_') === false; // Test prices don't start with price_
      const mode = price.stripe_price_id.includes('test') || !price.stripe_price_id.startsWith('price_') ? 'TEST' : 'LIVE';
      console.log(`${price.tier.padEnd(10)} ${price.billing_period.padEnd(10)} ${price.stripe_price_id.padEnd(30)} $${(price.amount_cents / 100).toFixed(2).padStart(8)} [${mode}]`);
    });
  }

  console.log('═'.repeat(100));
}

checkPrices();
