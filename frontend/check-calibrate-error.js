const puppeteer = require('puppeteer');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Capture console errors
  const errors = [];
  page.on('pageerror', error => {
    errors.push(error.toString());
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  try {
    console.log('Navigating to calibrate page...');

    // Don't wait for full load
    await page.goto('https://refynedata.com/onboarding/calibrate', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    }).catch(e => console.log('Load timeout (expected)'));

    // Wait to capture errors
    await wait(3000);

    // Check page content
    const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
    console.log('\n=== PAGE CONTENT ===');
    console.log(pageText.substring(0, 500));

    console.log('\n=== ERRORS CAPTURED ===');
    if (errors.length === 0) {
      console.log('No errors captured');
    } else {
      errors.forEach((err, idx) => {
        console.log((idx + 1) + '. ' + err);
      });
    }

    // Check loaded scripts
    const scripts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script[src]'))
        .map(s => s.src)
        .filter(src => src.includes('_next'));
    }).catch(() => []);

    console.log('\n=== LOADED SCRIPTS (showing chunk hashes) ===');
    scripts.forEach(script => {
      // Extract just the filename
      const parts = script.split('/');
      const filename = parts[parts.length - 1];
      console.log(filename);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
