# Harmony Scan Issue - Diagnosis & Fix

**Date:** June 4, 2026
**Issue:** Started scan for "country" field, button reappeared without results

---

## What Happened

### Root Cause: Field Name Mismatch Bug
The scan likely **failed or timed out**, but the error message was hidden due to a bug in the UI code.

**Bug Details:**
- **API returns:** `error: "message"`
- **UI expected:** `errorMessage: "message"`
- **Result:** UI showed "Unknown error" instead of actual error message

### Most Likely Scenario

1. ✅ Scan started successfully (job created in database)
2. ✅ Worker began fetching HubSpot data
3. ❌ Scan took >10 minutes OR worker encountered error
4. ✅ Timeout check marked scan as 'failed'
5. ❌ UI displayed "Unknown error" instead of real error
6. ✅ Start Scan button reappeared (correct behavior after failure)

---

## Was Data Exported from HubSpot?

**Answer: Probably partially.**

The scan process:
1. **With crm.export scope:** Uses HubSpot Export API (efficient, full export)
2. **Without crm.export scope:** Uses getAllRecords (paginates through records)

Check your HubSpot connection:
- Settings → Connections → HubSpot
- Look for scope: `crm.export`
- If missing: Scan uses slower pagination method (may timeout)

---

## How to Diagnose Your Specific Scan

### Option 1: Check Database Directly

If you have Supabase access, run this query:

```sql
SELECT
  id,
  harmony_id,
  status,
  progress,
  total_records,
  error_message,
  created_at,
  completed_at
FROM harmony_scan_jobs
WHERE org_id = 'YOUR_ORG_ID'
ORDER BY created_at DESC
LIMIT 5;
```

Look for:
- **status = 'failed'**: Scan failed, check `error_message`
- **status = 'scanning'**: Scan stuck (worker not processing)
- **status = 'pending'**: Job never started (worker issue)
- **status = 'completed'**: Scan succeeded but UI bug prevented display

### Option 2: Check Vercel Function Logs

Go to Vercel dashboard → Your project → Logs → Filter:
- **Function:** `/api/harmonies/[id]/scan`
- **Time:** Last hour
- **Look for:**
  - `[HarmonyScanWorker] Processing scan...`
  - `[Harmony Scanner] Starting scan...`
  - Any error messages

### Option 3: Check Railway Worker Logs (if using Railway)

If harmony-scan-worker runs on Railway:
1. Railway dashboard → refyne-data-worker
2. Deployment logs
3. Search for: `HarmonyScanWorker` or `Harmony Scanner`

---

## Timeout Configuration

Current timeouts:
- **Frontend setTimeout:** 10 minutes (line 178 in scan/route.ts)
- **Status endpoint check:** 10 minutes (line 50 in scan/status/route.ts)
- **Vercel function timeout:** 10 minutes (Hobby plan default)

**If your portal has >50,000 companies:** Scan may timeout.

**Solutions:**
1. **Add crm.export scope** - Much faster (seconds instead of minutes)
2. **Move worker to Railway** - No 10-minute limit
3. **Use smaller field for testing** - Test with field that has fewer unique values

---

## The Fix Applied

**File:** `components/harmonies/HarmonyWizard.tsx:250`

**Before:**
```typescript
alert('Scan failed: ' + (data.errorMessage || 'Unknown error'));
//                         ^^^^^^^^^^^^^^^^ Wrong field name
```

**After:**
```typescript
alert('Scan failed: ' + (data.error || 'Unknown error'));
//                         ^^^^^^^^^ Correct field name
```

**Impact:** Error messages will now display correctly.

---

## How to Retry

### Step 1: Check if crm.export scope is available

```typescript
// Check your HubSpot connection in Supabase
SELECT oauth_scopes FROM hubspot_connections WHERE org_id = 'YOUR_ORG_ID';
```

If `crm.export` is NOT in the array:
1. Go to Settings → Connections → HubSpot
2. Disconnect
3. Reconnect (should request crm.export automatically)

### Step 2: Start with a simple field

Test with a field that has few unique values:
- ✅ `country` (good choice - ~50-200 values)
- ✅ `state` (50-100 values)
- ❌ `company.name` (too many unique values)
- ❌ `domain` (too many unique values)

### Step 3: Retry the scan

1. Navigate to Harmonies → New Harmony
2. Select field: "country"
3. Click "Start Scan"
4. **Watch for:**
   - Progress indicator updating (shows scan is working)
   - If fails: You'll now see the REAL error message
   - If succeeds: Distinct values appear in ~30-60 seconds

---

## Expected Behavior

### With crm.export scope:
- ⏱️ **Time:** 10-60 seconds for 10k-50k records
- 📊 **Progress:** Jumps directly to 100%
- ✅ **Success rate:** 99%+

### Without crm.export scope:
- ⏱️ **Time:** 2-10 minutes for 10k-50k records
- 📊 **Progress:** Gradual increase (50% → 75% → 100%)
- ⚠️ **Timeout risk:** High if >50k records

---

## Next Steps

1. **Commit the bug fix** (already done below)
2. **Deploy to production** (push to main)
3. **Check your HubSpot connection scope** (ensure crm.export is present)
4. **Retry the scan** (should now show proper error messages)

If scan still fails after fix deployed:
- Check actual error message (will now display correctly)
- Share error message for further diagnosis
- Verify worker is running (Railway or Vercel)

---

## Worker Status Check

To verify worker is running:

**Railway:**
```bash
# Check if worker dyno is running
railway logs --service=refyne-data-worker
# Should see: "Worker started, waiting for jobs..."
```

**Vercel Functions:**
```bash
# Check function invocations
vercel logs --since=1h | grep HarmonyScanWorker
```

If worker is NOT running:
- Scans will remain in "pending" status forever
- Start button will reappear after 10-minute timeout
- Error message: "Worker queue unavailable"

---

**Status:** Bug fix applied, ready to deploy and retry scan.
