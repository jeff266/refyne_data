const puppeteer = require('puppeteer');

(async () => {
  console.log('🔍 Testing dedup API and page render...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture API response
  let apiResponse = null;

  page.on('response', async response => {
    if (response.url().includes('/api/dedup/pairs')) {
      console.log('📡 API URL:', response.url());
      console.log('📥 Status:', response.status());
      try {
        const data = await response.json();
        apiResponse = data;
      } catch (e) {
        console.error('❌ Failed to parse API response:', e.message);
      }
    }
  });

  // Capture console errors
  const consoleMessages = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleMessages.push(msg.text());
    }
  });

  try {
    console.log('🌐 Navigating to https://app.refynedata.com/dedup...');

    await page.goto('https://app.refynedata.com/dedup', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    // Wait for table to render
    await page.waitForSelector('div[style*="grid-template-columns"]', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Analyze API response
    console.log('\n📦 API RESPONSE ANALYSIS:');
    if (apiResponse && apiResponse.pairs && apiResponse.pairs.length > 0) {
      const firstPair = apiResponse.pairs[0];
      console.log('✅ API returned pairs:', apiResponse.pairs.length);
      console.log('   First pair structure:');
      console.log('   - recordAId:', firstPair.recordAId);
      console.log('   - recordBId:', firstPair.recordBId);
      console.log('   - recordAName:', firstPair.recordAName ? `"${firstPair.recordAName}"` : '❌ MISSING');
      console.log('   - recordBName:', firstPair.recordBName ? `"${firstPair.recordBName}"` : '❌ MISSING');

      if (!firstPair.recordAName || !firstPair.recordBName) {
        console.log('\n❌ PROBLEM: API is not returning company names!');
      } else {
        console.log('\n✅ API correctly includes company names');
      }
    } else {
      console.log('⚠️  No API response captured or no pairs returned');
    }

    // Check DOM rendering
    console.log('\n🎨 DOM RENDERING ANALYSIS:');
    const recordACells = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('div[style*="grid-template-columns"]'));
      // Skip header row, get first 3 data rows
      const dataRows = rows.slice(1, 4);
      return dataRows.map(row => {
        // Column 4 is Record A (0-indexed: col 3)
        const cells = Array.from(row.children);
        const recordACell = cells[3];
        return recordACell ? recordACell.textContent.trim() : '';
      });
    });

    console.log('Record A column contents:', recordACells);

    const allNumbers = recordACells.every(text => /^\d+/.test(text));
    const hasNames = recordACells.some(text => !/^\d{10,}/.test(text));

    if (allNumbers) {
      console.log('❌ PROBLEM: DOM only shows numeric IDs');
    } else if (hasNames) {
      console.log('✅ SUCCESS: DOM shows company names');
    }

    // Report console errors
    if (consoleMessages.length > 0) {
      console.log('\n⚠️  Console errors found:');
      consoleMessages.forEach(msg => console.log('   ', msg));
    }

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
  }

  await browser.close();
  console.log('\n✅ Test complete\n');
})();
