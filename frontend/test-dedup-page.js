const puppeteer = require('puppeteer');

(async () => {
  console.log('🔍 Testing dedup page...\n');

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Intercept API requests
  await page.setRequestInterception(true);
  let apiResponse = null;

  page.on('request', request => {
    if (request.url().includes('/api/dedup/pairs')) {
      console.log('📡 Intercepted API request:', request.url());
    }
    request.continue();
  });

  page.on('response', async response => {
    if (response.url().includes('/api/dedup/pairs')) {
      console.log('📥 API Response status:', response.status());
      try {
        const data = await response.json();
        apiResponse = data;
        console.log('📦 API Response sample (first pair):');
        if (data.pairs && data.pairs[0]) {
          const pair = data.pairs[0];
          console.log('  - recordAId:', pair.recordAId);
          console.log('  - recordBId:', pair.recordBId);
          console.log('  - recordAName:', pair.recordAName || '❌ MISSING');
          console.log('  - recordBName:', pair.recordBName || '❌ MISSING');
        } else {
          console.log('  ⚠️  No pairs in response');
        }
      } catch (e) {
        console.error('❌ Failed to parse API response:', e.message);
      }
    }
  });

  // Navigate to dedup page
  console.log('🌐 Navigating to https://app.refynedata.com/dedup...\n');

  try {
    await page.goto('https://app.refynedata.com/dedup', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait a bit for any client-side fetching
    await page.waitForTimeout(3000);

    // Check what's rendered in the DOM
    console.log('\n🎨 Checking DOM content...');

    const recordATexts = await page.$$eval(
      'div[style*="grid-template-columns"] > div:nth-child(4) > div:first-child',
      elements => elements.slice(0, 3).map(el => el.textContent.trim())
    );

    console.log('Record A column texts:', recordATexts);

    // Check if numbers or names
    const hasNumbers = recordATexts.some(text => /^\d+$/.test(text));
    const hasNames = recordATexts.some(text => !/^\d+$/.test(text) && text.length > 0);

    if (hasNumbers && !hasNames) {
      console.log('❌ ISSUE: DOM shows only numbers (IDs), not company names');
    } else if (hasNames) {
      console.log('✅ SUCCESS: DOM shows company names');
    }

    // Check console errors
    console.log('\n📋 JavaScript console messages:');
    page.on('console', msg => console.log('  ', msg.text()));

    // Take a screenshot
    await page.screenshot({ path: '/tmp/dedup-test.png', fullPage: true });
    console.log('\n📸 Screenshot saved to /tmp/dedup-test.png');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Keep browser open for inspection
  console.log('\n⏸️  Browser will stay open for 30 seconds for inspection...');
  await page.waitForTimeout(30000);

  await browser.close();
  console.log('\n✅ Test complete');
})();
