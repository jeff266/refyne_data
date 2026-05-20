# Arrangements v2 Preflight Test Suite

Comprehensive Puppeteer tests to validate steps 1-5 of the Arrangements v2 implementation before proceeding to Step 6 (waterfall builder).

## Prerequisites

1. **App running at production URL**
   - Default: `https://app.refynedata.com`
   - Override with `TEST_BASE_URL` env var

2. **Test organization with three user roles**
   - Admin account
   - Operator account
   - Viewer account

3. **Environment variables**
   ```bash
   TEST_ADMIN_EMAIL=admin@test.refynedata.com
   TEST_ADMIN_PASSWORD=your-password
   TEST_OPERATOR_EMAIL=operator@test.refynedata.com
   TEST_OPERATOR_PASSWORD=your-password
   TEST_VIEWER_EMAIL=viewer@test.refynedata.com
   TEST_VIEWER_PASSWORD=your-password
   TEST_BASE_URL=https://app.refynedata.com  # optional
   ```

4. **Database migrations applied**
   - Migration 033 must be applied to production database

## Running Tests

### Headless mode (CI/default)
```bash
npm run test:preflight
```

### Headful mode (for debugging)
```bash
npm run test:preflight:headful
```

### With custom base URL
```bash
TEST_BASE_URL=http://localhost:3000 npm run test:preflight:headful
```

## Test Coverage

### 1. RBAC: Viewer blocked from /arrangements/new
- Signs in as viewer
- Attempts to navigate to wizard
- Asserts redirect occurs
- Asserts toast notification appears

### 2. RBAC: Operator can access /arrangements/new
- Signs in as operator
- Navigates to wizard
- Asserts wizard renders (Step 1 visible)

### 3. RBAC: Viewer sees no '+ New arrangement' button
- Signs in as viewer
- Views arrangements list
- Asserts button not in DOM

### 4. Onboarding gate fires on first use
- Signs in as admin
- Resets onboarding flag via API
- Navigates to wizard
- Asserts onboarding modal appears
- Walks through all 3 screens

### 5. Onboarding skip sets flag and enters wizard
- Signs in as admin
- Resets onboarding flag
- Clicks "Skip for now"
- Asserts modal dismissed
- Asserts wizard Step 1 visible
- Asserts API returns `complete: true`

### 6. Calibration tab: admin access
- Signs in as admin
- Navigates to /settings?tab=calibration
- Asserts calibration UI renders
- Asserts numeric defaults section visible
- Asserts no locked state

### 7. Calibration tab: operator locked state
- Signs in as operator
- Navigates to calibration tab
- Asserts locked state renders
- Asserts "managed by admin" text visible
- Asserts no save buttons in DOM

### 8. Numeric defaults save and reload
- Signs in as admin
- Changes numeric default to 'cluster_average'
- Clicks Save
- Asserts confirmation visible
- Hard reloads page
- Asserts selection persisted

### 9. Bug fix: save redirects to /arrangements/[id] not 404
- Signs in as admin
- Completes 5-step wizard with minimal config
- Clicks "Save Arrangement"
- Asserts URL matches `/arrangements/[uuid]`
- Asserts page does not show 404

### 10. Migration 033: tables exist
- Calls GET /api/health/schema
- Asserts all required tables exist:
  - `arrangements` (with `field_configs` column)
  - `provider_calibration_scores`
  - `calibration_sessions`
  - `arrangement_settings`
  - `onboarding_progress`

## Output

### Screenshots
All screenshots saved to: `test-results/arrangements-preflight/`

Files:
- `viewer-redirect.png`
- `operator-wizard-access.png`
- `viewer-arrangements-list.png`
- `onboarding-modal-screen1.png`
- `onboarding-modal-screen2.png`
- `onboarding-modal-screen3.png`
- `post-skip-wizard.png`
- `calibration-admin.png`
- `calibration-operator-locked.png`
- `calibration-save-persist.png`
- `post-save-redirect.png`
- `schema-health.png`

### Summary Table
```
Test                              Result    Screenshot
────────────────────────────────  ───────   ──────────────────────────
1. Viewer blocked                 PASS/FAIL viewer-redirect.png
2. Operator access                PASS/FAIL operator-wizard-access.png
3. Viewer no button               PASS/FAIL viewer-arrangements-list.png
4. Onboarding gate                PASS/FAIL onboarding-modal-screen1.png
5. Onboarding skip                PASS/FAIL post-skip-wizard.png
6. Calibration admin              PASS/FAIL calibration-admin.png
7. Calibration operator locked    PASS/FAIL calibration-operator-locked.png
8. Numeric defaults persist       PASS/FAIL calibration-save-persist.png
9. Save redirect                  PASS/FAIL post-save-redirect.png
10. Schema health                 PASS/FAIL schema-health.png
```

## Exit Codes

- `0` - All tests passed, ready to proceed to Step 6
- `1` - One or more tests failed, **DO NOT PROCEED TO STEP 6**

## Troubleshooting

### Test fails: "Viewer was not redirected"
- Check RBAC middleware is active
- Verify viewer role exists in test org
- Check console logs for auth errors

### Test fails: "Onboarding modal not visible"
- Verify migration 033 applied
- Check onboarding API endpoint returns 200
- Verify `onboarding_progress` table exists

### Test fails: "Missing tables"
- Run migration 033 on target environment
- Check Supabase connection in production
- Verify RLS policies applied

### Flaky tests / timeouts
- Increase timeout values in test file
- Check network latency to test environment
- Run in headful mode to debug: `npm run test:preflight:headful`

## CI/CD Integration

Add to GitHub Actions:

```yaml
- name: Run Arrangements v2 Preflight Tests
  env:
    TEST_ADMIN_EMAIL: ${{ secrets.TEST_ADMIN_EMAIL }}
    TEST_ADMIN_PASSWORD: ${{ secrets.TEST_ADMIN_PASSWORD }}
    TEST_OPERATOR_EMAIL: ${{ secrets.TEST_OPERATOR_EMAIL }}
    TEST_OPERATOR_PASSWORD: ${{ secrets.TEST_OPERATOR_PASSWORD }}
    TEST_VIEWER_EMAIL: ${{ secrets.TEST_VIEWER_EMAIL }}
    TEST_VIEWER_PASSWORD: ${{ secrets.TEST_VIEWER_PASSWORD }}
    TEST_BASE_URL: https://app.refynedata.com
  run: npm run test:preflight

- name: Upload test screenshots
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: preflight-screenshots
    path: test-results/arrangements-preflight/
```

## Next Steps

**If all tests pass:**
1. Review screenshots in `test-results/arrangements-preflight/`
2. Verify visual appearance matches spec
3. Proceed to Step 6: Waterfall Builder implementation

**If any tests fail:**
1. Review failure error messages
2. Check screenshots for visual debugging
3. Fix the failing functionality
4. Re-run test suite
5. Only proceed when all tests pass
