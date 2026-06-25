/**
 * List existing LIVE Stripe prices
 *
 * This script fetches all prices from your LIVE Stripe account
 * to see if products already exist. If they do, we can just
 * update the database without creating new ones.
 *
 * Run: STRIPE_SECRET_KEY=sk_live_xxx npx tsx scripts/list-stripe-live-prices.ts
 */

import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY not provided');
  console.error('Usage: STRIPE_SECRET_KEY=sk_live_xxx npx tsx scripts/list-stripe-live-prices.ts');
  process.exit(1);
}

if (!STRIPE_SECRET_KEY.startsWith('sk_live_')) {
  console.error('❌ Must use a LIVE key (starts with sk_live_)');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2026-04-22.dahlia',
});

async function listLivePrices() {
  console.log('🔍 Fetching LIVE Stripe prices...\n');

  try {
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product'],
      limit: 100,
    });

    if (prices.data.length === 0) {
      console.log('No active prices found in LIVE mode.');
      console.log('You need to create products and prices in Stripe dashboard or run seed-stripe-live-prices.ts');
      process.exit(0);
    }

    console.log('Active LIVE prices:\n');
    console.log('═'.repeat(100));

    for (const price of prices.data) {
      const product = price.product as Stripe.Product;
      const amount = price.unit_amount ? `$${(price.unit_amount / 100).toFixed(2)}` : 'N/A';
      const interval = price.recurring?.interval || 'one-time';

      console.log(`\nProduct: ${product.name}`);
      console.log(`  Price ID: ${price.id}`);
      console.log(`  Amount: ${amount}/${interval}`);
      console.log(`  Tier (metadata): ${price.metadata.tier || 'not set'}`);
      console.log(`  Billing Period (metadata): ${price.metadata.billing_period || 'not set'}`);
    }

    console.log('\n' + '═'.repeat(100));
    console.log(`\nTotal: ${prices.data.length} active prices`);

    // Check if we have Refyne products
    const refynePrices = prices.data.filter((p) => {
      const product = p.product as Stripe.Product;
      return product.name.toLowerCase().includes('refyne');
    });

    if (refynePrices.length > 0) {
      console.log('\n✅ Found Refyne products! You can update the database with these price IDs.');
      console.log('\nTo update database, create a script or run SQL manually:');
      console.log('\nUPDATE stripe_prices SET stripe_price_id = \'PRICE_ID\' WHERE tier = \'TIER\' AND billing_period = \'PERIOD\';');
    }
  } catch (error) {
    console.error('❌ Error fetching prices:', error);
    process.exit(1);
  }
}

listLivePrices();
