/**
 * Seed Stripe Test Products and Prices
 *
 * Creates test mode products and prices matching live pricing:
 * - Refyne Starter: $149/mo, $1,428/yr
 * - Refyne Growth: $249/mo, $2,388/yr
 * - Refyne Scale: $399/mo, $3,828/yr
 *
 * Run: npx tsx scripts/seed-stripe-test-prices.ts
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const STRIPE_TEST_SECRET_KEY = process.env.STRIPE_TEST_SECRET_KEY;

if (!STRIPE_TEST_SECRET_KEY) {
  console.error('❌ STRIPE_TEST_SECRET_KEY not found in environment');
  console.error('Make sure .env.local contains STRIPE_TEST_SECRET_KEY');
  process.exit(1);
}

if (!STRIPE_TEST_SECRET_KEY.startsWith('sk_test_')) {
  console.error('❌ STRIPE_TEST_SECRET_KEY must start with sk_test_');
  console.error('This script only works with test keys');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_TEST_SECRET_KEY, {
  apiVersion: '2026-04-22.dahlia',
});

interface ProductConfig {
  name: string;
  tier: 'starter' | 'growth' | 'scale';
  description: string;
  monthlyAmount: number; // in cents
  annualAmount: number; // in cents
}

const PRODUCTS: ProductConfig[] = [
  {
    name: 'Refyne Starter',
    tier: 'starter',
    description: 'Perfect for small teams getting started with data enrichment',
    monthlyAmount: 14900, // $149
    annualAmount: 142800, // $1,428 ($119/mo)
  },
  {
    name: 'Refyne Growth',
    tier: 'growth',
    description: 'For growing teams that need more power',
    monthlyAmount: 24900, // $249
    annualAmount: 238800, // $2,388 ($199/mo)
  },
  {
    name: 'Refyne Scale',
    tier: 'scale',
    description: 'For large teams with enterprise needs',
    monthlyAmount: 39900, // $399
    annualAmount: 382800, // $3,828 ($319/mo)
  },
];

async function seedStripeTestData() {
  console.log('🚀 Seeding Stripe Test Products and Prices');
  console.log('═'.repeat(60));
  console.log('');

  const priceIds: Record<string, { monthly: string; annual: string }> = {};

  for (const config of PRODUCTS) {
    console.log(`📦 Creating product: ${config.name}`);

    // Create product
    const product = await stripe.products.create({
      name: config.name,
      description: config.description,
      metadata: {
        tier: config.tier,
      },
    });

    console.log(`   ✓ Product created: ${product.id}`);

    // Create monthly price
    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      unit_amount: config.monthlyAmount,
      recurring: {
        interval: 'month',
      },
      metadata: {
        tier: config.tier,
        billing_period: 'monthly',
      },
    });

    console.log(`   ✓ Monthly price created: ${monthlyPrice.id} ($${config.monthlyAmount / 100}/mo)`);

    // Create annual price
    const annualPrice = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      unit_amount: config.annualAmount,
      recurring: {
        interval: 'year',
      },
      metadata: {
        tier: config.tier,
        billing_period: 'annual',
      },
    });

    console.log(`   ✓ Annual price created: ${annualPrice.id} ($${config.annualAmount / 100}/yr)`);
    console.log('');

    priceIds[config.tier] = {
      monthly: monthlyPrice.id,
      annual: annualPrice.id,
    };
  }

  console.log('═'.repeat(60));
  console.log('✅ All products and prices created successfully!');
  console.log('');
  console.log('📋 Price IDs for stripe_prices table:');
  console.log('');

  // Output formatted for easy copy-paste to database
  console.log('INSERT INTO stripe_prices (tier, billing_period, stripe_price_id, amount_cents, currency, active)');
  console.log('VALUES');

  const inserts: string[] = [];
  for (const tier of ['starter', 'growth', 'scale'] as const) {
    const config = PRODUCTS.find(p => p.tier === tier)!;
    inserts.push(
      `  ('${tier}', 'monthly', '${priceIds[tier].monthly}', ${config.monthlyAmount}, 'usd', TRUE)`,
      `  ('${tier}', 'annual', '${priceIds[tier].annual}', ${config.annualAmount}, 'usd', TRUE)`
    );
  }
  console.log(inserts.join(',\n') + ';');
  console.log('');

  console.log('🔑 Price IDs by tier:');
  console.log('');
  for (const tier of ['starter', 'growth', 'scale'] as const) {
    console.log(`${tier.toUpperCase()}:`);
    console.log(`  Monthly: ${priceIds[tier].monthly}`);
    console.log(`  Annual:  ${priceIds[tier].annual}`);
    console.log('');
  }
}

// Run the script
seedStripeTestData()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error seeding Stripe test data:', error);
    process.exit(1);
  });
