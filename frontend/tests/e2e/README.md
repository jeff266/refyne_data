# End-to-End Tests

This directory contains comprehensive end-to-end tests for critical user flows in the Enrichment Switcher application.

## Tests

### Delete Harmony Test (`delete-harmony.spec.ts`)

Tests the complete harmony deletion workflow:

1. Navigate to /harmonies page
2. Click "+ New harmony" to create a custom harmony
3. Fill out the harmony creation form:
   - Name: "Test Delete Harmony {timestamp}"
   - Classification type: Sub-industry
   - Source field: industry
   - Target field: Use existing field (industry)
4. Save the harmony
5. Navigate to the harmony detail page
6. Verify it shows "Custom" badge (not "Library")
7. Scroll to Settings section "Danger Zone"
8. Click "Archive Harmony" button
9. Verify confirmation appears
10. Confirm archive
11. Verify redirected to /harmonies
12. Click "Show archived" toggle
13. Click on the archived harmony
14. Verify "Danger Zone" now shows "Delete Permanently" section
15. Type the harmony name in the confirmation input
16. Click "Delete Permanently" button
17. Verify redirected to /harmonies
18. Verify harmony is no longer in the list (even with "Show archived" on)

## Prerequisites

- Application running at `BASE_URL` (default: https://app.refynedata.com)
- Test account with admin access
- Environment variables set:
  - `TEST_ADMIN_EMAIL`
  - `TEST_ADMIN_PASSWORD`
  - `TEST_BASE_URL` (optional, defaults to https://app.refynedata.com)

## Running Tests

### Headless mode (default)

```bash
npm run test:delete-harmony
```

### Headful mode (visible browser)

```bash
npm run test:delete-harmony:headful
```

### Direct execution

```bash
npx tsx tests/e2e/delete-harmony.spec.ts

# With visible browser
HEADLESS=false npx tsx tests/e2e/delete-harmony.spec.ts
```

## Test Results

Test results and screenshots are saved to:
```
test-results/delete-harmony/
```

Each step of the test generates a screenshot for debugging:

- `01-harmonies-page.png` - Initial harmonies page
- `02-wizard-opened.png` - Harmony creation wizard opened
- `03-form-filled.png` - Form filled with test data
- `04-harmony-created.png` - After harmony creation
- `05-custom-badge-verified.png` - Custom badge verification
- `06-danger-zone-visible.png` - Danger Zone section
- `07-back-to-harmonies-list.png` - After archiving
- `08-archived-visible.png` - Show archived toggled on
- `09-archived-harmony-detail.png` - Archived harmony detail page
- `10-delete-permanently-section.png` - Delete section visible
- `11-confirmation-typed.png` - Confirmation text entered
- `12-after-deletion.png` - After permanent deletion
- `13-final-verification.png` - Final verification

## Expected Behavior

The test validates that:

1. Custom harmonies can be created through the UI
2. Custom harmonies show a "Custom" badge (not "Library")
3. Custom harmonies can be archived from the detail page
4. Archived harmonies appear only when "Show archived" is enabled
5. Archived harmonies show a "Delete Permanently" option
6. Permanent deletion requires typing the harmony name for confirmation
7. Permanently deleted harmonies are completely removed from the system
8. Deleted harmonies do not appear even with "Show archived" enabled

## Known Issues / Limitations

- The test assumes a clean state with no existing harmony with the test name
- The test uses a timestamp in the harmony name to avoid conflicts
- Form field selectors may need adjustment if the UI changes
- The test requires the Clerk authentication system to be properly configured

## Debugging Failed Tests

If a test fails:

1. Check the screenshot in `test-results/delete-harmony/` corresponding to the failed step
2. Run in headful mode to watch the test execute: `HEADLESS=false npx tsx tests/e2e/delete-harmony.spec.ts`
3. Check browser console errors logged during the test
4. Verify the test credentials are correct
5. Ensure the application is accessible at the BASE_URL

## Future Improvements

- Add tests for edge cases:
  - Attempting to delete a Library harmony (should not be allowed)
  - Attempting to delete an active harmony
  - Canceling the delete operation
  - Archiving and unarchiving a harmony
- Add cleanup logic to remove test harmonies if the test fails partway through
- Add parallel test execution with unique harmony names
