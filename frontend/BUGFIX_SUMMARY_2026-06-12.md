# Bug Fix Summary - 2026-06-12

## Critical Database Issue: Missing Tables ❌ → ✅

### Problem
```
column dedup_survivorship_rule_groups.group_priority does not exist
```

The unified dedup config page was crashing because the database tables for compound survivorship rules didn't exist.

### Solution
**Created Migration 111:** `supabase/migrations/20260612000001_111_survivorship_rule_groups.sql`

This migration creates:
- `dedup_survivorship_rule_groups` - Groups of conditions for survivorship rules
- `dedup_survivorship_rule_conditions` - Individual conditions within groups
- RLS policies for org isolation
- Indexes for performance
- Triggers for timestamp management

### Action Required
**Apply the migration to production:**

**Option 1: Supabase Dashboard (Recommended)**
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20260612000001_111_survivorship_rule_groups.sql`
3. Run the SQL
4. Verify tables exist: `SELECT * FROM dedup_survivorship_rule_groups LIMIT 1;`

**Option 2: Link and Push**
```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

**Option 3: Auto-deploy**
- Migration will auto-apply on next production deployment

### Verification
After migration, the `/settings/policies/dedup` page should load without errors.

---

## Fix 1: Survivorship Groups API ✅

### Changes Made
**File:** `app/api/settings/survivorship-rule-groups/route.ts`

**Before:**
```typescript
const groupIds = (groups ?? []).map(g => g.id);
const { data: conditions, error: conditionsError } = await supabaseAdmin
  .from('dedup_survivorship_rule_conditions')
  .select('*')
  .in('group_id', groupIds); // ❌ Fails with empty array
```

**After:**
```typescript
const groupIds = (groups ?? []).map(g => g.id);

let conditions: any[] = [];
if (groupIds.length > 0) {
  const { data: conditionsData, error: conditionsError } = await supabaseAdmin
    .from('dedup_survivorship_rule_conditions')
    .select('*')
    .in('group_id', groupIds);

  if (conditionsError) throw conditionsError;
  conditions = conditionsData ?? [];
}
```

**Why:** Supabase `.in()` throws error when array is empty

---

## Fix 2: UI Defensive Handling ✅

### Changes Made
**File:** `app/(dashboard)/settings/policies/dedup/page.tsx`

**Before:**
```typescript
async function loadCompoundGroups() {
  try {
    const res = await fetch('/api/settings/survivorship-rule-groups');
    if (res.ok) {
      const data = await res.json();
      setCompoundGroups(data.groups || []);
    }
  } catch (error) {
    console.error('Failed to load compound groups:', error);
  }
}
```

**After:**
```typescript
async function loadCompoundGroups() {
  try {
    const res = await fetch('/api/settings/survivorship-rule-groups');
    if (res.ok) {
      const data = await res.json();
      // Defensive: handle both array and object shapes
      const groups = Array.isArray(data) ? data : (data?.groups ?? []);
      setCompoundGroups(groups);
    } else {
      // Explicitly set empty array on error
      setCompoundGroups([]);
    }
  } catch (error) {
    console.error('Failed to load compound groups:', error);
    setCompoundGroups([]);
  }
}
```

**Why:** Prevents `TypeError: x.map is not a function` when API returns unexpected shape

---

## Fix 3: Sentry Replay Configuration ✅

### Changes Made
**File:** `sentry.client.config.ts`

**Added sample rate configuration:**
```typescript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,

  // ✅ Added these to prevent warning
  replaysSessionSampleRate: 0.0, // Don't capture by default
  replaysOnErrorSampleRate: 0.0,  // Enabled after user consent

  integrations: [],
  // ...
});
```

**Enhanced duplicate check in enableSentryReplay():**
```typescript
export function enableSentryReplay() {
  if (replayEnabled) {
    console.log('[Sentry] Session replay already enabled, skipping');
    return;
  }

  const client = Sentry.getClient();
  if (!client) return;

  // ✅ Check if integration already exists
  const existingReplay = client.getIntegrationByName('Replay');
  if (existingReplay) {
    console.log('[Sentry] Session replay already enabled, skipping');
    replayEnabled = true;
    return;
  }

  // Add integration...
}
```

**Fixes:**
- ❌ "Replay is disabled because neither `replaysSessionSampleRate` nor `replaysOnErrorSampleRate` are set"
- ❌ "[Sentry] Session replay already enabled, skipping" (duplicate integration)

---

## Fix 4: Clerk Deprecation Warning ⚠️

### Investigation Results
**Warning:**
```
Clerk: The prop "afterSignInUrl" is deprecated and should be replaced
with "fallbackRedirectUrl" or "forceRedirectUrl"
```

**Current Code Status:**
- ✅ `app/layout.tsx` uses `signInFallbackRedirectUrl="/dashboard"` (CORRECT)
- ✅ `app/layout.tsx` uses `signUpFallbackRedirectUrl="/onboarding"` (CORRECT)
- ✅ No source files use deprecated `afterSignInUrl` prop
- ✅ `components/refyne/TopBar.tsx` uses `afterSelectOrganizationUrl` (DIFFERENT prop, not deprecated)

**Conclusion:** The warning is a **false positive** or coming from:
- Clerk's internal migration handling
- Browser extension (MetaMask warnings visible in console)
- Cached build artifacts

**Action:** No code changes needed. Clear browser cache and rebuild if warning persists.

---

## Test Results ✅

**Before Fixes:** 1723/1723 passing
**After Fixes:** 1723/1723 passing

**Build:** ✅ Successful

---

## Summary Checklist

- [x] Fix 1: API empty array handling
- [x] Fix 2: UI defensive array checking
- [x] Fix 3: Sentry replay sample rates
- [x] Fix 4: Sentry duplicate integration check
- [ ] **ACTION REQUIRED:** Apply migration 111 to production database
- [x] All tests passing (1723/1723)
- [x] Build successful

---

## Before/After

**Before:**
```
/api/settings/survivorship-rule-groups: 500 Error
TypeError: x.map is not a function
Application error: a client-side exception has occurred
```

**After (once migration applied):**
```
/api/settings/survivorship-rule-groups: 200 OK
{ "groups": [] }
Unified dedup config page loads successfully
```

---

## Related Files Modified

1. `app/api/settings/survivorship-rule-groups/route.ts` - Empty array check
2. `app/(dashboard)/settings/policies/dedup/page.tsx` - Defensive loading
3. `sentry.client.config.ts` - Sample rates + duplicate check
4. `supabase/migrations/20260612000001_111_survivorship_rule_groups.sql` - **NEW**

---

## Next Steps

1. **Apply Migration 111** to production database (see instructions above)
2. Test the unified dedup config page: `/settings/policies/dedup`
3. Verify no console errors for survivorship groups
4. Monitor Sentry for any remaining issues

---

**Generated:** 2026-06-12
**Test Status:** 1723/1723 passing ✅
**Build Status:** Successful ✅
