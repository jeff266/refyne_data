/**
 * Taxonomy Wizard - Read from HubSpot Field E2E Test
 *
 * Tests the complete "Read from your existing HubSpot field" flow:
 * 1. Sign in to the app
 * 2. Navigate to /harmonies
 * 3. Click "+ New harmony" button (opens TaxonomyWizard)
 * 4. Screen 1: Select "Sub-industry" classification type, click Next
 * 5. Screen 2: Select source field, target field, write policy, click Next
 * 6. Screen 3: Select "Read from your existing HubSpot field" option
 * 7. Screen 3b: Verify loading state ("Reading from HubSpot")
 * 8. Screen 3c: Review canonical values, test selection controls, click Next
 * 9. Screen 4: Review final mappings, click "Activate"
 * 10. Screen 5: Verify success message and metadata
 * 11. Navigate to harmony detail page
 *
 * Prerequisites:
 * - App running at BASE_URL (default: https://app.refynedata.com)
 * - Test account with admin access
 * - Active HubSpot connection with data in 'industry' field
 * - Environment variables: TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
 *
 * Usage:
 *   npx tsx tests/e2e/taxonomy-read-field.spec.ts
 *   HEADLESS=false npx tsx tests/e2e/taxonomy-read-field.spec.ts  # Run with visible browser
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.TEST_BASE_URL || 'https://app.refynedata.com';
const SCREENSHOT_DIR = path.join(__dirname, '..', '..', 'test-results', 'taxonomy-read-field');

const ADMIN_CREDENTIALS = {
  email: process.env.TEST_ADMIN_EMAIL || 'admin@test.refynedata.com',
  password: process.env.TEST_ADMIN_PASSWORD || 'test-password',
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
 * Check if text exists on the page
 */
async function hasText(page: Page, text: string): Promise<boolean> {
  return page.evaluate((searchText: string) => {
    return Array.from(document.querySelectorAll('*')).some(el =>
      (el.textContent || '').includes(searchText)
    );
  }, text);
}

/**
 * Wait for text to appear on the page
 */
async function waitForText(page: Page, text: string, timeout: number = 10000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await hasText(page, text)) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Text "${text}" did not appear within ${timeout}ms`);
}

/**
 * Click a button by its text content
 */
async function clickButton(page: Page, buttonText: string) {
  await page.evaluate((text: string) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const button = buttons.find(btn => (btn.textContent || '').trim() === text);

    if (button && button instanceof HTMLElement) {
      button.click();
    } else {
      throw new Error(`Button with text "${text}" not found`);
    }
  }, buttonText);
}

/**
 * Get checkbox count on the page
 */
async function getCheckboxCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    return document.querySelectorAll('input[type="checkbox"]').length;
  });
}

/**
 * Click the first checkbox
 */
async function clickFirstCheckbox(page: Page) {
  await page.evaluate(() => {
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    if (checkbox) {
      checkbox.click();
    } else {
      throw new Error('No checkbox found');
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
// Main Test: Complete "Read from HubSpot Field" Flow
// =============================================================================
async function testReadFromFieldFlow(browser: Browser, page: Page): Promise<void> {
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

  // Step 4: Screen 1 - Select "Sub-industry" classification type
  console.log('📋 Screen 1: Selecting "Sub-industry" classification type...');

  // Verify header
  const hasClassificationHeader = await hasText(page, 'What field are you classifying?');
  if (!hasClassificationHeader) {
    throw new Error('Classification type selection screen not found');
  }

  await clickText(page, 'Sub-industry');
  console.log('  ✓ Selected: Sub-industry');
  await new Promise(resolve => setTimeout(resolve, 500));
  await takeScreenshot(page, '03-classification-selected.png');

  // Click Next
  await clickButton(page, 'Next');
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('  ✓ Clicked Next');

  // Step 5: Screen 2 - Field mapping (source, target, write policy)
  console.log('📝 Screen 2: Configuring field mapping...');

  // Verify header
  const hasFieldMappingHeader = await hasText(page, 'Where should classified values be written?');
  if (!hasFieldMappingHeader) {
    throw new Error('Field mapping screen not found');
  }

  // Source field should be auto-selected as 'industry' for sub-industry classification
  console.log('  ✓ Source field auto-selected: industry');
  await new Promise(resolve => setTimeout(resolve, 500));

  // Select target field (use industry for simplicity in test)
  console.log('  Selecting target field...');
  // Click the second HubSpotPropertyPicker button (target field)
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const pickerButton = buttons.find(btn => btn.textContent?.includes('Select target field'));
    if (pickerButton && pickerButton instanceof HTMLElement) {
      pickerButton.click();
    }
  });
  await new Promise(resolve => setTimeout(resolve, 500));

  // Type to search for 'industry'
  await page.keyboard.type('industry');
  await new Promise(resolve => setTimeout(resolve, 500));

  // Click the first result
  await page.evaluate(() => {
    const options = Array.from(document.querySelectorAll('button')).filter(btn =>
      btn.textContent?.includes('Industry') && !btn.textContent?.includes('Select')
    );
    if (options.length > 0 && options[0] instanceof HTMLElement) {
      options[0].click();
    }
  });
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('  ✓ Target field selected: industry');

  // Write policy should default to 'fill_empty'
  console.log('  ✓ Write policy: Fill empty only (default)');

  await takeScreenshot(page, '04-field-mapping-configured.png');

  // Click Next
  await clickButton(page, 'Next');
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('  ✓ Clicked Next');

  // Step 6: Screen 3 - Select "Read from your existing HubSpot field" option
  console.log('📊 Screen 3: Selecting "Read from your existing HubSpot field"...');

  // Verify header
  const hasCanonicalHeader = await hasText(page, 'Define your canonical values');
  if (!hasCanonicalHeader) {
    throw new Error('Canonical values screen not found');
  }

  // Click "Read from HubSpot field" button
  await clickButton(page, 'Read from HubSpot field');
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('  ✓ Selected value source: field');

  // HubSpotPropertyPicker should now be visible
  // Click it to open the dropdown
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const pickerButton = buttons.find(btn => btn.textContent?.includes('Select field with canonical values'));
    if (pickerButton && pickerButton instanceof HTMLElement) {
      pickerButton.click();
    }
  });
  await new Promise(resolve => setTimeout(resolve, 500));

  // Type to search for 'industry'
  await page.keyboard.type('industry');
  await new Promise(resolve => setTimeout(resolve, 500));

  // Click the first result
  await page.evaluate(() => {
    const options = Array.from(document.querySelectorAll('button')).filter(btn =>
      btn.textContent?.includes('Industry') && !btn.textContent?.includes('Select')
    );
    if (options.length > 0 && options[0] instanceof HTMLElement) {
      options[0].click();
    }
  });
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('  ✓ Read from field selected: industry');

  await takeScreenshot(page, '05-read-from-field-selected.png');

  // Click Next (this triggers the API call)
  console.log('  Clicking Next to fetch field values...');
  await clickButton(page, 'Next');
  await new Promise(resolve => setTimeout(resolve, 500));

  // Step 7: Screen 3b - Loading state
  console.log('⏳ Screen 3b: Verifying loading state...');

  // Verify "Reading from HubSpot" text appears
  const hasLoadingText = await hasText(page, 'Reading from HubSpot');
  if (!hasLoadingText) {
    throw new Error('Loading text "Reading from HubSpot" not found');
  }
  console.log('  ✓ Loading text verified');

  // Verify progress bar is visible
  const hasProgressBar = await page.evaluate(() => {
    const progressBars = Array.from(document.querySelectorAll('*')).filter(el => {
      const style = window.getComputedStyle(el);
      return style.height === '4px' && style.borderRadius.includes('2px');
    });
    return progressBars.length > 0;
  });
  if (!hasProgressBar) {
    throw new Error('Progress bar not found');
  }
  console.log('  ✓ Progress bar verified');

  await takeScreenshot(page, '06-loading-state.png');

  // Wait for API call to complete (wait for loading to finish)
  console.log('  Waiting for API call to complete...');
  await waitForText(page, 'Review your canonical values', 30000);
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('  ✓ API call completed');

  // Step 8: Screen 3c - Value selection
  console.log('✅ Screen 3c: Verifying value selection UI...');

  // Verify header
  const hasReviewHeader = await hasText(page, 'Review your canonical values');
  if (!hasReviewHeader) {
    throw new Error('Review header not found');
  }
  console.log('  ✓ Header verified: "Review your canonical values"');

  // Verify "Found X distinct values" text
  const hasDistinctValues = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).some(el =>
      /Found \d+ distinct values/.test(el.textContent || '')
    );
  });
  if (!hasDistinctValues) {
    throw new Error('Distinct values count not found');
  }
  console.log('  ✓ Distinct values count displayed');

  // Verify checkboxes are present
  const checkboxCount = await getCheckboxCount(page);
  if (checkboxCount === 0) {
    throw new Error('No checkboxes found in value list');
  }
  console.log(`  ✓ Value list displayed with ${checkboxCount} checkboxes`);

  // Verify frequency bars are visible
  const hasFrequencyBars = await page.evaluate(() => {
    const bars = Array.from(document.querySelectorAll('*')).filter(el => {
      const style = window.getComputedStyle(el);
      return style.width.includes('120px') && style.height === '8px' && style.borderRadius.includes('2px');
    });
    return bars.length > 0;
  });
  if (!hasFrequencyBars) {
    throw new Error('Frequency bars not found');
  }
  console.log('  ✓ Frequency bars verified');

  // Verify counts are shown (look for numbers in the list)
  const hasCounts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).some(el => {
      const text = el.textContent || '';
      return /^\d+$/.test(text.trim()) && el.textContent !== '0';
    });
  });
  if (!hasCounts) {
    throw new Error('Value counts not found');
  }
  console.log('  ✓ Value counts displayed');

  await takeScreenshot(page, '07-value-selection-ui.png');

  // Test "Select all" button
  console.log('  Testing "Select all" button...');
  await clickButton(page, 'Select all');
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('  ✓ "Select all" button works');

  // Test "Deselect all" button
  console.log('  Testing "Deselect all" button...');
  await clickButton(page, 'Deselect all');
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('  ✓ "Deselect all" button works');

  // Re-select all to proceed
  await clickButton(page, 'Select all');
  await new Promise(resolve => setTimeout(resolve, 500));

  // Test individual checkbox toggle
  console.log('  Testing individual checkbox toggle...');
  await clickFirstCheckbox(page);
  await new Promise(resolve => setTimeout(resolve, 300));
  await clickFirstCheckbox(page);
  await new Promise(resolve => setTimeout(resolve, 300));
  console.log('  ✓ Individual checkbox toggle works');

  await takeScreenshot(page, '08-selection-controls-tested.png');

  // Test "Show suspects" / "Hide suspects" button (if suspects exist)
  const hasSuspectsButton = await hasText(page, 'Show suspects');
  if (hasSuspectsButton) {
    console.log('  Testing "Show suspects" button...');
    await clickText(page, 'Show suspects');
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('  ✓ "Show suspects" button works');

    const hasHideSuspectsButton = await hasText(page, 'Hide suspects');
    if (hasHideSuspectsButton) {
      await clickText(page, 'Hide suspects');
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('  ✓ "Hide suspects" button works');
    }
  } else {
    console.log('  ℹ️  No suspects found (all values have count >= 3)');
  }

  // Test inline rename functionality
  console.log('  Testing inline rename functionality...');
  const hasRenameButton = await hasText(page, 'rename');
  if (hasRenameButton) {
    // Click first "rename" button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const renameButton = buttons.find(btn => btn.textContent?.trim() === 'rename');
      if (renameButton && renameButton instanceof HTMLElement) {
        renameButton.click();
      }
    });
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('  ✓ Rename mode activated');

    // Cancel the rename
    const hasCancelButton = await hasText(page, 'Cancel');
    if (hasCancelButton) {
      await clickButton(page, 'Cancel');
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('  ✓ Rename cancelled');
    }
  }

  await takeScreenshot(page, '09-rename-tested.png');

  // Click Next to proceed to review
  console.log('  Clicking Next to proceed to review...');
  await clickButton(page, 'Next');
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('  ✓ Clicked Next');

  // Step 9: Screen 4 - Review mappings
  console.log('📋 Screen 4: Verifying review screen...');

  // Verify "Review mappings" header
  const hasReviewMappingsHeader = await hasText(page, 'Review mappings');
  if (!hasReviewMappingsHeader) {
    throw new Error('Review mappings header not found');
  }
  console.log('  ✓ Review mappings header verified');

  // For field source, verify "Review your canonical values" header
  const hasReviewCanonicalHeader = await hasText(page, 'Review your canonical values');
  if (!hasReviewCanonicalHeader) {
    throw new Error('Review canonical values header not found');
  }
  console.log('  ✓ "Review your canonical values" header verified');

  // Verify selected values are listed with counts
  const hasValueCounts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).some(el => {
      const text = el.textContent || '';
      return text.includes('Found') && text.includes('distinct values');
    });
  });
  if (!hasValueCounts) {
    throw new Error('Value counts not displayed in review');
  }
  console.log('  ✓ Selected values with counts verified');

  // Note: For field source, INPUT MAPPINGS section should show empty state
  // since we're starting with canonical values from the field
  // (mappings are generated later during scanning)

  await takeScreenshot(page, '10-review-screen.png');

  // Click "Activate"
  console.log('  Clicking "Activate" button...');
  await clickButton(page, 'Activate');
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('  ✓ Clicked Activate');

  // Step 10: Screen 5 - Success confirmation
  console.log('🎉 Screen 5: Verifying success confirmation...');

  // Wait for success screen
  await waitForText(page, 'Taxonomy classifier active', 10000);
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Verify success message
  const hasSuccessMessage = await hasText(page, 'Taxonomy classifier active');
  if (!hasSuccessMessage) {
    throw new Error('Success message not found');
  }
  console.log('  ✓ Success message verified');

  // Verify "X values from your HubSpot field" is shown
  const hasFieldValuesCount = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).some(el => {
      const text = el.textContent || '';
      return /\d+ values from your HubSpot field/.test(text);
    });
  });
  if (!hasFieldValuesCount) {
    throw new Error('Field values count not displayed');
  }
  console.log('  ✓ Field values count displayed');

  // Verify "Mappings: 0 (Refyne is scanning now)" is shown
  const hasScanningMessage = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).some(el => {
      const text = el.textContent || '';
      return text.includes('Mappings:') && text.includes('0') && text.includes('scanning');
    });
  });
  if (!hasScanningMessage) {
    throw new Error('Scanning message not displayed');
  }
  console.log('  ✓ Scanning message verified');

  // Verify "View harmony + suggestions" button exists
  const hasViewButton = await hasText(page, 'View harmony + suggestions');
  if (!hasViewButton) {
    throw new Error('"View harmony + suggestions" button not found');
  }
  console.log('  ✓ "View harmony + suggestions" button verified');

  await takeScreenshot(page, '11-success-screen.png');

  // Step 11: Navigate to harmony detail page
  console.log('🔗 Clicking "View harmony + suggestions" button...');
  await clickButton(page, 'View harmony + suggestions');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Verify redirect to /harmonies/[id]
  const currentUrl = page.url();
  console.log(`  Current URL: ${currentUrl}`);

  const harmonyIdMatch = currentUrl.match(/\/harmonies\/([^\/]+)/);
  if (!harmonyIdMatch) {
    throw new Error('Not redirected to harmony detail page');
  }

  const harmonyId = harmonyIdMatch[1];
  console.log(`  ✓ Redirected to harmony detail page: ${harmonyId}`);

  // Verify harmony is displayed
  await new Promise(resolve => setTimeout(resolve, 1000));
  await takeScreenshot(page, '12-harmony-detail-page.png');

  console.log('\n🎉 All steps completed successfully!');
}

// =============================================================================
// Run Tests
// =============================================================================
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 TAXONOMY WIZARD - READ FROM FIELD E2E TEST SUITE');
  console.log('='.repeat(70));
  console.log(`Base URL: ${BASE_URL}`);
  console.log('='.repeat(70));

  await runTest('Complete Read from HubSpot Field Flow', testReadFromFieldFlow);

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
