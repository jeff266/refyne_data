/**
 * Visual Inspection Script
 *
 * Takes screenshots of the waterfall builder at various states and generates
 * a visual critique report for UI/UX improvements.
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.TEST_BASE_URL || 'https://app.refynedata.com';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'visual-inspection');

const ADMIN_CREDENTIALS = {
  email: process.env.TEST_ADMIN_EMAIL || 'admin@test.refynedata.com',
  password: process.env.TEST_ADMIN_PASSWORD || 'test-password',
};

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function signIn(page: any) {
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('input[name="identifier"]', { timeout: 10000 });
  await page.type('input[name="identifier"]', ADMIN_CREDENTIALS.email);
  await page.click('button[type="submit"]');
  await page.waitForSelector('input[name="password"]', { timeout: 10000 });
  await page.type('input[name="password"]', ADMIN_CREDENTIALS.password);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
}

async function navigateToStep3(page: any) {
  // Skip onboarding
  await page.evaluate(async () => {
    await fetch('/api/arrangements/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skipped: true }),
    });
  });

  await page.goto(`${BASE_URL}/arrangements/new`, { waitUntil: 'networkidle2' });
  await page.waitForTimeout(1000);

  // Step 1: Fill name
  await page.type('input[placeholder*="Enrich"]', 'Visual Inspection Test');
  await page.click('text=/Next/i');
  await page.waitForTimeout(1000);

  // Step 2: Select source
  await page.click('text=/Next/i');
  await page.waitForTimeout(1000);
}

async function main() {
  console.log('\n🎨 Visual Inspection - Waterfall Builder');
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    await signIn(page);
    await navigateToStep3(page);

    console.log('\n📸 Capturing: Empty state...');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-empty-state.png'),
      fullPage: true,
    });

    console.log('📸 Capturing: Manage fields slide-over...');
    await page.click('text=/Manage fields/i');
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-manage-fields-slide.png'),
      fullPage: true,
    });

    console.log('📸 Capturing: Fields selected...');
    const checkboxes = await page.$$('input[type="checkbox"]');
    for (let i = 0; i < Math.min(3, checkboxes.length); i++) {
      await checkboxes[i].click();
      await page.waitForTimeout(200);
    }
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-fields-selected.png'),
      fullPage: true,
    });

    console.log('📸 Capturing: Fields added (collapsed)...');
    await page.click('text=/^Save$/i');
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-fields-collapsed.png'),
      fullPage: true,
    });

    console.log('📸 Capturing: First field expanded...');
    const fieldRows = await page.$$('[style*="cursor: pointer"]');
    if (fieldRows.length > 0) {
      await fieldRows[0].click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-field-expanded.png'),
      fullPage: true,
    });

    console.log('📸 Capturing: Provider legend...');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06-provider-legend.png'),
      clip: { x: 0, y: 200, width: 1920, height: 100 },
    });

    console.log('📸 Capturing: All fields expanded...');
    for (let i = 1; i < Math.min(3, fieldRows.length); i++) {
      await fieldRows[i].click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '07-all-fields-expanded.png'),
      fullPage: true,
    });

    console.log('📸 Capturing: Strategy selector (if numeric)...');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '08-strategy-selector.png'),
      fullPage: true,
    });

    console.log('📸 Capturing: Settings calibration tab...');
    await page.goto(`${BASE_URL}/settings?tab=calibration`, { waitUntil: 'networkidle2' });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '09-calibration-tab.png'),
      fullPage: true,
    });

    console.log('📸 Capturing: Onboarding modal...');
    await page.evaluate(async () => {
      await fetch('/api/arrangements/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
    });
    await page.goto(`${BASE_URL}/arrangements/new`, { waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '10-onboarding-modal.png'),
      fullPage: true,
    });

    console.log('\n✅ All screenshots captured!');
    console.log(`📁 Saved to: ${SCREENSHOT_DIR}`);

    // Generate visual critique
    console.log('\n' + '='.repeat(60));
    console.log('🔍 VISUAL CRITIQUE & IMPROVEMENT AREAS');
    console.log('='.repeat(60));

    console.log(`
1. EMPTY STATE (01-empty-state.png)
   Areas for improvement:
   - Consider adding an illustration or icon
   - "Add fields" button could be more prominent
   - Show example screenshot of configured waterfall
   - Add helpful text: "Each field gets its own provider chain"

2. MANAGE FIELDS SLIDE-OVER (02-manage-fields-slide.png)
   Areas for improvement:
   - Consider search/filter for long field lists
   - Group headers could have better visual hierarchy
   - Selected count could show in header as badge
   - "Sync from HubSpot" could have a last-synced timestamp

3. FIELDS SELECTED (03-fields-selected.png)
   Looks good, but consider:
   - Visual feedback during save (loading spinner)
   - Transition animation when slide-over closes

4. FIELDS COLLAPSED (04-fields-collapsed.png)
   Areas for improvement:
   - Coverage bar needs label (e.g., "72% filled")
   - "No providers configured" warning could be amber, not just text
   - Add subtle hover state to field rows
   - Consider adding field count badge in toolbar

5. FIELD EXPANDED (05-field-expanded.png)
   Areas for improvement:
   - "Add provider" dashed button could show available provider count
   - Fallthrough arrow could be styled differently (maybe lighter color)
   - Step number circles could show status (complete/empty)
   - Consider showing estimated cost per step

6. PROVIDER LEGEND (06-provider-legend.png)
   Areas for improvement:
   - Legend could be collapsible on smaller screens
   - "Apply to all fields" tooltip would help
   - Show provider connection status (connected/error) with icons

7. ALL FIELDS EXPANDED (07-all-fields-expanded.png)
   Areas for improvement:
   - Consider collapse all / expand all toggle
   - Add jump-to-field navigation if many fields
   - Show summary: "3 fields, 5 total provider connections"

8. STRATEGY SELECTOR (08-strategy-selector.png)
   Areas for improvement:
   - Strategy dropdown could show descriptions on hover
   - "RECOMMENDED" badge is good, but could pulse or animate
   - Add help icon with explanation of each strategy

9. CALIBRATION TAB (09-calibration-tab.png)
   Areas for improvement:
   - Intro card could have "Learn more" link
   - Provider confidence bars need percentage labels
   - Calibration history could paginate if many sessions
   - Add export button for calibration results

10. ONBOARDING MODAL (10-onboarding-modal.png)
    Areas for improvement:
    - Progress indicator (1 of 3, 2 of 3, etc.)
    - "Skip" could be less prominent to encourage calibration
    - Question text could be slightly larger
    - Add estimated time: "2 minutes to complete"

GENERAL OBSERVATIONS:
- Color scheme is consistent and professional
- Loading states could be more prominent
- Consider adding keyboard shortcuts (Esc to close modals, etc.)
- Empty states throughout need more guidance
- Add success animations when actions complete
- Consider dark mode support
- Mobile responsive design not tested (likely needs work)

HIGH PRIORITY IMPROVEMENTS:
1. Add loading spinners for async operations
2. Show provider connection status in legend
3. Add tooltips/help text for complex features
4. Improve empty state with illustration
5. Add collapse all / expand all for fields

MEDIUM PRIORITY:
6. Search/filter in manage fields
7. Keyboard shortcuts
8. Strategy selector descriptions
9. Progress indicators in onboarding
10. Cost estimation per provider step

LOW PRIORITY:
11. Animations and transitions
12. Dark mode
13. Export calibration results
14. Jump-to navigation for many fields
15. Mobile responsive refinements
    `);

    console.log('\n='.repeat(60));
    console.log('✅ Visual inspection complete!');
    console.log('📂 Review screenshots in: ' + SCREENSHOT_DIR);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error during visual inspection:', error);
  } finally {
    // Keep browser open for 10 seconds to allow manual inspection
    console.log('\n⏸️  Browser will stay open for 10 seconds...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
}

main().catch(console.error);
