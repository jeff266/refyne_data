# Dashboard Data Sources - What Fills What?

## Current State (The Problem)

The dashboard shows **zeros** for RevOps Impact because the data sources haven't been populated yet.

## Data Source Breakdown

### 1. **Companies / Contacts Count**

**Current Query:**
```sql
SELECT COUNT(*) FROM normalized_records
WHERE org_id = ? AND record_type = 'company'
```

**Problem:** `normalized_records` is for **compliance tracking only**. It only contains records that have been:
- Scanned by compliance scanner
- Processed through normalization

**What fills it:**
- Manual compliance scan (doesn't exist yet)
- Normalize Apply (creates records for fields that were normalized)

**Result:** If you've never run compliance scan or normalized records, this table is **EMPTY** → shows 0 companies/contacts

**Fix Needed:** Query HubSpot API directly for counts OR create cached count table

---

### 2. **Dedup Clusters**

**Current Query:**
```sql
SELECT COUNT(*) FROM dedup_clusters
WHERE org_id = ? AND status = 'open'
```

**What fills it:**
- ✅ Manual dedup scan: Click "Scan for duplicates" in `/dedup`
- ✅ Nightly dedup worker: `npm run worker:dedup` (if configured)
- ✅ Webhook-triggered scans: When companies are created/updated

**Result:** Shows 0 until you run first dedup scan

---

### 3. **Normalize Issues (Active Harmonies)**

**Current Query:**
```sql
SELECT COUNT(*) FROM harmony_field_assignments
WHERE org_id = ? AND is_active = true
```

**What fills it:**
- ✅ Creating/activating harmonies in `/harmonies`
- ✅ Auto-created during HubSpot onboarding

**Result:** Shows count of active standardization rules

**Note:** This is NOT the count of records needing normalization (that requires HubSpot query)

---

### 4. **Recent Activity**

**Current Query:**
```sql
SELECT * FROM normalization_runs WHERE org_id = ?
UNION
SELECT * FROM dedup_scan_runs WHERE org_id = ?
ORDER BY created_at DESC LIMIT 4
```

**What fills it:**
- ✅ `normalization_runs`: Created when you click Apply in `/normalize`
- ✅ `dedup_scan_runs`: Created when you run dedup scan (manual or scheduled)

**Result:** Shows empty until you run normalize or dedup at least once

---

### 5. **Dedup Merges / Normalize Writes**

**Current Query:**
```sql
-- Dedup merges
SELECT COUNT(*) FROM dedup_merge_history WHERE org_id = ?

-- Normalize writes
SELECT COUNT(*) FROM normalization_run_progress
WHERE org_id = ? AND status = 'completed'
```

**What fills it:**
- ✅ `dedup_merge_history`: Created when you merge duplicate clusters
- ✅ `normalization_run_progress`: Created when normalize writes to HubSpot

**Result:** Shows 0 until you've merged duplicates or applied normalizations

---

## Why RevOps Impact Shows All Zeros

For a **new/fresh workspace**, all zeros means:

1. ❌ **No HubSpot data synced** → `normalized_records` is empty
2. ❌ **No dedup scan run** → `dedup_clusters` is empty
3. ✅ **May have active harmonies** → Shows count if harmonies configured
4. ❌ **No normalize/dedup executed** → Activity logs empty
5. ❌ **No merges/writes** → Usage counters at 0

## Fixes Required

### Immediate Fix: Company/Contact Counts

Replace `normalized_records` query with HubSpot API call:

```typescript
// Call HubSpot search with count_only
const response = await hubspot.get('/crm/v3/objects/companies/search', {
  limit: 1,
  properties: []
});
const companyCount = response.total;
```

Or create a cached counts table that updates on sync.

### Medium-term: Initial Data Population

Create onboarding flow that:
1. Syncs HubSpot records to cache table
2. Runs initial dedup scan
3. Populates initial counts

### Long-term: Real-time Sync

Use HubSpot webhooks to keep counts updated in real-time.

---

## Testing Your Dashboard

### Step 1: Populate Company/Contact Counts
**Option A:** Query HubSpot directly (requires API fix)
**Option B:** Run compliance scan (if available)
**Option C:** Apply at least one normalization (creates records in `normalized_records`)

### Step 2: Populate Dedup Clusters
```bash
# Go to /dedup page and click "Scan for duplicates"
# OR run worker:
npm run worker:dedup
```

### Step 3: Populate Recent Activity
1. Go to `/normalize` and click "Apply"
2. Go to `/dedup` and run a scan

### Step 4: Populate Merge/Write Counts
1. Merge some duplicate clusters in `/dedup`
2. Apply normalization changes in `/normalize`

---

## Current vs Correct Data Sources

| Metric | Current Source | Status | Should Be |
|--------|---------------|--------|-----------|
| Companies | `normalized_records` | ❌ Wrong | HubSpot API or cached table |
| Contacts | `normalized_records` | ❌ Wrong | HubSpot API or cached table |
| Dedup Clusters | `dedup_clusters` | ✅ Correct | - |
| Normalize Issues | `harmony_field_assignments` | ✅ Correct | - |
| Recent Activity | Run logs | ✅ Correct | - |
| Dedup Merges | `dedup_merge_history` | ✅ Correct | - |
| Normalize Writes | `normalization_run_progress` | ✅ Correct | - |
