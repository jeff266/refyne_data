/**
 * Arrangements v2 Preflight Test Suite
 *
 * Validates steps 1-5 of the v2 implementation before proceeding to Step 6.
 * Tests RBAC, onboarding flow, calibration tab, and schema migrations.
 *
 * Prerequisites:
 * - App running at app.refynedata.com
 * - Test org with admin, operator, and viewer accounts
 * - Environment variables: TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD,
 *   TEST_OPERATOR_EMAIL, TEST_OPERATOR_PASSWORD, TEST_VIEWER_EMAIL, TEST_VIEWER_PASSWORD
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.TEST_BASE_URL || 'https://app.refynedata.com';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'arrangements-preflight');

// Test credentials from environment
const CREDENTIALS = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@test.refynedata.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'test-password',
  },
  operator: {
    email: process.env.TEST_OPERATOR_EMAIL || 'operator@test.refynedata.com',
    password: process.env.TEST_OPERATOR_PASSWORD || 'test-password',
  },
  viewer: {
    email: process.env.TEST_VIEWER_EMAIL || 'viewer@test.refynedata.com',
    password: process.env.TEST_VIEWER_PASSWORD || 'test-password',
  },
};

interface TestResult {
  name: string;
  passed: boolean;
  screenshot: string;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function signIn(page: Page, role: 'admin' | 'operator' | 'viewer') {
  console.log(`\n🔐 Signing in as ${role}...`);

  const creds = CREDENTIALS[role];

  // Navigate to sign-in page
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'networkidle2', timeout: 30000 });

  // Fill in Clerk auth form
  await page.waitForSelector('input[name="identifier"]', { timeout: 10000 });
  await page.type('input[name="identifier"]', creds.email);
  await page.click('button[type="submit"]');

  // Wait for password field
  await page.waitForSelector('input[name="password"]', { timeout: 10000 });
  await page.type('input[name="password"]', creds.password);
  await page.click('button[type="submit"]');

  // Wait for navigation to complete
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

  console.log(`✅ Signed in as ${role}`);
}

async function signOut(page: Page) {
  console.log('\n🚪 Signing out...');

  try {
    // Click user menu (Clerk component)
    await page.waitForSelector('[data-clerk-element="userButton"]', { timeout: 5000 });
    await page.click('[data-clerk-element="userButton"]');

    // Click sign out
    await page.waitForSelector('[data-clerk-element="signOutButton"]', { timeout: 5000 });
    await page.click('[data-clerk-element="signOutButton"]');

    // Wait for sign-in page
    await page.waitForURL('**/sign-in**', { timeout: 10000 });

    console.log('✅ Signed out');
  } catch (error) {
    console.warn('⚠️  Sign out failed (may already be signed out):', error);
  }
}

async function takeScreenshot(page: Page, filename: string) {
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 Screenshot saved: ${filename}`);
  return filename;
}

async function checkToastVisible(page: Page, timeout = 5000): Promise<boolean> {
  try {
    // Common toast selectors (adjust based on your toast implementation)
    await page.waitForSelector('[data-toast], [role="alert"], .toast', { timeout });
    return true;
  } catch {
    return false;
  }
}

async function runTest(
  testName: string,
  testFn: (browser: Browser, page: Page) => Promise<{ passed: boolean; screenshot: string; error?: string }>
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Test: ${testName}`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS !== 'false',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Capture console logs
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('  Browser console error:', msg.text());
      }
    });

    const result = await testFn(browser, page);
    const duration = Date.now() - startTime;

    results.push({
      name: testName,
      passed: result.passed,
      screenshot: result.screenshot,
      error: result.error,
      duration,
    });

    console.log(result.passed ? '✅ PASS' : '❌ FAIL');
    if (result.error) console.error('Error:', result.error);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ FAIL - Exception:', error);
    results.push({
      name: testName,
      passed: false,
      screenshot: 'error.png',
      error: error instanceof Error ? error.message : String(error),
      duration,
    });
  } finally {
    await browser.close();
  }
}

// =============================================================================
// Test 1: Viewer blocked from /arrangements/new
// =============================================================================
async function test1ViewerBlocked(browser: Browser, page: Page) {
  await signIn(page, 'viewer');

  await page.goto(`${BASE_URL}/arrangements/new`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  const notOnNewPage = !currentUrl.includes('/arrangements/new');
  const toastVisible = await checkToastVisible(page);

  const screenshot = await takeScreenshot(page, 'viewer-redirect.png');

  await signOut(page);

  return {
    passed: notOnNewPage && toastVisible,
    screenshot,
    error: !notOnNewPage ? 'Viewer was not redirected' : !toastVisible ? 'Toast not visible' : undefined,
  };
}

// =============================================================================
// Test 2: Operator can access /arrangements/new
// =============================================================================
async function test2OperatorAccess(browser: Browser, page: Page) {
  await signIn(page, 'operator');

  await page.goto(`${BASE_URL}/arrangements/new`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  const onNewPage = currentUrl.includes('/arrangements/new') || currentUrl.includes('/settings');

  // Check if wizard Step 1 visible (or onboarding modal)
  let wizardVisible = false;
  try {
    await page.waitForSelector('text=/Step 1|New Arrangement|calibration/i', { timeout: 5000 });
    wizardVisible = true;
  } catch {
    wizardVisible = false;
  }

  const screenshot = await takeScreenshot(page, 'operator-wizard-access.png');

  await signOut(page);

  return {
    passed: onNewPage && wizardVisible,
    screenshot,
    error: !onNewPage ? 'Not on arrangements/new' : !wizardVisible ? 'Wizard not visible' : undefined,
  };
}

// =============================================================================
// Test 3: Viewer sees no '+ New arrangement' button
// =============================================================================
async function test3ViewerNoButton(browser: Browser, page: Page) {
  await signIn(page, 'viewer');

  await page.goto(`${BASE_URL}/arrangements`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForTimeout(2000);

  const newButton = await page.$('text=/New arrangement/i');
  const buttonNotInDOM = newButton === null;

  const screenshot = await takeScreenshot(page, 'viewer-arrangements-list.png');

  await signOut(page);

  return {
    passed: buttonNotInDOM,
    screenshot,
    error: !buttonNotInDOM ? '+ New arrangement button found in DOM' : undefined,
  };
}

// =============================================================================
// Test 4: Onboarding gate fires on first use
// =============================================================================
async function test4OnboardingGate(browser: Browser, page: Page) {
  await signIn(page, 'admin');

  // Reset onboarding flag via API
  console.log('  Resetting onboarding flag...');
  await page.evaluate(async () => {
    await fetch('/api/arrangements/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true }),
    });
  });

  await page.goto(`${BASE_URL}/arrangements/new`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Check if onboarding modal visible
  let modalVisible = false;
  try {
    await page.waitForSelector('text=/Before you build your first arrangement/i', { timeout: 5000 });
    modalVisible = true;
  } catch {
    modalVisible = false;
  }

  const screenshot1 = await takeScreenshot(page, 'onboarding-modal-screen1.png');

  // Click to screen 2
  if (modalVisible) {
    await page.click('text=/Start calibration setup/i');
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'onboarding-modal-screen2.png');

    // Select an option to enable next button
    const radios = await page.$$('input[type="radio"]');
    if (radios.length > 0) {
      await radios[0].click();
      await radios[3].click();
      await radios[6].click();
    }

    // Click to screen 3
    await page.click('text=/Next/i');
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'onboarding-modal-screen3.png');
  }

  await signOut(page);

  return {
    passed: modalVisible,
    screenshot: screenshot1,
    error: !modalVisible ? 'Onboarding modal not visible' : undefined,
  };
}

// =============================================================================
// Test 5: Onboarding skip sets flag and enters wizard
// =============================================================================
async function test5OnboardingSkip(browser: Browser, page: Page) {
  await signIn(page, 'admin');

  // Reset onboarding flag
  await page.evaluate(async () => {
    await fetch('/api/arrangements/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true }),
    });
  });

  await page.goto(`${BASE_URL}/arrangements/new`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Click skip
  try {
    await page.click('text=/Skip for now/i');
    await page.waitForTimeout(2000);
  } catch (error) {
    console.warn('  Skip button not found');
  }

  // Check if modal dismissed
  const modalGone = (await page.$('text=/Before you build your first arrangement/i')) === null;

  // Check if wizard visible
  let wizardVisible = false;
  try {
    await page.waitForSelector('text=/Step 1|Name Your Arrangement/i', { timeout: 5000 });
    wizardVisible = true;
  } catch {
    wizardVisible = false;
  }

  // Check onboarding status via API
  const onboardingComplete = await page.evaluate(async () => {
    const res = await fetch('/api/arrangements/onboarding');
    const data = await res.json();
    return data.arrangements_onboarding_complete === true;
  });

  const screenshot = await takeScreenshot(page, 'post-skip-wizard.png');

  await signOut(page);

  return {
    passed: modalGone && wizardVisible && onboardingComplete,
    screenshot,
    error: !modalGone ? 'Modal still visible' : !wizardVisible ? 'Wizard not visible' : !onboardingComplete ? 'Onboarding flag not set' : undefined,
  };
}

// =============================================================================
// Test 6: Calibration tab - admin access
// =============================================================================
async function test6CalibrationAdmin(browser: Browser, page: Page) {
  await signIn(page, 'admin');

  await page.goto(`${BASE_URL}/settings?tab=calibration`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Check if numeric defaults section visible
  let numericDefaultsVisible = false;
  try {
    await page.waitForSelector('text=/Numeric Field Defaults|numeric default/i', { timeout: 5000 });
    numericDefaultsVisible = true;
  } catch {
    numericDefaultsVisible = false;
  }

  // Check not locked
  const lockedText = await page.$('text=/managed by your workspace admin/i');
  const notLocked = lockedText === null;

  const screenshot = await takeScreenshot(page, 'calibration-admin.png');

  await signOut(page);

  return {
    passed: numericDefaultsVisible && notLocked,
    screenshot,
    error: !numericDefaultsVisible ? 'Numeric defaults not visible' : !notLocked ? 'Locked state shown for admin' : undefined,
  };
}

// =============================================================================
// Test 7: Calibration tab - operator locked state
// =============================================================================
async function test7CalibrationOperatorLocked(browser: Browser, page: Page) {
  await signIn(page, 'operator');

  await page.goto(`${BASE_URL}/settings?tab=calibration`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Check for locked state
  let lockedTextVisible = false;
  try {
    await page.waitForSelector('text=/managed by your workspace admin/i', { timeout: 5000 });
    lockedTextVisible = true;
  } catch {
    lockedTextVisible = false;
  }

  // Check no save buttons
  const saveButton = await page.$('text=/Save defaults|Save/i');
  const noSaveButtons = saveButton === null;

  const screenshot = await takeScreenshot(page, 'calibration-operator-locked.png');

  await signOut(page);

  return {
    passed: lockedTextVisible && noSaveButtons,
    screenshot,
    error: !lockedTextVisible ? 'Locked text not visible' : !noSaveButtons ? 'Save buttons found' : undefined,
  };
}

// =============================================================================
// Test 8: Numeric defaults save and reload
// =============================================================================
async function test8NumericDefaultsPersist(browser: Browser, page: Page) {
  await signIn(page, 'admin');

  await page.goto(`${BASE_URL}/settings?tab=calibration`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Change to cluster_average
  try {
    await page.select('select', 'cluster_average');
    await page.waitForTimeout(500);

    // Click save
    await page.click('text=/Save defaults/i');
    await page.waitForTimeout(2000);

    // Check for success message
    const savedVisible = await checkToastVisible(page, 3000);

    // Reload
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);

    // Check if still selected
    const selectedValue = await page.$eval('select', (el: any) => el.value);
    const stillSelected = selectedValue === 'cluster_average';

    const screenshot = await takeScreenshot(page, 'calibration-save-persist.png');

    await signOut(page);

    return {
      passed: savedVisible && stillSelected,
      screenshot,
      error: !savedVisible ? 'Save confirmation not visible' : !stillSelected ? 'Value not persisted' : undefined,
    };
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'calibration-save-persist.png');
    await signOut(page);
    return {
      passed: false,
      screenshot,
      error: `Failed to test persistence: ${error}`,
    };
  }
}

// =============================================================================
// Test 9: Save redirects to /arrangements/[id] not 404
// =============================================================================
async function test9SaveRedirect(browser: Browser, page: Page) {
  await signIn(page, 'admin');

  // Complete onboarding if needed
  await page.evaluate(async () => {
    await fetch('/api/arrangements/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skipped: true }),
    });
  });

  await page.goto(`${BASE_URL}/arrangements/new`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Fill in minimal config
  await page.type('input[placeholder*="Enrich"]', 'Puppeteer Test Arrangement');
  await page.waitForTimeout(500);

  // Navigate through steps
  for (let i = 0; i < 4; i++) {
    await page.click('text=/Next/i');
    await page.waitForTimeout(1500);
  }

  // Save
  await page.click('text=/Save Arrangement/i');
  await page.waitForTimeout(3000);

  const finalUrl = page.url();
  const matchesPattern = /\/arrangements\/[a-f0-9-]+$/.test(finalUrl);
  const not404 = !(await page.$('text=/404|not found/i'));

  const screenshot = await takeScreenshot(page, 'post-save-redirect.png');

  await signOut(page);

  return {
    passed: matchesPattern && not404,
    screenshot,
    error: !matchesPattern ? `URL doesn't match pattern: ${finalUrl}` : !not404 ? 'Page shows 404' : undefined,
  };
}

// =============================================================================
// Test 10: Migration 033 - tables exist
// =============================================================================
async function test10SchemaHealth(browser: Browser, page: Page) {
  // No auth needed for health endpoint
  await page.goto(`${BASE_URL}/api/health/schema`, { waitUntil: 'networkidle2', timeout: 30000 });

  const bodyText = await page.evaluate(() => document.body.textContent);
  const data = JSON.parse(bodyText || '{}');

  const allTablesExist =
    data.arrangements_exists === true &&
    data.calibration_scores_exists === true &&
    data.calibration_sessions_exists === true &&
    data.arrangement_settings_exists === true &&
    data.onboarding_progress_exists === true;

  const screenshot = await takeScreenshot(page, 'schema-health.png');

  return {
    passed: allTablesExist,
    screenshot,
    error: !allTablesExist ? `Missing tables: ${JSON.stringify(data)}` : undefined,
  };
}

// =============================================================================
// Main test runner
// =============================================================================
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Arrangements v2 Preflight Test Suite');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}`);
  console.log('='.repeat(60));

  await runTest('1. Viewer blocked from /arrangements/new', test1ViewerBlocked);
  await runTest('2. Operator can access /arrangements/new', test2OperatorAccess);
  await runTest('3. Viewer sees no + New arrangement button', test3ViewerNoButton);
  await runTest('4. Onboarding gate fires on first use', test4OnboardingGate);
  await runTest('5. Onboarding skip sets flag', test5OnboardingSkip);
  await runTest('6. Calibration tab - admin access', test6CalibrationAdmin);
  await runTest('7. Calibration tab - operator locked', test7CalibrationOperatorLocked);
  await runTest('8. Numeric defaults persist', test8NumericDefaultsPersist);
  await runTest('9. Save redirects correctly', test9SaveRedirect);
  await runTest('10. Migration 033 - schema health', test10SchemaHealth);

  // Print summary table
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(80));
  console.log(
    'Test'.padEnd(50) +
    'Result'.padEnd(10) +
    'Screenshot'
  );
  console.log('-'.repeat(80));

  let allPassed = true;
  results.forEach((result) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    allPassed = allPassed && result.passed;

    console.log(
      result.name.padEnd(50) +
      status.padEnd(10) +
      result.screenshot
    );

    if (result.error) {
      console.log('  └─ Error: ' + result.error);
    }
  });

  console.log('='.repeat(80));
  console.log(`Total: ${results.length} tests, ${results.filter(r => r.passed).length} passed, ${results.filter(r => !r.passed).length} failed`);
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
  console.log('='.repeat(80));

  if (!allPassed) {
    console.error('\n❌ SOME TESTS FAILED - DO NOT PROCEED TO STEP 6');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED - READY TO PROCEED TO STEP 6');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
