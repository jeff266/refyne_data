#!/usr/bin/env npx tsx
/**
 * Test Stripe Webhook Handler Locally
 *
 * Constructs a minimal customer.subscription.created event,
 * signs it properly using STRIPE_WEBHOOK_SECRET, and POSTs it
 * to the local webhook endpoint.
 *
 * Tests that:
 * - STRIPE_WEBHOOK_SECRET is loaded correctly
 * - Signature verification passes
 * - Handler returns 200
 * - No "invalid signature" or "missing secret" errors
 *
 * Usage:
 *   npx tsx scripts/test-webhook-local.ts
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!WEBHOOK_SECRET) {
  console.error('❌ STRIPE_WEBHOOK_SECRET not found in environment');
  console.error('Set it in .env.local');
  process.exit(1);
}

if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY not found in environment');
  console.error('Set it in .env.local');
  process.exit(1);
}

// Initialize Stripe client
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2026-04-22.dahlia',
});

async function testWebhook() {
  console.log('═'.repeat(60));
  console.log('Testing Stripe Webhook Handler Locally');
  console.log('═'.repeat(60));
  console.log('');

  // Construct minimal customer.subscription.created event
  const event: Stripe.Event = {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2026-04-22.dahlia',
    created: Math.floor(Date.now() / 1000),
    type: 'customer.subscription.created',
    data: {
      object: {
        id: 'sub_test_123',
        object: 'subscription',
        customer: 'cus_test_123',
        status: 'active',
        items: {
          object: 'list',
          data: [
            {
              id: 'si_test_123',
              object: 'subscription_item',
              price: {
                id: 'price_1TYa5ZD7K17UO95drYf0cCRi',
                object: 'price',
                active: true,
                currency: 'usd',
                product: 'prod_test',
                type: 'recurring',
                unit_amount: 14900,
                recurring: {
                  interval: 'month',
                  interval_count: 1,
                },
              } as any,
              quantity: 1,
            } as any,
          ],
          has_more: false,
          url: '/v1/subscription_items',
        } as any,
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        cancel_at_period_end: false,
      } as any,
    },
    livemode: false,
    pending_webhooks: 0,
    request: {
      id: null,
      idempotency_key: null,
    },
  };

  const payload = JSON.stringify(event);
  console.log(`Event ID: ${event.id}`);
  console.log(`Event Type: ${event.type}`);
  console.log(`Payload size: ${payload.length} bytes`);
  console.log('');

  // Generate test signature using Stripe SDK
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;

  // Use Stripe's method to generate test header
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  });

  console.log(`Signature generated: ${signature.substring(0, 50)}...`);
  console.log('');

  // POST to local webhook endpoint
  const url = 'http://localhost:3000/api/webhooks/stripe';
  console.log(`Posting to: ${url}`);
  console.log('');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signature,
      },
      body: payload,
    });

    const responseBody = await response.text();
    let parsedBody;
    try {
      parsedBody = JSON.parse(responseBody);
    } catch {
      parsedBody = responseBody;
    }

    console.log('Response:');
    console.log(`  Status: ${response.status} ${response.statusText}`);
    console.log(`  Body: ${JSON.stringify(parsedBody, null, 2)}`);
    console.log('');

    if (response.status === 200) {
      console.log('✅ Webhook test PASSED');
      console.log('   - Signature verification succeeded');
      console.log('   - Handler returned 200');
      console.log('   - No authentication errors');
    } else if (response.status === 400) {
      console.log('❌ Webhook test FAILED');
      console.log('   - Status 400 (Bad Request)');
      if (typeof parsedBody === 'object' && parsedBody.error) {
        console.log(`   - Error: ${parsedBody.error}`);
        if (parsedBody.error.includes('signature')) {
          console.log('   - Signature verification failed');
          console.log('   - Check STRIPE_WEBHOOK_SECRET matches webhook endpoint');
        }
      }
    } else {
      console.log(`⚠️  Webhook test returned ${response.status}`);
      console.log(`   - Body: ${JSON.stringify(parsedBody, null, 2)}`);
    }
  } catch (error) {
    console.log('❌ Webhook test FAILED');
    console.log('   - Network error or server not running');
    console.log(`   - Error: ${error instanceof Error ? error.message : error}`);
    console.log('');
    console.log('Make sure your Next.js dev server is running:');
    console.log('  npm run dev');
  }

  console.log('');
  console.log('═'.repeat(60));
}

testWebhook().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
