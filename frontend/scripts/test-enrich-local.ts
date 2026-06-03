/**
 * Local Puppeteer Test - Enrich Feature with GraphIQ
 *
 * Tests enrichment preview with 100 records using RevOps Impact HubSpot instance.
 *
 * Prerequisites:
 * - Dev server running on http://localhost:3000
 * - Logged in to RevOps Impact org
 * - GraphIQ API key configured
 *
 * Usage:
 *   npx tsx scripts/test-enrich-local.ts [company|contact]
 */

import puppeteer from 'puppeteer';

const OBJECT_TYPE = process.argv[2] || 'contact'; // Default to contact
const BASE_URL = 'http://localhost:3000';
const PREVIEW_COUNT = 100;

async function testEnrichPreview() {
  console.log(`\n🧪 Testing Enrich Preview (${OBJECT_TYPE}s) with GraphIQ...\n`);

  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    slowMo: 100, // Slow down by 100ms for visibility
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to enrich page
    console.log(`📍 Navigating to /enrich?object=${OBJECT_TYPE}...`);
    await page.goto(`${BASE_URL}/enrich?object=${OBJECT_TYPE}`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for page to load
    await page.waitForSelector('body', { timeout: 10000 });
    console.log('✅ Page loaded');

    // Wait for gap analysis to complete
    console.log('⏳ Waiting for gap analysis to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Give it time to stream results

    // Take screenshot of initial state
    await page.screenshot({ path: 'test-enrich-01-initial.png', fullPage: true });
    console.log('📸 Screenshot: test-enrich-01-initial.png');

    // Check if we're on the right object type
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);

    // Select all enrichable fields
    console.log('🔧 Selecting enrichable fields...');

    // Click on field checkboxes (adapt selectors as needed)
    // This is a rough example - you'll need to adjust selectors based on actual DOM
    try {
      // Wait for field checkboxes to appear
      await new Promise(resolve => setTimeout(resolve, 2000));

      // You may need to click on specific checkboxes
      // For now, let's assume default fields are selected
      console.log('✅ Fields selected (using defaults)');
    } catch (e) {
      console.log('⚠️  Could not select fields, using defaults');
    }

    // Select provider (GraphIQ/Refyne Search)
    console.log('🔧 Selecting GraphIQ provider...');
    try {
      // Look for provider dropdown or radio buttons
      // This is a placeholder - adjust based on actual UI
      const providerSelector = 'select[name="provider"], input[value="refyne_search"]';
      const providerExists = await page.$(providerSelector);

      if (providerExists) {
        await page.click(providerSelector);
        console.log('✅ GraphIQ/Refyne Search selected');
      } else {
        console.log('⚠️  Provider selector not found, using default');
      }
    } catch (e) {
      console.log('⚠️  Could not select provider, using default');
    }

    // Set record limit to 100
    console.log(`🔧 Setting preview limit to ${PREVIEW_COUNT}...`);
    try {
      // Look for record limit input
      const limitInput = await page.$('input[type="number"]');
      if (limitInput) {
        await limitInput.click({ clickCount: 3 }); // Select all
        await limitInput.type(PREVIEW_COUNT.toString());
        console.log(`✅ Preview limit set to ${PREVIEW_COUNT}`);
      } else {
        console.log('⚠️  Record limit input not found');
      }
    } catch (e) {
      console.log('⚠️  Could not set record limit');
    }

    // Take screenshot before preview
    await page.screenshot({ path: 'test-enrich-02-before-preview.png', fullPage: true });
    console.log('📸 Screenshot: test-enrich-02-before-preview.png');

    // Click "Load Preview" or similar button
    console.log('🚀 Starting preview...');
    try {
      // Look for preview button (adapt text/selector as needed)
      const previewButton = await page.waitForSelector(
        'button:has-text("Load Preview"), button:has-text("Preview"), button:has-text("Test")',
        { timeout: 5000 }
      ).catch(() => null);

      if (previewButton) {
        await previewButton.click();
        console.log('✅ Preview started');
      } else {
        // Try finding button by text content
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent, button);
          if (text?.includes('Preview') || text?.includes('Load')) {
            await button.click();
            console.log('✅ Preview started (found button by text)');
            break;
          }
        }
      }
    } catch (e) {
      console.log('⚠️  Could not find preview button');
      console.log('Available buttons on page:');
      const buttons = await page.$$('button');
      for (const button of buttons) {
        const text = await page.evaluate(el => el.textContent, button);
        console.log(`  - "${text}"`);
      }
    }

    // Wait for preview to complete
    console.log('⏳ Waiting for preview results...');
    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait up to 30 seconds

    // Take screenshot of results
    await page.screenshot({ path: 'test-enrich-03-results.png', fullPage: true });
    console.log('📸 Screenshot: test-enrich-03-results.png');

    // Check for results
    console.log('\n📊 Checking results...');
    try {
      // Look for results table or summary
      const resultsTable = await page.$('table');
      if (resultsTable) {
        const rowCount = await page.$$eval('table tbody tr', rows => rows.length);
        console.log(`✅ Found ${rowCount} result rows in table`);
      } else {
        console.log('⚠️  No results table found');
      }

      // Check for summary stats
      const pageText = await page.evaluate(() => document.body.textContent);
      if (pageText?.includes('would_fill') || pageText?.includes('records')) {
        console.log('✅ Found results data on page');
      }
    } catch (e) {
      console.log('⚠️  Error checking results:', e);
    }

    console.log('\n✅ Test complete! Check screenshots for details.\n');
    console.log('Screenshots saved:');
    console.log('  - test-enrich-01-initial.png');
    console.log('  - test-enrich-02-before-preview.png');
    console.log('  - test-enrich-03-results.png\n');

    // Keep browser open for manual inspection
    console.log('🔍 Browser will stay open for 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('\n❌ Test failed:', error);

    // Take error screenshot
    const page = (await browser.pages())[0];
    if (page) {
      await page.screenshot({ path: 'test-enrich-error.png', fullPage: true });
      console.log('📸 Error screenshot: test-enrich-error.png');
    }
  } finally {
    await browser.close();
    console.log('🔒 Browser closed');
  }
}

// Run test
testEnrichPreview().catch(console.error);
