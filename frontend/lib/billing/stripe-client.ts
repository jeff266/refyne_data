/**
 * Stripe Client Configuration
 *
 * Centralizes Stripe initialization with support for test/live mode switching.
 * Use STRIPE_TEST_MODE=true in .env.local to use test keys in development.
 */

import Stripe from 'stripe';

/**
 * Get the appropriate Stripe secret key based on test mode
 */
function getStripeSecretKey(): string {
  const isTestMode = process.env.STRIPE_TEST_MODE === 'true';

  if (isTestMode) {
    const testKey = process.env.STRIPE_TEST_SECRET_KEY;
    if (!testKey) {
      throw new Error(
        'STRIPE_TEST_MODE is enabled but STRIPE_TEST_SECRET_KEY is not set. ' +
        'Get your test key from https://dashboard.stripe.com/test/apikeys'
      );
    }
    return testKey;
  }

  const liveKey = process.env.STRIPE_SECRET_KEY;
  if (!liveKey) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }

  return liveKey;
}

/**
 * Get configured Stripe client instance
 */
export function getStripeClient(): Stripe {
  const secretKey = getStripeSecretKey();

  return new Stripe(secretKey, {
    apiVersion: '2026-04-22.dahlia',
  });
}

/**
 * Check if we're in test mode
 */
export function isStripeTestMode(): boolean {
  return process.env.STRIPE_TEST_MODE === 'true';
}
