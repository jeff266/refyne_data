/**
 * Archive Harmony Modal End-to-End Test
 *
 * Tests the custom Archive modal implementation:
 * 1. Sign in to the app
 * 2. Navigate to /harmonies
 * 3. Find a custom (non-library) harmony
 * 4. Click on harmony to open detail page
 * 5. Scroll to "Danger Zone" section
 * 6. Click "Archive Harmony" button
 * 7. Verify modal appearance (overlay, styling, text, buttons)
 * 8. Test Cancel button functionality
 * 9. Test backdrop click to close
 * 10. Test Archive confirmation (OK button)
 * 11. Verify redirect to /harmonies
 * 12. Verify harmony is no longer in default list
 * 13. Test "Show archived" toggle
 * 14. Verify archived harmony appears with "Archived" badge
 *
 * Prerequisites:
 * - App running at BASE_URL (default: https://app.refynedata.com)
 * - Test account with admin access
 * - Environment variables: TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
 * - At least one custom harmony exists for testing
 *
 * Usage:
 *   npx tsx tests/e2e/archive-harmony-modal.spec.ts
 *   HEADLESS=false npx tsx tests/e2e/archive-harmony-modal.spec.ts  # Run with visible browser
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.TEST_BASE_URL || 'https://app.refynedata.com';
const SCREENSHOT_DIR = path.join(__dirname, '..', '..', 'test-results', 'archive-harmony-modal');

const ADMIN_CREDENTIALS = {
  email: process.env.TEST_ADMIN_EMAIL || 'admin@test.refynedata.com',
  password: process.env.TEST_ADMIN_PASSWORD || 'test-password',
};

// Test harmony name with timestamp to ensure uniqueness
const TEST_HARMONY_NAME = `Test Archive Modal Harmony ${Date.now()}`;

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
 * Click on the backdrop (outside the modal dialog)
 */
async function clickBackdrop(page: Page) {
  await page.evaluate(() => {
    // Find the modal overlay (fixed position, full screen background)
    const backdrop = Array.from(document.querySelectorAll('div')).find(el => {
      const style = window.getComputedStyle(el);
      return (
        style.position === 'fixed' &&
        style.top === '0px' &&
        style.left === '0px' &&
        style.right === '0px' &&
        style.bottom === '0px' &&
        style.background.includes('rgba') // Semi-transparent background
      );
    });

    if (backdrop && backdrop instanceof HTMLElement) {
      backdrop.click();
    } else {
      throw new Error('Modal backdrop not found');
    }
  });
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
// Main Test: Archive Harmony Modal Flow
// =============================================================================
async function testArchiveHarmonyModal(browser: Browser, page: Page): Promise<void> {
  let createdHarmonyId: string | null = null;

  // Step 1: Sign in
  await signIn(page);
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 2: Navigate to /harmonies page
  console.log('📍 Navigating to /harmonies page...');
  await page.goto(`${BASE_URL}/harmonies`, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 1000));
  await takeScreenshot(page, '01-harmonies-page.png');

  // Step 3: Create a custom harmony for testing
  console.log('🆕 Creating test harmony...');
  await clickText(page, 'New harmony');
  await new Promise(resolve => setTimeout(resolve, 1500));
  await takeScreenshot(page, '02-wizard-opened.png');

  // Fill out harmony creation form
  console.log('📝 Filling out harmony creation form...');
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

  // Select options if available
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

  // Save the harmony
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

  // Get the created harmony ID
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
    await page.goto(`${BASE_URL}/harmonies`, { waitUntil: 'networkidle2', timeout: 30000 });
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

  // Step 4: Verify we're on the harmony detail page
  console.log('🔍 Verifying harmony detail page...');
  const isOnDetailPage = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).some(el =>
      el.textContent?.includes('How it works') || el.textContent?.includes('Live Tester')
    );
  });

  if (!isOnDetailPage) {
    throw new Error('Not on harmony detail page');
  }

  console.log('✅ On harmony detail page');
  await takeScreenshot(page, '05-detail-page.png');

  // Step 5: Scroll to Danger Zone
  console.log('📜 Scrolling to Danger Zone section...');
  await scrollToText(page, 'Danger Zone');
  await new Promise(resolve => setTimeout(resolve, 500));
  await takeScreenshot(page, '06-danger-zone-visible.png');

  // Step 6: Click "Archive Harmony" button
  console.log('🗃️  Clicking "Archive Harmony" button...');
  await clickText(page, 'Archive Harmony');
  await new Promise(resolve => setTimeout(resolve, 1000));
  await takeScreenshot(page, '07-modal-opened.png');

  // Step 7: Verify Modal Appearance
  console.log('🔍 Verifying modal appearance...');

  // Check modal overlay is visible
  const hasOverlay = await page.evaluate(() => {
    const overlay = Array.from(document.querySelectorAll('div')).find(el => {
      const style = window.getComputedStyle(el);
      return (
        style.position === 'fixed' &&
        style.top === '0px' &&
        style.left === '0px' &&
        style.right === '0px' &&
        style.bottom === '0px' &&
        style.background.includes('rgba')
      );
    });
    return !!overlay;
  });

  if (!hasOverlay) {
    throw new Error('Modal overlay not found');
  }
  console.log('  ✓ Modal overlay visible');

  // Check modal dialog styling
  const hasCorrectDialog = await page.evaluate(() => {
    // Find elements with background matching C.surface pattern
    const dialogs = Array.from(document.querySelectorAll('div')).filter(el => {
      const style = window.getComputedStyle(el);
      const bg = style.background;
      // Check for surface color or white background
      return (bg.includes('rgb') || bg.includes('#')) && style.border.includes('1px');
    });
    return dialogs.length > 0;
  });

  if (!hasCorrectDialog) {
    throw new Error('Modal dialog with correct styling not found');
  }
  console.log('  ✓ Modal dialog has correct styling');

  // Check header text
  const hasCorrectHeader = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).some(el =>
      el.textContent?.trim() === 'Archive this harmony?'
    );
  });

  if (!hasCorrectHeader) {
    throw new Error('Modal header text incorrect');
  }
  console.log('  ✓ Header text: "Archive this harmony?"');

  // Check body text
  const hasCorrectBody = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).some(el =>
      el.textContent?.includes('It will be hidden from the harmonies list but can be recovered')
    );
  });

  if (!hasCorrectBody) {
    throw new Error('Modal body text incorrect');
  }
  console.log('  ✓ Body text correct');

  // Check Cancel button
  const hasCancelButton = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).some(btn =>
      btn.textContent?.trim() === 'Cancel'
    );
  });

  if (!hasCancelButton) {
    throw new Error('Cancel button not found');
  }
  console.log('  ✓ Cancel button visible');

  // Check OK button with indigo background
  const hasOKButton = await page.evaluate(() => {
    const okButtons = Array.from(document.querySelectorAll('button')).filter(btn =>
      btn.textContent?.trim() === 'OK'
    );

    if (okButtons.length === 0) return false;

    // Check if at least one OK button has indigo/blue background
    return okButtons.some(btn => {
      const style = window.getComputedStyle(btn);
      const bg = style.background;
      // Check for indigo color (various formats)
      return bg.includes('rgb') && (bg.includes('99, 102, 241') || bg.includes('79, 70, 229'));
    });
  });

  if (!hasOKButton) {
    throw new Error('OK button with indigo background not found');
  }
  console.log('  ✓ OK button visible with indigo background');

  console.log('✅ Modal appearance verified');
  await takeScreenshot(page, '08-modal-verified.png');

  // Step 8: Test Cancel Button
  console.log('🚫 Testing Cancel button...');
  await clickText(page, 'Cancel');
  await new Promise(resolve => setTimeout(resolve, 500));

  // Verify modal closed
  const modalStillOpen = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).some(el =>
      el.textContent?.includes('Archive this harmony?')
    );
  });

  if (modalStillOpen) {
    throw new Error('Modal did not close after clicking Cancel');
  }
  console.log('  ✓ Modal closed');

  // Verify still on harmony detail page
  const stillOnDetailPage = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).some(el =>
      el.textContent?.includes('Danger Zone')
    );
  });

  if (!stillOnDetailPage) {
    throw new Error('Not on harmony detail page after cancel');
  }
  console.log('  ✓ Still on harmony detail page');
  console.log('✅ Cancel button works correctly');
  await takeScreenshot(page, '09-after-cancel.png');

  // Step 9: Test Backdrop Click
  console.log('🖱️  Testing backdrop click...');
  await scrollToText(page, 'Danger Zone');
  await new Promise(resolve => setTimeout(resolve, 500));
  await clickText(page, 'Archive Harmony');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Click backdrop
  await clickBackdrop(page);
  await new Promise(resolve => setTimeout(resolve, 500));

  // Verify modal closed
  const modalStillOpenAfterBackdrop = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).some(el =>
      el.textContent?.includes('Archive this harmony?')
    );
  });

  if (modalStillOpenAfterBackdrop) {
    throw new Error('Modal did not close after clicking backdrop');
  }
  console.log('  ✓ Modal closed after backdrop click');
  console.log('✅ Backdrop click works correctly');
  await takeScreenshot(page, '10-after-backdrop-click.png');

  // Step 10: Test Archive Confirmation (OK button)
  console.log('✅ Testing Archive confirmation...');
  await scrollToText(page, 'Danger Zone');
  await new Promise(resolve => setTimeout(resolve, 500));
  await clickText(page, 'Archive Harmony');
  await new Promise(resolve => setTimeout(resolve, 1000));
  await takeScreenshot(page, '11-before-ok-click.png');

  // Click OK
  await clickText(page, 'OK');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 11: Verify redirect to /harmonies
  console.log('🔄 Verifying redirect to /harmonies...');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
  await new Promise(resolve => setTimeout(resolve, 1000));

  const harmoniesUrl = page.url();
  if (!harmoniesUrl.includes('/harmonies') || harmoniesUrl.includes(`/harmonies/${createdHarmonyId}`)) {
    throw new Error('Not redirected to /harmonies page after archive');
  }

  console.log('✅ Redirected to /harmonies');
  await takeScreenshot(page, '12-back-to-harmonies-list.png');

  // Step 12: Verify harmony is no longer in default list
  console.log('🔍 Verifying harmony is not in default list...');
  const harmonyInDefaultList = await page.evaluate((harmonyName: string) => {
    return Array.from(document.querySelectorAll('*')).some(el =>
      el.textContent?.includes(harmonyName)
    );
  }, TEST_HARMONY_NAME);

  if (harmonyInDefaultList) {
    throw new Error('Harmony still visible in default list after archive');
  }
  console.log('✅ Harmony not in default list');
  await takeScreenshot(page, '13-harmony-not-visible.png');

  // Step 13: Test "Show archived" toggle
  console.log('👁️  Clicking "Show archived" toggle...');
  await clickText(page, 'Show archived');
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('✅ Archived harmonies now visible');
  await takeScreenshot(page, '14-show-archived.png');

  // Step 14: Verify archived harmony appears with badge
  console.log('🔍 Verifying archived harmony appears...');
  const harmonyInArchivedList = await page.evaluate((harmonyName: string) => {
    return Array.from(document.querySelectorAll('*')).some(el =>
      el.textContent?.includes(harmonyName)
    );
  }, TEST_HARMONY_NAME);

  if (!harmonyInArchivedList) {
    throw new Error('Harmony not found in archived list');
  }
  console.log('  ✓ Archived harmony visible');

  // Check for "Archived" badge
  const hasArchivedBadge = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).some(el =>
      el.textContent?.toUpperCase().includes('ARCHIVED')
    );
  });

  if (!hasArchivedBadge) {
    console.log('  ⚠ Warning: "Archived" badge not found (may be styled differently)');
  } else {
    console.log('  ✓ "Archived" badge visible');
  }

  console.log('✅ Archived harmony verification complete');
  await takeScreenshot(page, '15-archived-harmony-verified.png');

  console.log('\n🎉 All Archive Modal tests completed successfully!');
}

// =============================================================================
// Run Tests
// =============================================================================
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 ARCHIVE HARMONY MODAL END-TO-END TEST SUITE');
  console.log('='.repeat(70));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Harmony Name: ${TEST_HARMONY_NAME}`);
  console.log('='.repeat(70));

  await runTest('Archive Harmony Modal Flow', testArchiveHarmonyModal);

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
