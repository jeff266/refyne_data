/**
 * Verify Stripe test mode is working correctly
 *
 * Checks:
 * 1. Environment variables are set correctly
 * 2. Database has test price IDs
 * 3. Stripe client would use test key
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function verify() {
  console.log('🔍 Verifying Stripe Test Mode Configuration');
  console.log('═'.repeat(80));
  console.log('');

  // 1. Check environment variables
  console.log('1. Environment Variables:');
  const testMode = process.env.STRIPE_TEST_MODE;
  const testKey = process.env.STRIPE_TEST_SECRET_KEY;
  const liveKey = process.env.STRIPE_SECRET_KEY;

  console.log(`   STRIPE_TEST_MODE: ${testMode}`);
  console.log(`   STRIPE_TEST_SECRET_KEY: ${testKey ? testKey.substring(0, 20) + '...' : 'NOT SET'}`);
  console.log(`   STRIPE_SECRET_KEY: ${liveKey ? liveKey.substring(0, 20) + '...' : 'NOT SET'}`);

  if (testMode !== 'true') {
    console.error('\n   ❌ STRIPE_TEST_MODE is not set to "true"');
    process.exit(1);
  }

  if (!testKey || !testKey.startsWith('sk_test_')) {
    console.error('\n   ❌ STRIPE_TEST_SECRET_KEY is missing or invalid');
    process.exit(1);
  }

  console.log('   ✅ Test mode enabled with valid test key');
  console.log('');

  // 2. Check which key would be used
  console.log('2. Stripe Client Configuration:');
  const { getStripeClient, isStripeTestMode } = await import('../lib/billing/stripe-client');

  const clientTestMode = isStripeTestMode();
  console.log(`   isStripeTestMode(): ${clientTestMode}`);

  if (!clientTestMode) {
    console.error('   ❌ Stripe client would use LIVE mode');
    process.exit(1);
  }

  console.log('   ✅ Stripe client configured for TEST mode');
  console.log('');

  // 3. Check database prices
  console.log('3. Database Price IDs:');
  const { supabaseAdmin } = await import('../lib/db/admin-client');

  const { data: prices } = await supabaseAdmin
    .from('stripe_prices')
    .select('tier, billing_period, stripe_price_id')
    .eq('is_active', true)
    .order('tier', { ascending: true });

  // Known test price IDs (created by seed script)
  const testPriceIds = [
    'price_1TfWguD7K17UO95ddE4l6c3v', // starter monthly
    'price_1TfWgvD7K17UO95dYrUkv5hB', // starter annual
    'price_1TfWgvD7K17UO95d6lXJvXL6', // growth monthly
    'price_1TfWgwD7K17UO95dJS24xKci', // growth annual
    'price_1TfWgwD7K17UO95d4UxFhVzn', // scale monthly
    'price_1TfWgxD7K17UO95dbcb0UzJL', // scale annual
  ];

  let hasLivePrices = false;

  prices?.forEach((price) => {
    const isTest = testPriceIds.includes(price.stripe_price_id);
    const mode = isTest ? '✅ TEST' : '❌ LIVE';
    console.log(`   ${price.tier.padEnd(10)} ${price.billing_period.padEnd(10)} ${price.stripe_price_id.padEnd(35)} ${mode}`);

    if (!isTest) hasLivePrices = true;
  });

  console.log('');

  if (hasLivePrices) {
    console.error('❌ FAILED: Database contains LIVE price IDs');
    console.error('');
    console.error('Fix: Run npx tsx scripts/update-to-test-prices.ts');
    process.exit(1);
  }

  console.log('═'.repeat(80));
  console.log('✅ ALL CHECKS PASSED - System is in TEST MODE');
  console.log('');
  console.log('You can now safely test checkout without charging real cards.');
  console.log('Test card: 4242 4242 4242 4242, exp: 12/29, cvc: 123');
  console.log('═'.repeat(80));

  process.exit(0);
}

verify();
