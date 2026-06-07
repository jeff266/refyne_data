# Normalize Preview Fixes - June 6, 2026

Three fixes implemented for the Normalize preview page to improve clarity and eliminate duplicate changes.

## Fix #1: Show Harmony Name Per Change Row ✅

**Problem**: In the expanded company view, users couldn't tell which harmony was generating each field change.

**Solution**: Added `harmonyId` field to preview data flow and displayed it as a subdued pill between field name and values.

**Changes**:
- `app/api/normalize/preview/route.ts`: Added `harmonyId` to `PreviewRecord` interface and transformation
- `app/(dashboard)/normalize/page.tsx`: Updated `PreviewRecord` interface to include `harmonyId`
- `components/normalize/ByCompanyView.tsx`: Added harmony name pill display with subdued styling
- `components/normalize/ByFieldView.tsx`: Updated `PreviewRecord` interface

**UI Display**:
```
Before: [checkbox] field | before → after
After:  [checkbox] field | harmony-id | before → after
```

The harmony ID is styled as a small monospace pill with gray background and reduced opacity for visual hierarchy.

---

## Fix #2: Add Field Label Under Harmony Toggles ✅

**Problem**: Users couldn't see which HubSpot field each harmony writes to without opening the harmony detail page.

**Solution**: Added "writes to: [hubspot_property]" label under each harmony toggle in the left panel.

**Changes**:
- `app/(dashboard)/normalize/page.tsx`:
  - Added `fieldAssignmentLabels` state to track harmony → field mappings
  - Created `fetchFieldAssignmentLabels()` function to fetch field assignments
  - Updated harmony list rendering to display field labels
- `app/api/normalize/field-assignments/route.ts`: Created new API endpoint to fetch field assignments

**UI Display**:
```
company-domain           [toggle]
writes to: domain

company-industry         [toggle]
writes to: industry
```

Labels are displayed in small monospace font with reduced opacity below each harmony name.

---

## Fix #3: Fix Duplicate Field Changes ✅

**Problem**: Field Nation showed `company.domain` appearing twice with identical changes (`fieldnation.com → https://fieldnation.com/`).

**Root Cause**: Two global harmonies both target the same field:
1. `company-domain` - Company Domain Normalizer
2. `website-social-media` - Website Social Media Domain Flag (MISCONFIGURED)

Both harmonies:
- Have `field: 'company.domain'`
- Use `transform_function: 'url_canonical'`
- Are `is_active: true`

When the normalization engine runs both harmonies on the same records, they both generate identical changes for the same company+field combination.

**Investigation Findings** (`scripts/investigate-website-social-harmony.ts`):
The `website-social-media` harmony is **misconfigured**:
- **Name suggests**: It should flag records with social media/directory domains
- **Description**: "Compliance flag for records using social media or directory domains as their primary website"
- **Examples show**: It should return JSON with `{flagged: true, reason: "social_media_or_directory_domain", severity: "warning"}`
- **Actual behavior**: It normalizes domains using `url_canonical`, writing to `company.domain`

This harmony should either:
1. Write to a different field like `company.social_media_flag`
2. Use a custom transform that returns boolean flags instead of normalized URLs
3. Be deactivated until properly refactored

**Solution Implemented**: Defensive deduplication in preview API.

Added deduplication logic to `app/api/normalize/preview/route.ts` that filters out duplicate changes using composite key: `{recordId}:{field}:{before}:{after}`.

When duplicates are detected, a warning is logged:
```
[Normalize Preview] Duplicate change detected: harmony website-social-media
modifies company.domain on record 123 (fieldnation.com → https://fieldnation.com/),
but another harmony already generated this change. Skipping.
```

**Why This Fix Is Correct**:
- Multiple harmonies generating identical changes to the same field is always an error
- Deduplication prevents confusing/invalid UI state
- Preserves the first change (deterministic behavior)
- Logs warnings for investigation
- Does not mask the underlying misconfiguration (visible in logs)

**Recommended Follow-up**:
1. Refactor `website-social-media` harmony to target a different field
2. Implement validation to prevent multiple harmonies targeting the same field
3. Add UI warnings when harmonies have conflicting field assignments

---

## Test Results

All fixes implemented successfully with no test regressions:

```
Test Files  7 failed | 36 passed (43)
      Tests  7 failed | 1035 passed (1042)

Normalization Tests: 79 passed (79) ✅
```

The 7 failing tests are in `trial-counter.test.ts` (unrelated billing logic) and were failing before these changes.

All 79 normalization-specific tests pass, confirming these fixes do not break existing normalization behavior.

---

## Files Modified

1. `app/api/normalize/preview/route.ts` - Added harmonyId to PreviewRecord, implemented deduplication
2. `app/(dashboard)/normalize/page.tsx` - Added harmonyId to interface, fetch field assignment labels
3. `components/normalize/ByCompanyView.tsx` - Display harmony ID pill, added harmonyId to interface
4. `components/normalize/ByFieldView.tsx` - Added harmonyId to interface
5. `app/api/normalize/field-assignments/route.ts` - **NEW** API endpoint for field assignments

## Files Created

1. `scripts/investigate-domain-harmonies.ts` - Investigation script for domain harmony conflicts
2. `scripts/investigate-website-social-harmony.ts` - Detailed analysis of misconfigured harmony
3. `NORMALIZE_PREVIEW_FIXES.md` - This documentation
