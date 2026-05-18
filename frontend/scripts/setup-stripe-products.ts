import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY environment variable is required');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-04-22.dahlia',
});

async function setupStripeProducts() {
  console.log('Creating Stripe products and prices...\n');

  const products = [
    {
      name: 'Refyne Starter',
      envKey: 'starter',
      prices: [
        { amount: 14900, interval: 'month', envName: 'STRIPE_PRICE_STARTER_MONTHLY' },
        { amount: 142800, interval: 'year', envName: 'STRIPE_PRICE_STARTER_ANNUAL' },
      ],
    },
    {
      name: 'Refyne Growth',
      envKey: 'growth',
      prices: [
        { amount: 24900, interval: 'month', envName: 'STRIPE_PRICE_GROWTH_MONTHLY' },
        { amount: 238800, interval: 'year', envName: 'STRIPE_PRICE_GROWTH_ANNUAL' },
      ],
    },
    {
      name: 'Refyne Scale',
      envKey: 'scale',
      prices: [
        { amount: 39900, interval: 'month', envName: 'STRIPE_PRICE_SCALE_MONTHLY' },
        { amount: 382800, interval: 'year', envName: 'STRIPE_PRICE_SCALE_ANNUAL' },
      ],
    },
    {
      name: 'Refyne Prospect Solo',
      envKey: 'prospect_solo',
      prices: [
        { amount: 4900, interval: 'month', envName: 'STRIPE_PRICE_PROSPECT_SOLO_MONTHLY' },
      ],
    },
    {
      name: 'Refyne Prospect Team',
      envKey: 'prospect_team',
      prices: [
        { amount: 9900, interval: 'month', envName: 'STRIPE_PRICE_PROSPECT_TEAM_MONTHLY' },
      ],
    },
    {
      name: 'Refyne Always On Add-on',
      envKey: 'always_on',
      prices: [
        { amount: 7900, interval: 'month', envName: 'STRIPE_PRICE_ALWAYS_ON_MONTHLY' },
      ],
    },
  ];

  const output: Record<string, string> = {};

  for (const product of products) {
    const stripeProduct = await stripe.products.create({
      name: product.name,
      metadata: { refyne_plan: product.envKey },
    });
    console.log(`✅ Created product: ${product.name} (${stripeProduct.id})`);

    for (const price of product.prices) {
      const stripePrice = await stripe.prices.create({
        product: stripeProduct.id,
        unit_amount: price.amount,
        currency: 'usd',
        recurring: { interval: price.interval as 'month' | 'year' },
        metadata: { refyne_plan: product.envKey },
      });
      output[price.envName] = stripePrice.id;
      console.log(`   ${price.envName}=${stripePrice.id}`);
    }
  }

  // Create webhook endpoint
  console.log('\nCreating webhook endpoint...');
  const webhook = await stripe.webhookEndpoints.create({
    url: 'https://app.refynedata.com/api/webhooks/stripe',
    enabled_events: [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'checkout.session.completed',
    ],
    description: 'Refyne production webhook',
  });
  console.log(`✅ Created webhook endpoint`);

  console.log('\n── Copy these into Vercel env vars ──────────────\n');
  for (const [key, value] of Object.entries(output)) {
    console.log(`${key}=${value}`);
  }
  console.log(`\nSTRIPE_WEBHOOK_SECRET=${webhook.secret}`);
  console.log('\n─────────────────────────────────────────────────');
}

setupStripeProducts().catch(console.error);
