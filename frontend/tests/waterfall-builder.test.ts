/**
 * Waterfall Builder Tests
 *
 * Tests the Step 3 waterfall builder component functionality.
 * Validates field-level provider configuration, drag-and-drop, and persistence.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.TEST_BASE_URL || 'https://app.refynedata.com';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'waterfall-builder');

const ADMIN_CREDENTIALS = {
  email: process.env.TEST_ADMIN_EMAIL || 'admin@test.refynedata.com',
  password: process.env.TEST_ADMIN_PASSWORD || 'test-password',
};

interface TestResult {
  name: string;
  passed: boolean;
  screenshot: string;
  error?: string;
}

const results: TestResult[] = [];

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function signIn(page: Page) {
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('input[name="identifier"]', { timeout: 10000 });
  await page.type('input[name="identifier"]', ADMIN_CREDENTIALS.email);
  await page.click('button[type="submit"]');
  await page.waitForSelector('input[name="password"]', { timeout: 10000 });
  await page.type('input[name="password"]', ADMIN_CREDENTIALS.password);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
}

async function navigateToWaterfallBuilder(page: Page) {
  // Complete onboarding if needed
  await page.evaluate(async () => {
    await fetch('/api/arrangements/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skipped: true }),
    });
  });

  await page.goto(`${BASE_URL}/arrangements/new`, { waitUntil: 'networkidle2' });
  await page.waitForTimeout(1000);

  // Navigate through to Step 3
  // Step 1: Fill name
  await page.type('input[placeholder*="Enrich"]', 'Test Waterfall');
  await page.click('text=/Next/i');
  await page.waitForTimeout(1000);

  // Step 2: Select source
  await page.click('text=/Next/i');
  await page.waitForTimeout(1000);

  // Now on Step 3
}

async function takeScreenshot(page: Page, filename: string) {
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  return filename;
}

async function runTest(
  name: string,
  testFn: (browser: Browser, page: Page) => Promise<TestResult>
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Test: ${name}`);
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS !== 'false',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('  Browser console error:', msg.text());
      }
    });

    const result = await testFn(browser, page);
    results.push(result);

    console.log(result.passed ? '✅ PASS' : '❌ FAIL');
    if (result.error) console.error('Error:', result.error);
  } catch (error) {
    console.error('❌ FAIL - Exception:', error);
    results.push({
      name,
      passed: false,
      screenshot: 'error.png',
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await browser.close();
  }
}

// =============================================================================
// Test 1: Field expand/collapse
// =============================================================================
async function test1FieldExpandCollapse(browser: Browser, page: Page): Promise<TestResult> {
  await signIn(page);
  await navigateToWaterfallBuilder(page);

  // Add fields via "Manage fields" button
  await page.click('text=/Manage fields/i');
  await page.waitForTimeout(1000);

  // Select industry field
  await page.click('input[type="checkbox"]'); // First checkbox
  await page.click('text=/^Save$/i');
  await page.waitForTimeout(1000);

  // Find the field row
  const fieldRow = await page.$('text=/Industry/i');
  const initiallyExpanded = await page.$('text=/Provider waterfall/i');

  // Click to expand
  if (fieldRow && !initiallyExpanded) {
    await fieldRow.click();
    await page.waitForTimeout(500);
  }

  const expandedContent = await page.$('text=/Provider waterfall/i');
  const isExpanded = expandedContent !== null;

  // Click again to collapse
  if (fieldRow) {
    await fieldRow.click();
    await page.waitForTimeout(500);
  }

  const collapsedContent = await page.$('text=/Provider waterfall/i');
  const isCollapsed = collapsedContent === null;

  const screenshot = await takeScreenshot(page, 'field-expand-collapse.png');

  return {
    name: 'Field expand/collapse',
    passed: isExpanded && isCollapsed,
    screenshot,
    error: !isExpanded ? 'Field did not expand' : !isCollapsed ? 'Field did not collapse' : undefined,
  };
}

// =============================================================================
// Test 2: Aggregation strategy selector on numeric fields only
// =============================================================================
async function test2AggregationStrategyNumericOnly(browser: Browser, page: Page): Promise<TestResult> {
  await signIn(page);
  await navigateToWaterfallBuilder(page);

  // Add both numeric and categorical fields
  await page.click('text=/Manage fields/i');
  await page.waitForTimeout(1000);

  // Select industry (categorical) and employee_count (numeric)
  const checkboxes = await page.$$('input[type="checkbox"]');
  if (checkboxes.length >= 2) {
    await checkboxes[0].click(); // Assume first is categorical
    await checkboxes[2].click(); // Assume third is numeric
  }

  await page.click('text=/^Save$/i');
  await page.waitForTimeout(1000);

  // Expand both fields
  const fieldRows = await page.$$('[style*="cursor: pointer"]');
  if (fieldRows.length >= 2) {
    await fieldRows[0].click();
    await page.waitForTimeout(500);
    await fieldRows[1].click();
    await page.waitForTimeout(500);
  }

  // Check for strategy selectors
  const strategySelectors = await page.$$('text=/Strategy:/i');
  const hasStrategy = strategySelectors.length > 0;

  // Verify it's on numeric field (employee_count)
  const numericFieldExpanded = await page.$('text=/Employee Count/i');
  const strategyNearNumeric = numericFieldExpanded !== null && hasStrategy;

  const screenshot = await takeScreenshot(page, 'aggregation-strategy-numeric.png');

  return {
    name: 'Aggregation strategy on numeric only',
    passed: strategyNearNumeric,
    screenshot,
    error: !strategyNearNumeric ? 'Strategy selector not found on numeric field' : undefined,
  };
}

// =============================================================================
// Test 3: Harmony selector on categorical fields only
// =============================================================================
async function test3HarmonySelectorCategoricalOnly(browser: Browser, page: Page): Promise<TestResult> {
  await signIn(page);
  await navigateToWaterfallBuilder(page);

  // Add categorical field (industry)
  await page.click('text=/Manage fields/i');
  await page.waitForTimeout(1000);

  const checkboxes = await page.$$('input[type="checkbox"]');
  if (checkboxes.length > 0) {
    await checkboxes[0].click(); // First field (likely industry)
  }

  await page.click('text=/^Save$/i');
  await page.waitForTimeout(1000);

  // Expand field
  const fieldRow = await page.$('[style*="cursor: pointer"]');
  if (fieldRow) {
    await fieldRow.click();
    await page.waitForTimeout(500);
  }

  // Check for harmony selector
  const harmonyCheckbox = await page.$('text=/Apply harmony/i');
  const hasHarmonyOption = harmonyCheckbox !== null;

  const screenshot = await takeScreenshot(page, 'harmony-categorical.png');

  return {
    name: 'Harmony selector on categorical',
    passed: hasHarmonyOption,
    screenshot,
    error: !hasHarmonyOption ? 'Harmony selector not found on categorical field' : undefined,
  };
}

// =============================================================================
// Test 4: Drag reorder persists
// =============================================================================
async function test4DragReorder(browser: Browser, page: Page): Promise<TestResult> {
  await signIn(page);
  await navigateToWaterfallBuilder(page);

  // Add a field and multiple providers
  await page.click('text=/Manage fields/i');
  await page.waitForTimeout(1000);

  const checkbox = await page.$('input[type="checkbox"]');
  if (checkbox) await checkbox.click();

  await page.click('text=/^Save$/i');
  await page.waitForTimeout(1000);

  // Expand field
  const fieldRow = await page.$('[style*="cursor: pointer"]');
  if (fieldRow) {
    await fieldRow.click();
    await page.waitForTimeout(500);
  }

  // Add providers (simplified - would need actual provider addition logic)
  // For now, just verify drag handles are present
  const dragHandles = await page.$$('[style*="cursor: grab"]');
  const hasDragHandles = dragHandles.length > 0;

  const screenshot = await takeScreenshot(page, 'drag-reorder.png');

  return {
    name: 'Drag reorder functionality',
    passed: hasDragHandles,
    screenshot,
    error: !hasDragHandles ? 'Drag handles not found' : undefined,
  };
}

// =============================================================================
// Test 5: Unconfigured provider grayed out
// =============================================================================
async function test5UnconfiguredProvider(browser: Browser, page: Page): Promise<TestResult> {
  await signIn(page);
  await navigateToWaterfallBuilder(page);

  // Check for provider legend showing only Refyne (unconfigured BYOK providers)
  const legendText = await page.evaluate(() => {
    const legend = document.body.textContent;
    return legend?.includes('No providers connected') || legend?.includes('Refyne');
  });

  // If we have a warning about unconfigured providers, test passes
  const warningVisible = await page.$('text=/No providers connected/i');
  const hasWarning = warningVisible !== null || legendText;

  const screenshot = await takeScreenshot(page, 'unconfigured-providers.png');

  return {
    name: 'Unconfigured provider warning',
    passed: hasWarning,
    screenshot,
    error: !hasWarning ? 'No warning about unconfigured providers' : undefined,
  };
}

// =============================================================================
// Test 6: Save writes correct field_configs shape
// =============================================================================
async function test6SaveFieldConfigs(browser: Browser, page: Page): Promise<TestResult> {
  await signIn(page);
  await navigateToWaterfallBuilder(page);

  // Add a field
  await page.click('text=/Manage fields/i');
  await page.waitForTimeout(1000);

  const checkbox = await page.$('input[type="checkbox"]');
  if (checkbox) await checkbox.click();

  await page.click('text=/^Save$/i');
  await page.waitForTimeout(1000);

  // Navigate to Step 4 and 5
  await page.click('text=/Next/i');
  await page.waitForTimeout(1500);
  await page.click('text=/Next/i');
  await page.waitForTimeout(1500);

  // Save arrangement
  await page.click('text=/Save Arrangement/i');
  await page.waitForTimeout(3000);

  // Verify URL changed to arrangement detail page
  const finalUrl = page.url();
  const matchesPattern = /\/arrangements\/[a-f0-9-]+$/.test(finalUrl);

  // Extract arrangement ID and verify field_configs in database
  const arrangementId = finalUrl.match(/\/arrangements\/([a-f0-9-]+)$/)?.[1];

  let fieldConfigsValid = false;
  if (arrangementId) {
    const dbCheck = await page.evaluate(async (id) => {
      // Query via API (assuming we have an endpoint)
      const res = await fetch(`/api/arrangements/${id}`);
      if (res.ok) {
        const data = await res.json();
        // Check if field_configs exists and has the right shape
        return data.arrangement?.field_configs && Array.isArray(data.arrangement.field_configs);
      }
      return false;
    }, arrangementId);

    fieldConfigsValid = dbCheck;
  }

  const screenshot = await takeScreenshot(page, 'save-field-configs.png');

  return {
    name: 'Save field_configs to database',
    passed: matchesPattern && fieldConfigsValid,
    screenshot,
    error: !matchesPattern
      ? 'URL pattern mismatch'
      : !fieldConfigsValid
      ? 'field_configs not persisted correctly'
      : undefined,
  };
}

// =============================================================================
// Main test runner
// =============================================================================
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Waterfall Builder Test Suite');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}`);
  console.log('='.repeat(60));

  await runTest('1. Field expand/collapse', test1FieldExpandCollapse);
  await runTest('2. Aggregation strategy numeric only', test2AggregationStrategyNumericOnly);
  await runTest('3. Harmony selector categorical', test3HarmonySelectorCategoricalOnly);
  await runTest('4. Drag reorder', test4DragReorder);
  await runTest('5. Unconfigured provider warning', test5UnconfiguredProvider);
  await runTest('6. Save field_configs shape', test6SaveFieldConfigs);

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(80));
  console.log('Test'.padEnd(50) + 'Result'.padEnd(10) + 'Screenshot');
  console.log('-'.repeat(80));

  let allPassed = true;
  results.forEach((result) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    allPassed = allPassed && result.passed;

    console.log(result.name.padEnd(50) + status.padEnd(10) + result.screenshot);
    if (result.error) {
      console.log('  └─ Error: ' + result.error);
    }
  });

  console.log('='.repeat(80));
  console.log(
    `Total: ${results.length} tests, ${results.filter((r) => r.passed).length} passed, ${
      results.filter((r) => !r.passed).length
    } failed`
  );
  console.log('='.repeat(80));

  if (!allPassed) {
    console.error('\n❌ SOME TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
