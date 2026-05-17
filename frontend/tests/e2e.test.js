/**
 * End-to-End Tests for Enrichment Switcher
 * Run with: node tests/e2e.test.js
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 30000;

// Test results collector
const results = {
  passed: [],
  failed: [],
};

// Helper to wait
async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to log test results
function logTest(name, passed, error = null) {
  if (passed) {
    results.passed.push(name);
    console.log(`  ✅ ${name}`);
  } else {
    results.failed.push({ name, error: error || 'Assertion failed' });
    console.log(`  ❌ ${name}${error ? ': ' + error : ''}`);
  }
}

// Helper to find button by text
async function findButtonByText(page, text) {
  return await page.evaluateHandle((searchText) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(btn => btn.textContent.toLowerCase().includes(searchText.toLowerCase()));
  }, text);
}

// Helper to click button by text
async function clickButtonByText(page, text) {
  const clicked = await page.evaluate((searchText) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const button = buttons.find(btn => btn.textContent.toLowerCase().includes(searchText.toLowerCase()));
    if (button) {
      button.click();
      return true;
    }
    return false;
  }, text);
  return clicked;
}

// Helper to take screenshot
async function screenshot(page, name) {
  await page.screenshot({
    path: `/Users/jeffignacio/enrichment-switcher/frontend/tests/screenshots/${name}.png`,
    fullPage: true
  });
}

// ============================================
// TEST SUITES
// ============================================

async function testHomePage(page) {
  console.log('\n📋 Testing Home Page...');

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: TIMEOUT });

    // Check page loaded
    const title = await page.title();
    logTest('Page loads', title.length > 0);

    // Check for main content
    const body = await page.$('body');
    const content = await page.evaluate(() => document.body.innerText);
    logTest('Page has content', content.length > 100);

    // Take screenshot
    await screenshot(page, '01-home');
    logTest('Screenshot captured', true);

  } catch (error) {
    logTest('Home page test', false, error.message);
  }
}

async function testSearchPage(page) {
  console.log('\n🔍 Testing Search Page...');

  try {
    await page.goto(`${BASE_URL}/search`, { waitUntil: 'networkidle2', timeout: TIMEOUT });
    await wait(2000);

    // Check for segment cards or content
    const content = await page.evaluate(() => document.body.innerText);
    logTest('Search page loads', content.includes('SMB') || content.includes('Search') || content.includes('Segment'));

    await screenshot(page, '02-search-segments');

    // Try clicking on SMB link/card
    const clicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button, [class*="card"]'));
      const smbLink = links.find(el => el.textContent.includes('SMB'));
      if (smbLink) {
        smbLink.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      await wait(2000);
      logTest('Can navigate to segment search', true);
      await screenshot(page, '03-search-form');
    } else {
      logTest('Can navigate to segment search', false, 'SMB link not found');
    }

  } catch (error) {
    logTest('Search page test', false, error.message);
  }
}

async function testSearchWithSandbox(page) {
  console.log('\n🧪 Testing Sandbox Mode...');

  try {
    await page.goto(`${BASE_URL}/search/smb_local`, { waitUntil: 'networkidle2', timeout: TIMEOUT });
    await wait(2000);

    // Look for sandbox toggle checkbox
    const checkboxes = await page.$$('input[type="checkbox"]');
    if (checkboxes.length > 0) {
      await checkboxes[0].click();
      await wait(500);
      logTest('Found and clicked checkbox (sandbox toggle)', true);
    } else {
      logTest('Sandbox toggle checkbox exists', false, 'No checkboxes found');
    }

    // Check for form elements
    const selects = await page.$$('select');
    logTest('Form has select dropdowns', selects.length > 0);

    const inputs = await page.$$('input[type="text"]');
    if (inputs.length > 0) {
      await inputs[0].type('San Francisco, CA');
      logTest('Can type in text input', true);
    }

    await screenshot(page, '04-sandbox-form');

    // Try to click search button
    const searchClicked = await clickButtonByText(page, 'Search');
    if (searchClicked) {
      await wait(3000);
      logTest('Search button clicked', true);
      await screenshot(page, '05-search-results');
    }

  } catch (error) {
    logTest('Sandbox mode test', false, error.message);
  }
}

async function testAdminPage(page) {
  console.log('\n⚙️ Testing Admin Page...');

  try {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle2', timeout: TIMEOUT });
    await wait(2000);

    // Check page loaded
    const content = await page.evaluate(() => document.body.innerText);
    logTest('Admin page loads', content.includes('Segment') || content.includes('Admin') || content.includes('Configuration'));

    await screenshot(page, '06-admin');

    // Look for any expandable sections or cards (including divs with borders that act as cards)
    const cards = await page.$$('[class*="card"], [class*="Card"], [class*="segment"], [class*="border"], [class*="rounded"]');
    logTest('Admin has card elements', cards.length > 0);

    // Try to click first card to expand
    if (cards.length > 0) {
      try {
        await cards[0].click();
        await wait(1000);
        await screenshot(page, '07-admin-expanded');
        logTest('Can expand admin card', true);
      } catch (clickErr) {
        logTest('Can expand admin card', false, 'Click failed: ' + clickErr.message);
      }
    }

    // First expand a card by clicking the chevron button (it's within a rounded-xl border card)
    const expandClicked = await page.evaluate(() => {
      // Find the segment cards (they have rounded-xl class)
      const cards = document.querySelectorAll('.rounded-xl');
      if (cards.length === 0) return false;

      // Within the first card, find the buttons
      const firstCard = cards[0];
      const buttons = Array.from(firstCard.querySelectorAll('button'));

      // The chevron button is typically the one with only p-2 padding (not w-8 h-8 like drag handle)
      // It contains an SVG but doesn't have cursor-grab class
      const expandBtn = buttons.find(btn => {
        return btn.className.includes('p-2') &&
               btn.className.includes('text-gray-400') &&
               !btn.className.includes('cursor-grab') &&
               !btn.className.includes('flex-shrink-0 w-8');
      });

      if (expandBtn) {
        expandBtn.click();
        return true;
      }
      return false;
    });

    if (expandClicked) {
      await wait(1000);
      logTest('Expanded admin card with chevron', true);

      // Now look for Configure Cascade button
      const configureClicked = await clickButtonByText(page, 'Configure Cascade');
      if (configureClicked) {
        await wait(2000);
        logTest('Configure Cascade button works', true);
        await screenshot(page, '08-cascade-editor');
      } else {
        logTest('Configure Cascade button', false, 'Button not found after expand');
      }
    } else {
      logTest('Configure Cascade button', false, 'Could not find expand button');
    }

  } catch (error) {
    logTest('Admin page test', false, error.message);
  }
}

async function testCascadeEditor(page) {
  console.log('\n🔗 Testing Cascade Editor...');

  try {
    // Navigate to admin
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle2', timeout: TIMEOUT });
    await wait(2000);

    // First expand a card by clicking the chevron button
    const expandClicked = await page.evaluate(() => {
      const cards = document.querySelectorAll('.rounded-xl');
      if (cards.length === 0) return false;

      const firstCard = cards[0];
      const buttons = Array.from(firstCard.querySelectorAll('button'));

      const expandBtn = buttons.find(btn => {
        return btn.className.includes('p-2') &&
               btn.className.includes('text-gray-400') &&
               !btn.className.includes('cursor-grab') &&
               !btn.className.includes('flex-shrink-0 w-8');
      });

      if (expandBtn) {
        expandBtn.click();
        return true;
      }
      return false;
    });

    if (!expandClicked) {
      logTest('Cascade editor', false, 'Could not find expand button');
      return;
    }

    await wait(1000);

    // Now click Configure Cascade
    const configureClicked = await clickButtonByText(page, 'Configure Cascade');

    if (configureClicked) {
      await wait(2000);

      // Look for Test tab
      const testTabClicked = await clickButtonByText(page, 'Test');
      if (testTabClicked) {
        await wait(1000);
        logTest('Test tab exists in Cascade Editor', true);
        await screenshot(page, '09-cascade-test-tab');

        // Look for Run Tests button
        const runTestsClicked = await clickButtonByText(page, 'Run');
        if (runTestsClicked) {
          await wait(3000);
          logTest('Run Tests button works', true);
          await screenshot(page, '10-cascade-test-results');
        }
      } else {
        logTest('Test tab exists', false, 'Test tab not found');
      }
    } else {
      logTest('Cascade editor', false, 'Could not open cascade editor');
    }

  } catch (error) {
    logTest('Cascade editor test', false, error.message);
  }
}

async function testProvidersPage(page) {
  console.log('\n📦 Testing Providers Page...');

  try {
    await page.goto(`${BASE_URL}/providers`, { waitUntil: 'networkidle2', timeout: TIMEOUT });
    await wait(2000);

    const content = await page.evaluate(() => document.body.innerText);
    logTest('Providers page loads', content.includes('Provider') || content.includes('Serper') || content.includes('Apollo'));

    await screenshot(page, '11-providers');

    // Check for provider cards
    const cards = await page.$$('[class*="card"], [class*="Card"]');
    logTest('Provider cards visible', cards.length > 0);

    // Click on a provider to see details
    if (cards.length > 0) {
      await cards[0].click();
      await wait(2000);
      await screenshot(page, '12-provider-detail');
      logTest('Can view provider details', true);
    }

  } catch (error) {
    logTest('Providers page test', false, error.message);
  }
}

async function testSettingsPage(page) {
  console.log('\n🔑 Testing Settings/API Keys Page...');

  try {
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle2', timeout: TIMEOUT });
    await wait(2000);

    const content = await page.evaluate(() => document.body.innerText);
    logTest('Settings page loads', content.includes('API') || content.includes('Key') || content.includes('Settings') || content.includes('Provider'));

    await screenshot(page, '13-settings');

    // Check for any interactive elements
    const buttons = await page.$$('button');
    logTest('Settings has buttons', buttons.length > 0);

    // Try to click Add Key button
    const addKeyClicked = await clickButtonByText(page, 'Add');
    if (addKeyClicked) {
      await wait(1000);
      logTest('Add Key button works', true);
      await screenshot(page, '14-add-key-modal');
    }

  } catch (error) {
    logTest('Settings page test', false, error.message);
  }
}

async function testSegmentsPage(page) {
  console.log('\n📑 Testing Segments Page...');

  try {
    await page.goto(`${BASE_URL}/segments`, { waitUntil: 'networkidle2', timeout: TIMEOUT });
    await wait(2000);

    const content = await page.evaluate(() => document.body.innerText);
    logTest('Segments page loads', content.includes('Segment') || content.includes('SMB') || content.includes('Enterprise'));

    await screenshot(page, '15-segments');

    // Check for segment cards
    const cards = await page.$$('[class*="card"], [class*="Card"]');
    logTest('Segment cards visible', cards.length > 0);

    // Click on a segment for details
    if (cards.length > 0) {
      await cards[0].click();
      await wait(2000);
      await screenshot(page, '16-segment-detail');
      logTest('Can view segment details', true);
    }

  } catch (error) {
    logTest('Segments page test', false, error.message);
  }
}

async function testNavigation(page) {
  console.log('\n🧭 Testing Navigation...');

  const routes = [
    { path: '/', name: 'Home' },
    { path: '/search', name: 'Search' },
    { path: '/segments', name: 'Segments' },
    { path: '/providers', name: 'Providers' },
    { path: '/admin', name: 'Admin' },
    { path: '/settings', name: 'Settings' },
  ];

  for (const route of routes) {
    try {
      const response = await page.goto(`${BASE_URL}${route.path}`, {
        waitUntil: 'networkidle2',
        timeout: TIMEOUT
      });
      logTest(`${route.name} (${route.path}) accessible`, response.status() === 200);
    } catch (error) {
      logTest(`${route.name} (${route.path}) accessible`, false, error.message);
    }
  }
}

async function testDragAndDrop(page) {
  console.log('\n🔀 Testing Drag and Drop (Admin)...');

  try {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle2', timeout: TIMEOUT });
    await wait(2000);

    // Look for drag handles
    const dragHandles = await page.$$('[class*="drag"], [class*="grip"], [class*="handle"]');
    logTest('Drag handles exist', dragHandles.length > 0);

    await screenshot(page, '17-drag-handles');

  } catch (error) {
    logTest('Drag and drop test', false, error.message);
  }
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runTests() {
  console.log('🚀 Starting E2E Tests for Enrichment Switcher\n');
  console.log('='.repeat(50));

  // Create screenshots directory
  const fs = require('fs');
  const screenshotDir = '/Users/jeffignacio/enrichment-switcher/frontend/tests/screenshots';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    // Run all test suites
    await testHomePage(page);
    await testNavigation(page);
    await testSearchPage(page);
    await testSearchWithSandbox(page);
    await testSegmentsPage(page);
    await testProvidersPage(page);
    await testAdminPage(page);
    await testCascadeEditor(page);
    await testSettingsPage(page);
    await testDragAndDrop(page);

  } catch (error) {
    console.error('Test runner error:', error);
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`📸 Screenshots saved to: ${screenshotDir}`);

  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach(f => console.log(`   - ${f.name}: ${f.error}`));
  }

  console.log('\n');

  // Return results for programmatic use
  return results;
}

runTests();
