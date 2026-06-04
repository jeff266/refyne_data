/**
 * Delete Harmony End-to-End Test
 *
 * Tests the complete harmony deletion flow:
 * 1. Create a custom harmony
 * 2. Navigate to detail page and verify "Custom" badge
 * 3. Archive the harmony
 * 4. Navigate to archived harmony and delete permanently
 * 5. Verify harmony is removed from list
 *
 * Prerequisites:
 * - App running at BASE_URL (default: https://app.refynedata.com)
 * - Test account with admin access
 * - Environment variables: TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
 *
 * Usage:
 *   npx tsx tests/e2e/delete-harmony.spec.ts
 *   HEADLESS=false npx tsx tests/e2e/delete-harmony.spec.ts  # Run with visible browser
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.TEST_BASE_URL || 'https://app.refynedata.com';
const SCREENSHOT_DIR = path.join(__dirname, '..', '..', 'test-results', 'delete-harmony');

const ADMIN_CREDENTIALS = {
  email: process.env.TEST_ADMIN_EMAIL || 'admin@test.refynedata.com',
  password: process.env.TEST_ADMIN_PASSWORD || 'test-password',
};

// Test harmony name with timestamp to ensure uniqueness
const TEST_HARMONY_NAME = `Test Delete Harmony ${Date.now()}`;

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

/**
 * Sign in to the application
 */
async function signIn(page: Page) {
  console.log('🔐 Signing in...');

  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'networkidle2', timeout: 30000 });

  // Fill in Clerk auth form
  await page.waitForSelector('input[name="identifier"]', { timeout: 10000 });
  await page.type('input[name="identifier"]', ADMIN_CREDENTIALS.email);
  await page.click('button[type="submit"]');

  // Wait for password field
  await page.waitForSelector('input[name="password"]', { timeout: 10000 });
  await page.type('input[name="password"]', ADMIN_CREDENTIALS.password);
  await page.click('button[type="submit"]');

  // Wait for navigation to complete
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

  console.log('✅ Signed in');
}

/**
 * Take a screenshot and save it with the given filename
 */
async function takeScreenshot(page: Page, filename: string): Promise<string> {
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 Screenshot saved: ${filename}`);
  return filename;
}

/**
 * Click element containing specific text
 */
async function clickText(page: Page, text: string) {
  await page.evaluate((searchText: string) => {
    const element = Array.from(document.querySelectorAll('*')).find(el =>
      (el.textContent || '').includes(searchText)
    );

    if (element && element instanceof HTMLElement) {
      element.click();
    } else {
      throw new Error(`Element with text "${searchText}" not found`);
    }
  }, text);
}

/**
 * Scroll to element with specific text
 */
async function scrollToText(page: Page, text: string) {
  await page.evaluate((searchText: string) => {
    const element = Array.from(document.querySelectorAll('*')).find(el =>
      (el.textContent || '').includes(searchText)
    );

    if (element && element instanceof HTMLElement) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      throw new Error(`Element with text "${searchText}" not found`);
    }
  }, text);
}

/**
 * Run a single test
 */
async function runTest(
  name: string,
  testFn: (browser: Browser, page: Page) => Promise<void>
): Promise<void> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 Test: ${name}`);
  console.log('='.repeat(70));

  const startTime = Date.now();
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS !== 'false',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Log browser console messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('  Browser console error:', msg.text());
      }
    });

    await testFn(browser, page);

    const duration = Date.now() - startTime;
    const screenshot = await takeScreenshot(page, `${name.replace(/\s+/g, '-').toLowerCase()}-success.png`);

    results.push({
      name,
      passed: true,
      screenshot,
      duration,
    });

    console.log(`✅ PASS (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ FAIL - Exception:', error);

    const page = (await browser.pages())[0];
    const screenshot = await takeScreenshot(page, `${name.replace(/\s+/g, '-').toLowerCase()}-failure.png`);

    results.push({
      name,
      passed: false,
      screenshot,
      error: error instanceof Error ? error.message : String(error),
      duration,
    });
  } finally {
    await browser.close();
  }
}

// =============================================================================
// Main Test: Complete Delete Harmony Flow
// =============================================================================
async function testCompleteDeleteFlow(browser: Browser, page: Page): Promise<void> {
  let createdHarmonyId: string | null = null;

  // Step 1: Sign in
  await signIn(page);
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 2: Navigate to /harmonies page
  console.log('📍 Navigating to /harmonies page...');
  await page.goto(`${BASE_URL}/harmonies`, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 1000));
  await takeScreenshot(page, '01-harmonies-page.png');

  // Step 3: Click "+ New harmony" button
  console.log('🆕 Clicking "+ New harmony" button...');
  await clickText(page, 'New harmony');
  await new Promise(resolve => setTimeout(resolve, 1500));
  await takeScreenshot(page, '02-wizard-opened.png');

  // Step 4: Fill out harmony creation form
  console.log('📝 Filling out harmony creation form...');

  // Wait for wizard to be visible and fill name
  await page.waitForSelector('input[type="text"]', { timeout: 5000 });
  await page.evaluate((name: string) => {
    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    if (input) {
      input.value = '';
      input.focus();
    }
  }, TEST_HARMONY_NAME);
  await page.type('input[type="text"]', TEST_HARMONY_NAME);
  console.log(`  Name: ${TEST_HARMONY_NAME}`);
  await new Promise(resolve => setTimeout(resolve, 500));

  // Select classification type, source field, etc. (if available)
  try {
    await clickText(page, 'Sub-industry');
    console.log('  Classification: Sub-industry');
  } catch {
    console.log('  Classification: Skipped');
  }
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    await clickText(page, 'industry');
    console.log('  Source field: industry');
  } catch {
    console.log('  Source field: Skipped');
  }
  await new Promise(resolve => setTimeout(resolve, 500));

  await takeScreenshot(page, '03-form-filled.png');

  // Step 5: Save the harmony
  console.log('💾 Saving harmony...');
  try {
    await clickText(page, 'Next');
  } catch {
    try {
      await clickText(page, 'Save');
    } catch {
      await clickText(page, 'Create');
    }
  }
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Handle multi-step wizard
  for (let i = 0; i < 3; i++) {
    try {
      await clickText(page, 'Finish');
      await new Promise(resolve => setTimeout(resolve, 1000));
      break;
    } catch {
      try {
        await clickText(page, 'Next');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch {
        break;
      }
    }
  }

  await takeScreenshot(page, '04-harmony-created.png');

  // Step 6: Get the created harmony ID
  await new Promise(resolve => setTimeout(resolve, 2000));
  const currentUrl = page.url();
  console.log(`  Current URL: ${currentUrl}`);

  const detailMatch = currentUrl.match(/\/harmonies\/([^\/]+)/);
  if (detailMatch) {
    createdHarmonyId = detailMatch[1];
    console.log(`✅ Harmony created with ID: ${createdHarmonyId}`);
  } else {
    // Find and click the harmony in the list
    console.log('  Looking for created harmony in list...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await clickText(page, TEST_HARMONY_NAME);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const newUrl = page.url();
    const match = newUrl.match(/\/harmonies\/([^\/]+)/);
    if (match) {
      createdHarmonyId = match[1];
      console.log(`✅ Found harmony with ID: ${createdHarmonyId}`);
    }
  }

  if (!createdHarmonyId) {
    throw new Error('Failed to get created harmony ID');
  }

  // Step 7: Verify "Custom" badge
  console.log('🔍 Verifying "Custom" badge...');
  await new Promise(resolve => setTimeout(resolve, 1000));

  const hasCustomBadge = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).some(el =>
      el.textContent?.toUpperCase().includes('CUSTOM')
    );
  });

  const hasLibraryBadge = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).some(el =>
      el.textContent?.includes('Library')
    );
  });

  if (!hasCustomBadge) {
    throw new Error('Custom badge not found on harmony detail page');
  }

  if (hasLibraryBadge) {
    throw new Error('Library badge found but should not be present for custom harmony');
  }

  console.log('✅ Custom badge verified, Library badge not present');
  await takeScreenshot(page, '05-custom-badge-verified.png');

  // Step 8: Scroll to Danger Zone and archive
  console.log('📜 Scrolling to Danger Zone section...');
  await scrollToText(page, 'Danger Zone');
  await new Promise(resolve => setTimeout(resolve, 500));
  await takeScreenshot(page, '06-danger-zone-visible.png');

  // Step 9 & 10: Click Archive and confirm
  console.log('🗃️  Clicking "Archive Harmony" button...');
  page.once('dialog', async dialog => {
    console.log(`  Dialog message: ${dialog.message()}`);
    await dialog.accept();
  });
  await clickText(page, 'Archive Harmony');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 11: Verify redirect
  console.log('🔄 Verifying redirect to /harmonies...');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
  await new Promise(resolve => setTimeout(resolve, 1000));

  const harmoniesUrl = page.url();
  if (!harmoniesUrl.includes('/harmonies')) {
    throw new Error('Not redirected to /harmonies page after archive');
  }

  console.log('✅ Redirected to /harmonies');
  await takeScreenshot(page, '07-back-to-harmonies-list.png');

  // Step 12: Show archived
  console.log('👁️  Clicking "Show archived" toggle...');
  await clickText(page, 'Show archived');
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('✅ Archived harmonies now visible');
  await takeScreenshot(page, '08-archived-visible.png');

  // Step 13: Click archived harmony
  console.log('🔗 Clicking on archived harmony...');
  await clickText(page, TEST_HARMONY_NAME);
  await new Promise(resolve => setTimeout(resolve, 2000));
  await takeScreenshot(page, '09-archived-harmony-detail.png');

  // Step 14: Verify Delete Permanently section
  console.log('🔍 Verifying "Delete Permanently" section...');
  await scrollToText(page, 'Danger Zone');
  await new Promise(resolve => setTimeout(resolve, 500));

  const hasDeletePermanently = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).some(el =>
      el.textContent?.includes('Delete Permanently') || el.textContent?.includes('Permanently delete')
    );
  });

  if (!hasDeletePermanently) {
    throw new Error('Delete Permanently section not found for archived harmony');
  }

  console.log('✅ Delete Permanently section verified');
  await takeScreenshot(page, '10-delete-permanently-section.png');

  // Step 15: Type confirmation
  console.log('⌨️  Typing harmony name in confirmation input...');
  const textInputs = await page.$$('input[type="text"]');
  if (textInputs.length > 0) {
    await textInputs[textInputs.length - 1].type(TEST_HARMONY_NAME);
  } else {
    throw new Error('Delete confirmation input not found');
  }

  console.log(`  Typed: ${TEST_HARMONY_NAME}`);
  await new Promise(resolve => setTimeout(resolve, 500));
  await takeScreenshot(page, '11-confirmation-typed.png');

  // Step 16: Delete permanently
  console.log('🗑️  Clicking "Delete Permanently" button...');
  await clickText(page, 'Delete Permanently');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 17: Verify redirect after deletion
  console.log('🔄 Verifying redirect after deletion...');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
  await new Promise(resolve => setTimeout(resolve, 1000));

  const finalUrl = page.url();
  if (!finalUrl.includes('/harmonies')) {
    throw new Error('Not redirected to /harmonies page after deletion');
  }

  console.log('✅ Redirected to /harmonies after deletion');
  await takeScreenshot(page, '12-after-deletion.png');

  // Step 18: Verify permanent deletion
  console.log('🔍 Verifying harmony is permanently deleted...');
  
  // Ensure archived harmonies are visible
  const showArchivedStillOn = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).some(btn =>
      btn.textContent?.includes('Hide archived')
    );
  });

  if (!showArchivedStillOn) {
    try {
      await clickText(page, 'Show archived');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      console.log('  Note: Could not toggle Show archived');
    }
  }

  const harmonyStillExists = await page.evaluate((harmonyName: string) => {
    return Array.from(document.querySelectorAll('*')).some(el =>
      el.textContent?.includes(harmonyName)
    );
  }, TEST_HARMONY_NAME);

  if (harmonyStillExists) {
    throw new Error('Harmony still found in list after permanent deletion');
  }

  console.log('✅ Harmony permanently deleted - not found in list');
  await takeScreenshot(page, '13-final-verification.png');
  console.log('\n🎉 All steps completed successfully!');
}

// =============================================================================
// Run Tests
// =============================================================================
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 DELETE HARMONY END-TO-END TEST SUITE');
  console.log('='.repeat(70));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Harmony Name: ${TEST_HARMONY_NAME}`);
  console.log('='.repeat(70));

  await runTest('Complete Delete Harmony Flow', testCompleteDeleteFlow);

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name} (${result.duration}ms)`);
    if (result.error) {
      console.log(`       Error: ${result.error}`);
    }
    console.log(`       Screenshot: ${result.screenshot}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(70));

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run the tests
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
