/**
 * End-to-End Stripe Checkout Test
 *
 * Tests the complete checkout flow from upgrade page to subscription activation.
 * Uses Puppeteer to automate browser interaction with Stripe checkout.
 *
 * Prerequisites:
 * - STRIPE_TEST_MODE=true in .env.local
 * - Dev server running on http://localhost:3000
 * - npm run dev
 *
 * Run: npx tsx scripts/test-checkout-e2e.ts
 *
 * Flow:
 * 1. Opens browser (headless: false) for manual Clerk login
 * 2. Navigates to /billing/upgrade
 * 3. Clicks "Get started" on Starter monthly plan
 * 4. Fills Stripe test card: 4242 4242 4242 4242
 * 5. Completes checkout
 * 6. Waits for /billing/success redirect
 * 7. Polls /api/billing/status until subscription is active
 * 8. Logs org_billing and webhook events
 */

// Load environment variables FIRST before any imports
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 30000; // 30 seconds

// Stripe test card details
const TEST_CARD = {
  number: '4242424242424242',
  expiry: '1229', // MMYY format
  cvc: '123',
  name: 'Test User',
  email: 'test@refynedata.com',
};

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForElement(page: Page, selector: string, timeout = TIMEOUT) {
  console.log(`  ⏳ Waiting for element: ${selector}`);
  await page.waitForSelector(selector, { timeout });
  console.log(`  ✓ Found element: ${selector}`);
}

async function pollBillingStatus(page: Page, maxAttempts = 5): Promise<any> {
  console.log('\n📊 Polling billing status...');

  for (let i = 1; i <= maxAttempts; i++) {
    console.log(`  Attempt ${i}/${maxAttempts}...`);

    try {
      const response = await page.goto(`${BASE_URL}/api/billing/status`, {
        waitUntil: 'networkidle0',
      });

      if (response && response.ok()) {
        const data = await response.json();
        console.log(`  Response:`, JSON.stringify(data, null, 2));

        if (data.subscription_tier && data.subscription_tier !== 'trial') {
          console.log(`  ✅ Subscription activated: ${data.subscription_tier}`);
          return data;
        }
      }
    } catch (error) {
      console.error(`  ⚠️ Request failed:`, error);
    }

    if (i < maxAttempts) {
      console.log(`  ⏳ Waiting 3 seconds before next attempt...`);
      await sleep(3000);
    }
  }

  console.log(`  ⚠️ Subscription not activated after ${maxAttempts} attempts`);
  return null;
}

async function logDatabaseState(orgId: string) {
  console.log('\n💾 Database State:');
  console.log('═'.repeat(60));

  // Dynamic import to avoid module-level initialization
  const { supabaseAdmin } = await import('../lib/db/admin-client');

  // Get org_billing row
  const { data: billing, error: billingError } = await supabaseAdmin
    .from('org_billing')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (billingError) {
    console.error('❌ Error fetching org_billing:', billingError);
  } else {
    console.log('\n📋 org_billing:');
    console.log(JSON.stringify(billing, null, 2));
  }

  // Get recent webhook events
  const { data: webhooks, error: webhookError } = await supabaseAdmin
    .from('stripe_webhook_events')
    .select('*')
    .eq('org_id', orgId)
    .order('processed_at', { ascending: false })
    .limit(5);

  if (webhookError) {
    console.error('❌ Error fetching webhook events:', webhookError);
  } else if (webhooks && webhooks.length > 0) {
    console.log('\n📨 stripe_webhook_events (recent 5):');
    webhooks.forEach((event, i) => {
      console.log(`\n  [${i + 1}] ${event.event_type} (${event.id})`);
      console.log(`      Processed: ${event.processed_at}`);
    });
  } else {
    console.log('\n📨 stripe_webhook_events: (none found)');
  }

  console.log('\n' + '═'.repeat(60));
}

async function runCheckoutTest() {
  console.log('🚀 Starting Stripe Checkout E2E Test');
  console.log('═'.repeat(60));

  // Verify environment
  if (process.env.STRIPE_TEST_MODE !== 'true') {
    console.error('❌ STRIPE_TEST_MODE must be set to true');
    console.error('Set it in .env.local and restart the dev server');
    process.exit(1);
  }

  console.log('✓ STRIPE_TEST_MODE is enabled');
  console.log('');

  let browser: Browser | null = null;
  let testPassed = false;
  let orgId: string | null = null;

  try {
    // Launch browser with head (visible) for manual login
    console.log('🌐 Launching browser (headless: false)...');
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1280, height: 800 },
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Step 1: Navigate to upgrade page
    console.log('\n📍 Step 1: Navigate to /billing/upgrade');
    console.log('⏸️  Please log in to Clerk if prompted...');
    await page.goto(`${BASE_URL}/billing/upgrade`, {
      waitUntil: 'networkidle0',
      timeout: TIMEOUT,
    });

    // Wait for plan cards to load
    console.log('\n📍 Step 2: Wait for plan cards to load');
    await waitForElement(page, 'h1'); // Wait for "Choose a plan" header
    await sleep(2000); // Give pricing a moment to load

    // Step 3: Click "Get started" on Starter monthly plan
    console.log('\n📍 Step 3: Click "Get started" on Starter monthly plan');

    // First ensure we're on monthly billing
    const monthlyButton = await page.$('button:has-text("Monthly")');
    if (monthlyButton) {
      console.log('  Clicking Monthly toggle...');
      await monthlyButton.click();
      await sleep(1000);
    }

    // Find and click the "Get started" button
    // The button text might be "Get started", "Upgrade", etc.
    const buttons = await page.$$('button');
    let clickedButton = false;

    for (const button of buttons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text && (text.includes('Get started') || text.includes('Upgrade'))) {
        console.log(`  Found button: "${text}"`);
        await button.click();
        clickedButton = true;
        console.log('  ✓ Clicked button');
        break;
      }
    }

    if (!clickedButton) {
      throw new Error('Could not find "Get started" or "Upgrade" button');
    }

    // Step 4: Wait for Stripe checkout redirect
    console.log('\n📍 Step 4: Wait for redirect to checkout.stripe.com');
    await page.waitForNavigation({ timeout: TIMEOUT });

    const currentUrl = page.url();
    console.log(`  Current URL: ${currentUrl}`);

    if (!currentUrl.includes('checkout.stripe.com')) {
      throw new Error(`Expected redirect to checkout.stripe.com, got: ${currentUrl}`);
    }

    console.log('  ✓ Redirected to Stripe Checkout');

    // Step 5: Fill in Stripe test card details
    console.log('\n📍 Step 5: Fill in Stripe test card');

    // Wait for Stripe checkout form to load
    await sleep(3000);

    // Fill card number (Stripe uses iframes, so we need to handle them)
    console.log('  Filling card details...');

    // Email
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) {
      await emailInput.click({ clickCount: 3 }); // Select all
      await emailInput.type(TEST_CARD.email);
      console.log('  ✓ Email entered');
    }

    // Card number (in iframe)
    const cardNumberFrame = page.frames().find(frame =>
      frame.url().includes('js.stripe.com')
    );

    if (cardNumberFrame) {
      const cardNumberInput = await cardNumberFrame.$('input[name="number"]');
      if (cardNumberInput) {
        await cardNumberInput.type(TEST_CARD.number);
        console.log('  ✓ Card number entered');
      }

      // Expiry
      const expiryInput = await cardNumberFrame.$('input[name="expiry"]');
      if (expiryInput) {
        await expiryInput.type(TEST_CARD.expiry);
        console.log('  ✓ Expiry entered');
      }

      // CVC
      const cvcInput = await cardNumberFrame.$('input[name="cvc"]');
      if (cvcInput) {
        await cvcInput.type(TEST_CARD.cvc);
        console.log('  ✓ CVC entered');
      }
    }

    // Cardholder name
    const nameInput = await page.$('input[name="name"]');
    if (nameInput) {
      await nameInput.type(TEST_CARD.name);
      console.log('  ✓ Name entered');
    }

    // Step 6: Submit payment
    console.log('\n📍 Step 6: Submit payment');

    // Find and click the submit button
    const submitButtons = await page.$$('button[type="submit"]');
    if (submitButtons.length > 0) {
      console.log('  Clicking submit button...');
      await submitButtons[0].click();
      console.log('  ✓ Payment submitted');
    } else {
      throw new Error('Could not find submit button');
    }

    // Step 7: Wait for redirect to /billing/success
    console.log('\n📍 Step 7: Wait for redirect to /billing/success');
    await page.waitForNavigation({ timeout: TIMEOUT });

    const successUrl = page.url();
    console.log(`  Current URL: ${successUrl}`);

    if (!successUrl.includes('/billing/success')) {
      throw new Error(`Expected redirect to /billing/success, got: ${successUrl}`);
    }

    console.log('  ✓ Redirected to success page');

    // Step 8: Assert success message
    console.log('\n📍 Step 8: Assert success message');
    await sleep(2000);

    const pageContent = await page.content();
    const hasSuccessMessage =
      pageContent.includes("You're all set") ||
      pageContent.includes('activating') ||
      pageContent.includes('Your plan is activating');

    if (!hasSuccessMessage) {
      console.warn('  ⚠️ Success message not found (might still be processing)');
    } else {
      console.log('  ✓ Success message found');
    }

    // Get org_id from page context or API response
    const statusResponse = await page.goto(`${BASE_URL}/api/billing/status`, {
      waitUntil: 'networkidle0',
    });

    if (statusResponse && statusResponse.ok()) {
      const statusData = await statusResponse.json();

      // Dynamic import to avoid module-level initialization
      const { supabaseAdmin } = await import('../lib/db/admin-client');

      // Try to extract org_id (it might be in the response or we can query it)
      // For now, we'll query the database to find the most recent org_billing update
      const { data: recentBilling } = await supabaseAdmin
        .from('org_billing')
        .select('org_id, subscription_tier')
        .neq('subscription_tier', 'trial')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (recentBilling) {
        orgId = recentBilling.org_id;
        console.log(`\n  Found org_id: ${orgId}`);
      }
    }

    // Step 9: Poll billing status
    console.log('\n📍 Step 9: Poll billing status');
    const billingStatus = await pollBillingStatus(page);

    // Step 10: Assert subscription tier
    console.log('\n📍 Step 10: Assert subscription tier');
    if (billingStatus && billingStatus.subscription_tier === 'starter') {
      console.log('  ✅ Subscription tier is "starter"');
      testPassed = true;
    } else {
      console.error('  ❌ Subscription tier is not "starter"');
      console.error('  Actual:', billingStatus?.subscription_tier || 'unknown');
    }

    // Log database state
    if (orgId) {
      await logDatabaseState(orgId);
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
  } finally {
    // Close browser
    if (browser) {
      console.log('\n🔒 Closing browser...');
      await browser.close();
    }

    // Print result
    console.log('\n' + '═'.repeat(60));
    if (testPassed) {
      console.log('✅ TEST PASSED');
    } else {
      console.log('❌ TEST FAILED');
    }
    console.log('═'.repeat(60));

    process.exit(testPassed ? 0 : 1);
  }
}

// Run the test
runCheckoutTest();
