/**
 * Seed Stripe LIVE Products and Prices
 *
 * Creates LIVE mode products and prices matching test pricing:
 * - Refyne Starter: $149/mo, $1,428/yr
 * - Refyne Growth: $249/mo, $2,388/yr
 * - Refyne Scale: $399/mo, $3,828/yr
 *
 * ⚠️  WARNING: This creates REAL products in your LIVE Stripe account!
 * Only run this when you're ready to go live with billing.
 *
 * Run: npx tsx scripts/seed-stripe-live-prices.ts
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY not found in environment');
  console.error('Make sure .env.local contains STRIPE_SECRET_KEY');
  process.exit(1);
}

if (!STRIPE_SECRET_KEY.startsWith('sk_live_')) {
  console.error('❌ STRIPE_SECRET_KEY must start with sk_live_');
  console.error('This script only works with LIVE keys');
  console.error('Current key starts with:', STRIPE_SECRET_KEY.substring(0, 8));
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
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

async function seedStripeLiveData() {
  console.log('🚀 Seeding Stripe LIVE Products and Prices');
  console.log('⚠️  WARNING: Creating REAL products in LIVE mode!');
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
  console.log('✅ All LIVE products and prices created successfully!');
  console.log('');
  console.log('📋 Next step: Update stripe_prices table with these LIVE price IDs');
  console.log('');
  console.log('Run this script to update the database:');
  console.log('  npx tsx scripts/update-to-live-prices.ts');
  console.log('');
  console.log('🔑 LIVE Price IDs:');
  console.log('');
  for (const tier of ['starter', 'growth', 'scale'] as const) {
    console.log(`${tier.toUpperCase()}:`);
    console.log(`  Monthly: ${priceIds[tier].monthly}`);
    console.log(`  Annual:  ${priceIds[tier].annual}`);
    console.log('');
  }

  // Save to temp file for next script
  const fs = require('fs');
  fs.writeFileSync(
    path.resolve(__dirname, '../.live-price-ids.json'),
    JSON.stringify(priceIds, null, 2)
  );
  console.log('💾 Price IDs saved to .live-price-ids.json');
}

// Run the script
seedStripeLiveData()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error seeding Stripe live data:', error);
    process.exit(1);
  });
