/**
 * Puppeteer Visual Test: Magical Post-Enrichment Experience
 *
 * This script tests the complete user flow from enrichment creation
 * through live monitoring to test results, taking screenshots at key moments
 * to assess whether the experience is truly magical and delightful.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots-magical-test');
const BASE_URL = 'http://localhost:3000';

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page: Page, name: string, fullPage = false) {
  const timestamp = Date.now();
  const filename = `${timestamp}-${name}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);

  await page.screenshot({
    path: filepath,
    fullPage,
  });

  console.log(`📸 Screenshot saved: ${filename}`);
  return filepath;
}

async function assessVisualElement(page: Page, selector: string, elementName: string): Promise<boolean> {
  try {
    const element = await page.$(selector);
    if (!element) {
      console.log(`❌ ${elementName} not found`);
      return false;
    }

    const isVisible = await element.isIntersectingViewport();
    if (isVisible) {
      console.log(`✅ ${elementName} is visible`);
    } else {
      console.log(`⚠️  ${elementName} exists but not visible`);
    }

    return isVisible;
  } catch (error) {
    console.log(`❌ Error checking ${elementName}:`, error);
    return false;
  }
}

async function runMagicalExperienceTest() {
  console.log('🚀 Starting Magical Experience Test\n');

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: false, // Keep visible so we can see the magic!
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
      slowMo: 100, // Slow down actions so we can see them
    });

    page = await browser.newPage();

    // Enable console logging from page
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        console.log(`[Browser ${type}]`, msg.text());
      }
    });

    console.log('📝 Test Plan:');
    console.log('1. Navigate to /enrich page');
    console.log('2. Configure test enrichment (5 records, Industry + Employees)');
    console.log('3. Click "Run enrichment"');
    console.log('4. Capture toast notification');
    console.log('5. Click toast link to navigate to detail page');
    console.log('6. Monitor live feed for 30 seconds');
    console.log('7. Capture test results panel');
    console.log('8. Assess magical quotient\n');

    // Step 1: Navigate to Enrich page
    console.log('Step 1: Navigate to /enrich page');
    await page.goto(`${BASE_URL}/enrich`, { waitUntil: 'networkidle2' });
    await sleep(2000);
    await takeScreenshot(page, '01-enrich-page-loaded', true);

    // Check if we need to sign in (Clerk auth)
    const signInButton = await page.$('button:has-text("Sign in")');
    if (signInButton) {
      console.log('⚠️  Not authenticated. Please sign in manually and re-run the test.');
      await sleep(30000); // Give time to sign in
    }

    // Step 2: Configure enrichment
    console.log('\nStep 2: Configure test enrichment');

    // Enable test mode
    const testModeCheckbox = await page.$('input[type="checkbox"]');
    if (testModeCheckbox) {
      await testModeCheckbox.click();
      console.log('✓ Test mode enabled');
      await sleep(500);
    }

    // Set record limit to 5
    const recordLimitInput = await page.$('input[type="number"]');
    if (recordLimitInput) {
      await recordLimitInput.click({ clickCount: 3 }); // Select all
      await recordLimitInput.type('5');
      console.log('✓ Record limit set to 5');
      await sleep(500);
    }

    // Select fields (Industry + Employee count)
    const industryCheckbox = await page.$('label:has-text("Industry") input[type="checkbox"]');
    if (industryCheckbox) {
      const isChecked = await page.evaluate(el => (el as HTMLInputElement).checked, industryCheckbox);
      if (!isChecked) {
        await industryCheckbox.click();
        console.log('✓ Industry field selected');
      }
    }

    const employeeCheckbox = await page.$('label:has-text("Employee") input[type="checkbox"]');
    if (employeeCheckbox) {
      const isChecked = await page.evaluate(el => (el as HTMLInputElement).checked, employeeCheckbox);
      if (!isChecked) {
        await employeeCheckbox.click();
        console.log('✓ Employee count field selected');
      }
    }

    await sleep(1000);
    await takeScreenshot(page, '02-enrichment-configured', true);

    // Step 3: Click Run Enrichment
    console.log('\nStep 3: Click "Run enrichment"');
    const runButton = await page.$('button:has-text("Run enrichment")');
    if (!runButton) {
      console.log('❌ Run enrichment button not found');
      return;
    }

    await runButton.click();
    console.log('✓ Run enrichment button clicked');
    await sleep(2000);

    // Step 4: Capture toast
    console.log('\nStep 4: Capture toast notification');
    await takeScreenshot(page, '03-toast-notification');

    // Check for toast elements
    const toastVisible = await assessVisualElement(page, '[class*="toast"]', 'Toast notification');
    const toastLink = await page.$('a:has-text("View details")');

    if (!toastLink) {
      console.log('❌ Toast link not found. Checking page URL...');
      // It might have redirected already
      const currentUrl = page.url();
      if (currentUrl.includes('/arrangements')) {
        console.log('✓ Already redirected to arrangements page');
      } else {
        console.log('❌ Not on arrangements page. Current URL:', currentUrl);
        return;
      }
    } else {
      console.log('✓ Toast link found');

      // Step 5: Click toast link
      console.log('\nStep 5: Click toast link to navigate to detail page');
      await toastLink.click();
      await sleep(2000);
    }

    // Wait for navigation to arrangement detail page
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {
      console.log('Navigation timeout, continuing...');
    });

    const detailPageUrl = page.url();
    console.log(`✓ Navigated to: ${detailPageUrl}`);
    await takeScreenshot(page, '04-detail-page-initial', true);

    // Step 6: Monitor live feed
    console.log('\nStep 6: Monitor live feed for 30 seconds');
    console.log('Assessing magical elements:');

    // Check for key magical elements
    await assessVisualElement(page, '[style*="pulse"]', 'Pulsing status dot');
    await assessVisualElement(page, 'div:has-text("Processing records")', 'Status banner');
    await assessVisualElement(page, 'div:has-text("Records processed")', 'Progress bar');
    await assessVisualElement(page, 'div:has-text("filled")', 'Field counters');
    await assessVisualElement(page, 'div:has-text("Record feed")', 'Live record feed');

    // Take screenshots during processing
    for (let i = 0; i < 6; i++) {
      await sleep(5000);
      console.log(`\n⏱️  ${(i + 1) * 5} seconds elapsed...`);
      await takeScreenshot(page, `05-live-feed-${i + 1}`, true);

      // Check if test complete panel appeared
      const testCompletePanel = await page.$('div:has-text("Test run complete")');
      if (testCompletePanel) {
        console.log('✅ Test complete panel appeared!');
        break;
      }
    }

    // Step 7: Capture test results
    console.log('\nStep 7: Capture test results panel');
    await sleep(2000);

    const testCompleteVisible = await assessVisualElement(page, 'div:has-text("Test run complete")', 'Test complete panel');

    if (testCompleteVisible) {
      // Scroll to test complete panel
      await page.evaluate(() => {
        const panel = document.querySelector('div:has-text("Test run complete")');
        if (panel) {
          panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });

      await sleep(1000);
      await takeScreenshot(page, '06-test-complete-panel', true);

      // Check for before/after table
      await assessVisualElement(page, 'table', 'Before/after table');
      await assessVisualElement(page, 'button:has-text("Run full enrichment")', 'Run full CTA button');
    }

    // Step 8: Magical Quotient Assessment
    console.log('\n\n📊 MAGICAL QUOTIENT ASSESSMENT');
    console.log('═'.repeat(60));

    const assessment = {
      immediacy: 0,
      transparency: 0,
      delight: 0,
      trust: 0,
      completion: 0,
    };

    // Immediacy: How quickly does feedback appear?
    if (toastVisible) {
      assessment.immediacy += 2;
      console.log('✓ Instant toast feedback (+2)');
    }

    // Transparency: Can user see what's happening?
    const hasLiveFeed = await page.$('div:has-text("Record feed")');
    if (hasLiveFeed) {
      assessment.transparency += 3;
      console.log('✓ Live record feed shows real-time progress (+3)');
    }

    const hasFieldCounters = await page.$('div:has-text("filled")');
    if (hasFieldCounters) {
      assessment.transparency += 2;
      console.log('✓ Field counters show granular progress (+2)');
    }

    // Delight: Does it spark joy?
    const hasPulsingDot = await page.$('[style*="pulse"]');
    if (hasPulsingDot) {
      assessment.delight += 1;
      console.log('✓ Pulsing animation adds life (+1)');
    }

    const hasColoredChips = await page.$('[style*="greenDim"], [style*="indigoDim"]');
    if (hasColoredChips) {
      assessment.delight += 2;
      console.log('✓ Colored chips make data scannable (+2)');
    }

    // Trust: Does it build confidence?
    if (testCompleteVisible) {
      assessment.trust += 3;
      console.log('✓ Test results panel shows proof of work (+3)');
    }

    const hasBeforeAfter = await page.$('table th:has-text("Before")');
    if (hasBeforeAfter) {
      assessment.trust += 2;
      console.log('✓ Before/after table builds trust (+2)');
    }

    // Completion: Does user know what to do next?
    const hasRunFullButton = await page.$('button:has-text("Run full enrichment")');
    if (hasRunFullButton) {
      assessment.completion += 3;
      console.log('✓ Clear next step with CTA button (+3)');
    }

    const totalScore = Object.values(assessment).reduce((sum, val) => sum + val, 0);
    const maxScore = 18;
    const magicalPercentage = Math.round((totalScore / maxScore) * 100);

    console.log('\n' + '─'.repeat(60));
    console.log(`Final Magical Quotient: ${magicalPercentage}%`);
    console.log(`(${totalScore}/${maxScore} points)`);
    console.log('─'.repeat(60));

    if (magicalPercentage >= 90) {
      console.log('🌟🌟🌟 EXCEPTIONAL - Exceeds competitive peers');
    } else if (magicalPercentage >= 75) {
      console.log('🌟🌟 EXCELLENT - On par with best-in-class');
    } else if (magicalPercentage >= 60) {
      console.log('🌟 GOOD - Solid experience, room for improvement');
    } else {
      console.log('⚠️  NEEDS WORK - Below competitive standard');
    }

    console.log('\n📸 All screenshots saved to:', SCREENSHOTS_DIR);

    // Keep browser open for manual inspection
    console.log('\n✋ Browser kept open for manual inspection.');
    console.log('Press Ctrl+C to close when done reviewing.');

    await sleep(300000); // Wait 5 minutes before auto-closing

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (page) {
      await takeScreenshot(page, 'error-state', true);
    }
  } finally {
    if (browser) {
      // Don't close automatically - let user inspect
      // await browser.close();
    }
  }
}

// Run the test
runMagicalExperienceTest().catch(console.error);
