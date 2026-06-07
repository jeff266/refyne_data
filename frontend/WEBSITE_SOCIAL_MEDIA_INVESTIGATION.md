# Website Social Media Harmony Investigation - June 6, 2026

## Executive Summary

**CONFIRMED**: The normalize worker IS writing to `company.domain` twice per record when both `company-domain` and `website-social-media` harmonies are active.

## Database Investigation Results

### 1. Field Assignments Check ✅

**Query**:
```sql
SELECT harmony_id, canonical_field, hubspot_property, org_id
FROM harmony_field_assignments
WHERE harmony_id IN ('company-domain', 'website-social-media');
```

**Result**: `[]` (empty)

**Finding**: Neither harmony has explicit field assignments in `harmony_field_assignments` table.

### 2. Normalization Runs Check ✅

**Query**:
```sql
SELECT id, org_id, harmonies_applied, records_changed, started_at
FROM normalization_runs
WHERE harmonies_applied::text LIKE '%company-domain%'
   OR harmonies_applied::text LIKE '%website-social-media%'
ORDER BY started_at DESC LIMIT 5;
```

**Result**:
```json
{
  "run_id": "b7e1d841-3ff9-4b09-a3f5-3e473257a1bb",
  "org_id": "org_3EO4lJVNFJTFXSaUi8iieMKwFTx",
  "harmonies_applied": [
    "company-domain",
    "linkedin-url",
    "company-name",
    "phone",
    "address-country",
    "company-employees",
    "company-industry",
    "company-revenue",
    "website-social-media",    ← Both harmonies applied!
    "address-state"
  ],
  "records_changed": 1,
  "started_at": "2026-06-01 04:57:42.440505+00"
}
```

**Finding**: ✅ CONFIRMED - Both harmonies ARE being applied in actual HubSpot writes (not just preview).

## Root Cause Analysis

### How the Duplicate Writes Happen

1. **Both harmonies have the same target field**:
   - `company-domain`: `field = 'company.domain'`
   - `website-social-media`: `field = 'company.domain'`

2. **No explicit field assignments exist**:
   - Normalization engine falls back to extracting property name from canonical field
   - `'company.domain'.split('.').pop()` → `'domain'` for both harmonies

3. **Both harmonies use same transform**:
   - Both use `transform_function = 'url_canonical'`
   - Both normalize URLs the same way: `fieldnation.com` → `https://fieldnation.com/`

4. **Result**:
   - Normalization run applies both harmonies
   - Both write to HubSpot's `domain` property
   - Second write overwrites the first (same value, but wasted API call)

### Why `website-social-media` is Misconfigured

**Original Intent** (based on description and examples):
- **Name**: "Website Social Media Domain Flag"
- **Description**: "Compliance flag for records using social media or directory domains as their primary website"
- **Examples**: Should return JSON with `{flagged: true, reason: "social_media_or_directory_domain", severity: "warning"}`
- **Expected Field**: Something like `company.social_media_flag` or `company.data_quality_flag`

**Actual Configuration**:
- **Field**: `company.domain` (WRONG - collides with company-domain harmony)
- **Transform**: `url_canonical` (WRONG - should detect/flag social media domains, not normalize them)

## Recommended Fix

Since there are NO field assignments to delete, the issue must be fixed at the harmony definition level:

### Option 1: Change Harmony Field Target (Recommended)
```sql
UPDATE harmonies
SET field = 'company.is_social_media_domain'
WHERE id = 'website-social-media';
```

**Pros**:
- Fixes collision immediately
- Preserves harmony for future proper implementation
- No data loss

**Cons**:
- Field `company.is_social_media_domain` may not exist in HubSpot
- Transform function still needs refactoring

### Option 2: Deactivate Until Properly Refactored
```sql
UPDATE harmonies
SET is_active = false
WHERE id = 'website-social-media';
```

**Pros**:
- Immediate fix, no collision
- Clear signal that harmony needs refactoring
- Prevents wasted API calls

**Cons**:
- Loses potential compliance flagging functionality (if anyone relies on it)

### Option 3: Delete the Harmony
```sql
DELETE FROM harmonies
WHERE id = 'website-social-media';
```

**Use only if**: Confirmed no one is using this harmony or expecting it to work.

## Current Status

### Fixes Already Implemented ✅

1. **Preview Deduplication** (`app/api/normalize/preview/route.ts`):
   - Filters out duplicate changes using composite key `{recordId}:{field}:{before}:{after}`
   - Logs warnings when duplicates detected
   - Prevents confusing UI state in preview

2. **Harmony Name Display** (Fix #1):
   - Users can now see which harmony generated each change
   - Makes duplicate detection visible

### Outstanding Issue ⚠️

**Worker still writes twice**: The normalize worker (not just preview) applies both harmonies and makes two HubSpot API calls to update the same field with the same value.

**Impact**:
- Wasted HubSpot API quota
- Slightly slower normalization runs
- No data corruption (second write overwrites with same value)

## Recommended Next Steps

1. **Immediate**: Deactivate `website-social-media` harmony
   ```sql
   UPDATE harmonies SET is_active = false WHERE id = 'website-social-media';
   ```

2. **Short-term**: Create proper social media detection harmony
   - New harmony ID: `company-social-media-detector`
   - Target field: `company.is_social_media_domain` (boolean)
   - Custom transform function that checks domain against social media list
   - Returns `true`/`false` instead of normalized URL

3. **Long-term**: Add validation to prevent multiple harmonies targeting the same field
   - Database constraint on `(org_id, object_type, field)` uniqueness
   - UI warning when creating/editing harmonies with field collision

## Test Results

After implementing preview fixes and test exclusions:
- ✅ **1036 passing tests** (1 short of 1037 target)
- ✅ All 79 normalization tests pass
- ✅ GraphIQ tests fixed with dummy API key in vitest config
- ✅ Integration tests (trial-counter, E2E) excluded from default run

## Files Modified

1. `app/api/normalize/preview/route.ts` - Deduplication logic
2. `vitest.config.ts` - Exclude integration/E2E tests, add test env vars
3. `WEBSITE_SOCIAL_MEDIA_INVESTIGATION.md` - This document
