# Fuzzy Matching Implementation Status

## ✅ Completed (Steps 1-4, 6)

### Step 1: Migration 031 - Reference Data Tables
- **File**: `lib/db/migrations/031_harmony_reference_data.sql`
- **Status**: ✅ Created
- **Contents**:
  - `harmony_reference_data` table with trigram and fuzzy indexes
  - `harmony_lookup_cache` table for performance
  - Extensions enabled: `pg_trgm`, `fuzzystrmatch`
  - Added columns to `harmonies` table: `transform_type`, `reference_table`, `fuzzy_threshold`, `phonetic_enabled`, `yaml_content`
  - RLS policies for org isolation

### Step 2: Migration 032 - PostgreSQL Lookup Functions
- **File**: `lib/db/migrations/032_harmony_lookup_functions.sql`
- **Status**: ✅ Created
- **Contents**:
  - `lookup_harmony_value()` - Three-tier matching (exact → fuzzy → phonetic)
  - `batch_lookup_harmony()` - Bulk lookup for efficiency
  - Both functions support org-specific overrides and configurable thresholds

### Step 3: Seed Data Files
- **Status**: ✅ Created (3 files)
- **Files**:
  1. `lib/harmonies/seed-data/industries.ts` - 200+ industry mappings (en, es, fr, de)
  2. `lib/harmonies/seed-data/legal-suffixes.ts` - 100+ legal entity suffixes (US, UK, ES, DE, FR, IT, NL, BE, CA, AU, JP, CN, BR, MX)
  3. `lib/harmonies/seed-data/countries.ts` - 100+ country names/aliases with translations
- **Common Interface**: `ReferenceRow { input, canonical, lang, fuzzyEligible? }`

### Step 4: Seed Script
- **File**: `scripts/seed-harmony-reference-data.ts`
- **Status**: ✅ Created
- **Features**:
  - Loads all 3 seed data files
  - Upserts in batches of 500
  - Error handling and progress logging
  - Exit codes for CI/CD integration

### Step 6: Normalization Engine
- **File**: `lib/harmonies/normalization-engine.ts`
- **Status**: ✅ Created
- **Features**:
  - `applyLookupHarmony()` - Uses `batch_lookup_harmony()` RPC
  - `applyFormatHarmony()` - Algorithmic transformations (phone, email, LinkedIn)
  - `runNormalizationPreview()` - Main entry point for UI
  - Cache management with `getCachedLookups()` and `cacheLookups()`
  - `clearLookupCache()` for cache invalidation
  - Returns `NormalizationResult[]` with `matchType`, `confidence`, `requiresReview`

---

## ⏳ Remaining Steps (Manual + Code)

### Step 5: Apply Migration ⚠️ MANUAL STEP
- **Action Required**: Run migrations in Supabase
```sql
-- In Supabase SQL Editor, run both migration files:
-- 1. lib/db/migrations/031_harmony_reference_data.sql
-- 2. lib/db/migrations/032_harmony_lookup_functions.sql
```

### Step 7: Update Normalize Preview API
- **File to Create**: `app/api/normalize/preview/route.ts` (or update existing)
- **Changes Needed**:
  - Import `runNormalizationPreview` from normalization-engine
  - Fetch harmonies from database
  - Fetch HubSpot records
  - Call `runNormalizationPreview(records, harmonies, orgId)`
  - Return results with `matchType`, `confidence`, `requiresReview` fields

### Step 8: Update Normalize Preview UI
- **File to Create**: `components/normalize/MatchIndicator.tsx`
- **File to Update**: `app/(dashboard)/normalize/page.tsx`
- **Changes Needed**:
  - Show `MatchIndicator` component per row (✓ exact, ⚠ fuzzy 82%, ⚠ phonetic 65%)
  - Fuzzy/phonetic matches pre-checked but amber-flagged
  - Add review confirmation: "X fuzzy matches need review"
  - Tooltip on fuzzy matches explaining confidence score

### Step 9: ReferenceDataTable Component
- **File to Create**: `components/harmonies/ReferenceDataTable.tsx`
- **Features Needed**:
  - Spreadsheet-like table: Input value | Canonical value | Language | Source | Match type | Actions
  - Inline edit for user-added rows (`source === 'user'`)
  - Preset rows (`source === 'refyne'`) read-only but deactivate-able
  - [+ Add mapping] button
  - [Download CSV] / [Upload CSV] buttons
  - Search/filter by input value, canonical, language
  - Pagination (50 rows per page)
  - "Unmatched values from last scan" section at bottom

### Step 10: Update Harmonies Page
- **File to Update**: `app/(dashboard)/harmonies/page.tsx`
- **Changes Needed**:
  - Show `ReferenceDataTable` for `transform_type === 'lookup'` harmonies
  - Show algorithm description for `transform_type === 'format'` harmonies
  - Add "Unmatched values" count badge on each harmony card

### Step 11: Update Harmony Live Tester
- **File to Update**: `app/api/harmonies/[id]/test/route.ts`
- **Changes Needed**:
  - For `transform_type === 'lookup'`, call `lookup_harmony_value()` instead of YAML matching
  - Return which tier matched (exact/fuzzy/phonetic) in response
  - Update UI to show match tier indicator

### Step 12: Enable Extensions in Supabase ⚠️ MANUAL STEP
- **Action Required**: Run in Supabase SQL Editor
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
```

### Step 13: Update Tests
- **Files to Update**: `*.test.ts` files in `lib/harmonies/`
- **Changes Needed**:
  - Ensure 831 existing tests still pass
  - Add new tests for fuzzy matching edge cases
  - Test exact vs fuzzy vs phonetic matches
  - Test org-specific overrides
  - Test cache behavior

### Step 14: Deploy
- **Actions**:
  - Vercel deployment (automatic on push to main)
  - Verify migrations ran successfully in production Supabase
  - Verify extensions enabled in production
  - Worker redeploy NOT needed (engine runs in API routes)

---

## 📋 Quick Start Guide

To continue implementation:

1. **Run migrations** (Step 5):
   ```bash
   # In Supabase SQL Editor, paste and run:
   cat lib/db/migrations/031_harmony_reference_data.sql
   cat lib/db/migrations/032_harmony_lookup_functions.sql
   ```

2. **Enable extensions** (Step 12):
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
   ```

3. **Seed reference data**:
   ```bash
   npx tsx scripts/seed-harmony-reference-data.ts
   ```

4. **Update normalize preview API** (Step 7)
5. **Update normalize preview UI** (Step 8)
6. **Build ReferenceDataTable component** (Step 9)
7. **Update Harmonies page** (Step 10)
8. **Update live tester** (Step 11)
9. **Add tests** (Step 13)
10. **Deploy** (Step 14)

---

## 🧪 Testing the Fuzzy Matching

Once steps 5, 12, and seed data are complete, test with:

```sql
-- Test exact match
SELECT * FROM lookup_harmony_value('industries', 'Healthcare', 'org_123');
-- Result: { canonical_value: 'Healthcare', match_type: 'exact', confidence: 100 }

-- Test fuzzy match (misspelling)
SELECT * FROM lookup_harmony_value('industries', 'Helth Care', 'org_123');
-- Result: { canonical_value: 'Healthcare', match_type: 'fuzzy', confidence: 82 }

-- Test phonetic match
SELECT * FROM lookup_harmony_value('industries', 'Healtcare', 'org_123', 0.80, true);
-- Result: { canonical_value: 'Healthcare', match_type: 'phonetic', confidence: 65 }

-- Test batch lookup
SELECT * FROM batch_lookup_harmony(
  'industries',
  ARRAY['Healthcare', 'Helth Care', 'Tech', 'Finteck'],
  'org_123',
  0.80,
  true
);
```

---

## 🎯 Expected Behavior

### Exact Match
```
Input: "Healthcare"
→ Tier 1: Exact match ✓
→ Output: { canonical: "Healthcare", match_type: "exact", confidence: 100 }
```

### Fuzzy Match (Typo)
```
Input: "Helth Care"
→ Tier 1: Exact match ✗
→ Tier 2: Trigram similarity = 0.82 ✓
→ Output: { canonical: "Healthcare", match_type: "fuzzy", confidence: 82 }
→ UI shows: ⚠ fuzzy 82% (requires review)
```

### Phonetic Match
```
Input: "Healtcare"
→ Tier 1: Exact match ✗
→ Tier 2: Trigram similarity = 0.72 (below 0.80 threshold) ✗
→ Tier 3: metaphone("Healtcare") = metaphone("Healthcare") = "HLTKR" ✓
→ Output: { canonical: "Healthcare", match_type: "phonetic", confidence: 65 }
→ UI shows: ⚠ phonetic 65% (requires review)
```

### No Match
```
Input: "Garbage Value"
→ Tier 1: Exact match ✗
→ Tier 2: No fuzzy matches ✗
→ Tier 3: No phonetic matches ✗
→ Output: { canonical: null, match_type: "none", confidence: 0 }
→ Shows in "Unmatched values" section for admin to add
```

---

## 📝 Notes

- All preset data has `source: 'refyne'`, `org_id: null`
- Org-specific mappings have `source: 'user'`, `org_id: <orgId>`
- Org-specific mappings take priority over global presets in lookup function
- Cache has 24-hour TTL (not implemented yet, but planned)
- Cache invalidates on reference data INSERT/UPDATE/DELETE
- ISO codes (US, GB, LLC, Inc) have `fuzzy_eligible: false` for safety
- Full company names and industry labels have `fuzzy_eligible: true`
