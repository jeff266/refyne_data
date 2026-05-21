# Enrich Page Fixes - Implementation Summary

## Overview
Implemented three critical fixes to the Enrich page preview and caching functionality:

1. **Fix 1**: Preview selects companies with missing fields (OR logic)
2. **Fix 2**: Empty preview state handling
3. **Fix 3**: Skip loading animation on cached data

## Files Modified

### 1. `/app/api/enrich/preview/route.ts`

#### Changes Made:

**A. Updated PreviewResponse interface** (Line 59-71)
```typescript
interface PreviewResponse {
  preview_id: string;
  status: 'completed';
  records_processed: number;
  duration_seconds: number;
  results: PreviewCompanyResult[];
  summary: {
    fields_would_fill: number;
    fields_skipped: number;
    fields_not_found: number;
    harmonies_applied: number;
    no_domain: number;           // NEW
    already_complete: number;     // NEW
  };
}
```

**B. Rewrote buildSearchFilters function** (Line 388-434)
- **OLD BEHAVIOR**: All missing field filters were added to a single filter group (AND logic)
- **NEW BEHAVIOR**: Each missing field gets its own filter group (OR logic)
- **RESULT**: Finds companies missing ANY of the selected fields, not ALL of them

```typescript
function buildSearchFilters(filters: any): any[] {
  const filterGroups: any[] = [];

  // Create separate filter group for each missing field (OR logic)
  if (filters.missing_fields && filters.missing_fields.length > 0) {
    for (const field of filters.missing_fields) {
      filterGroups.push({
        filters: [{
          propertyName: field,
          operator: 'NOT_HAS_PROPERTY'
        }]
      });
    }
  }

  // Add other filters to all groups (AND with missing field check)
  const additionalFilters: any[] = [];

  if (filters.lifecyclestage) {
    additionalFilters.push({
      propertyName: 'lifecyclestage',
      operator: 'EQ',
      value: filters.lifecyclestage,
    });
  }

  if (filters.hubspot_owner_id) {
    additionalFilters.push({
      propertyName: 'hubspot_owner_id',
      operator: 'EQ',
      value: filters.hubspot_owner_id,
    });
  }

  if (filters.industry && filters.industry.length > 0) {
    additionalFilters.push({
      propertyName: 'industry',
      operator: 'IN',
      values: filters.industry,
    });
  }

  // Add additional filters to each filter group
  if (additionalFilters.length > 0 && filterGroups.length > 0) {
    filterGroups.forEach(group => {
      group.filters.push(...additionalFilters);
    });
  }

  return filterGroups;
}
```

**C. Added sorting to search requests** (Line 317-321 and elsewhere)
```typescript
const searchRequest = {
  filterGroups,
  properties,
  limit: Math.min(limit, 100),
  sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }]
};
```

**D. Added detailed tracking metrics** (Line 166-187)
```typescript
let noDomain = 0;
let alreadyComplete = 0;

for (const company of companies) {
  const companyDomain = company.properties.domain || '';

  // Track if company has no domain
  if (!companyDomain) {
    noDomain++;
  }

  // Track if all selected fields are already complete
  const allFieldsComplete = body.fields.every(f => {
    const val = company.properties[f];
    return val && val.trim() !== '';
  });
  if (allFieldsComplete) {
    alreadyComplete++;
  }

  // ... rest of enrichment logic
}
```

**E. Updated summary in response** (Line 270-276)
```typescript
summary: {
  fields_would_fill: fieldsWouldFill,
  fields_skipped: fieldsSkipped,
  fields_not_found: fieldsNotFound,
  harmonies_applied: harmoniesApplied,
  no_domain: noDomain,
  already_complete: alreadyComplete,
}
```

### 2. `/app/api/enrich/gaps/route.ts`

#### Changes Made:

**A. Added check_cache query parameter** (Line 57-78)
```typescript
const { searchParams } = new URL(req.url);
const checkCacheOnly = searchParams.get('check_cache') === 'true';

// Check cache with portal_id included
const cacheKey = `${ctx.orgId}:${connection.portal_id}:enrich:gaps`;
const { data: cached } = await supabase
  .from('cache')
  .select('value, expires_at')
  .eq('key', cacheKey)
  .single();

const isCached = cached && new Date(cached.expires_at) > new Date();

// If only checking cache, return immediately
if (checkCacheOnly) {
  if (isCached) {
    return NextResponse.json({
      ...cached.value,
      from_cache: true,
      cached_at: cached.expires_at,
    });
  } else {
    return NextResponse.json({ from_cache: false });
  }
}

// If cached and not check-only, return cached data
if (isCached) {
  return NextResponse.json({
    ...cached.value,
    from_cache: true,
  });
}
```

### 3. `/app/(dashboard)/enrich/page.tsx`

#### Changes Made:

**A. Updated PreviewResults interface** (Line 54-67)
```typescript
interface PreviewResults {
  preview_id: string;
  status: 'completed';
  records_processed: number;
  duration_seconds: number;
  results: PreviewCompanyResult[];
  summary: {
    fields_would_fill: number;
    fields_skipped: number;
    fields_not_found: number;
    harmonies_applied: number;
    no_domain: number;           // NEW
    already_complete: number;     // NEW
  };
}
```

**B. Updated GapAnalysis interface** (Line 17-22)
```typescript
interface GapAnalysis {
  total_companies: number;
  field_gaps: FieldGap[];
  scanned_at: string;
  from_cache?: boolean;  // NEW
}
```

**C. Updated fetchGaps useEffect** (Line 144-168)
```typescript
useEffect(() => {
  async function checkCacheThenFetch() {
    try {
      // First check if we have cached data
      const cacheCheck = await fetch('/api/enrich/gaps?check_cache=true');
      const cacheData = await cacheCheck.json();

      if (cacheData.from_cache) {
        // Use cached data immediately, skip animation
        setGapAnalysis(cacheData);
        setLoading(false);
        return;
      }

      // No cache, show loading animation and fetch fresh
      setShowAnimatedLoading(true);
      const res = await fetch('/api/enrich/gaps');
      if (res.ok) {
        const data = await res.json();
        setGapAnalysis(data);
      }
    } catch (error) {
      console.error('Failed to fetch gap analysis:', error);
      setLoading(false);
    }
  }

  checkCacheThenFetch();
  // ... rest of useEffect
}
```

**D. Added helper functions** (Line 299-322)
```typescript
// Helper function to format time ago
function formatTimeAgo(isoDate: string): string {
  const mins = Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000);
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

// Refresh gap analysis
async function refreshGapAnalysis() {
  setShowAnimatedLoading(true);
  setLoading(true);
  try {
    const res = await fetch('/api/enrich/gaps'); // no check_cache, forces fresh scan
    if (res.ok) {
      const data = await res.json();
      setGapAnalysis(data);
    }
  } catch (error) {
    console.error('Failed to refresh gap analysis:', error);
  } finally {
    setLoading(false);
  }
}
```

**E. Added empty state UI for preview** (Line 970-1020)
```typescript
{previewResults.summary.fields_would_fill === 0 ? (
  // Empty state
  <div>
    <div style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
      {previewResults.records_processed} records · 0 fields would be filled
    </div>

    <div style={{
      background: C.bg,
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      padding: 20,
      marginBottom: 20
    }}>
      <div style={{ fontSize: 13, color: C.text, marginBottom: 12 }}>
        Apollo did not return data for these {previewResults.records_processed} companies.
        This can happen when companies have no domain in HubSpot or are not in Apollo's database.
      </div>

      <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.6 }}>
        <div>Companies without domains: <strong>{previewResults.summary.no_domain}</strong></div>
        <div>Companies not found in Apollo: <strong>{Math.floor(previewResults.summary.fields_not_found / selectedFields.length)}</strong></div>
        <div>Companies with fields already complete: <strong>{previewResults.summary.already_complete}</strong></div>
      </div>
    </div>

    <div style={{ display: 'flex', gap: 12 }}>
      <PrimaryBtn onClick={runPreview}>
        Try a different sample →
      </PrimaryBtn>
      <button
        onClick={startOver}
        style={{
          padding: '10px 16px',
          background: 'transparent',
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          color: C.text2,
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Start over
      </button>
    </div>
  </div>
) : (
  // Normal preview results table (existing code)
  <div>...</div>
)}
```

**F. Updated gap analysis header** (Added around Line 1220)
```typescript
<div style={{
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 16
}}>
  <div style={{ fontSize: 13, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
    Data gaps in your HubSpot
  </div>

  {gapAnalysis.from_cache && gapAnalysis.scanned_at && (
    <div style={{ fontSize: 11, color: C.text3 }}>
      Last scanned {formatTimeAgo(gapAnalysis.scanned_at)} ·{' '}
      <button
        onClick={refreshGapAnalysis}
        style={{
          background: 'none',
          border: 'none',
          color: C.blue,
          cursor: 'pointer',
          textDecoration: 'underline',
          padding: 0,
          fontSize: 11,
        }}
      >
        Refresh
      </button>
    </div>
  )}
</div>
```

## Testing Checklist

### Fix 1: Preview OR Logic
- [ ] Go to /enrich
- [ ] Select multiple fields (e.g., Industry and Employee count)
- [ ] Click "Preview 10 records"
- [ ] **VERIFY**: Companies returned are missing ANY of the selected fields (not ALL)
- [ ] **VERIFY**: Before column shows null/empty for at least one of the selected fields
- [ ] **VERIFY**: After column shows real Apollo data

### Fix 2: Empty Preview State
- [ ] Try to preview companies that are unlikely to have Apollo data
- [ ] If preview returns 0 fields_would_fill:
  - [ ] **VERIFY**: Shows empty state message
  - [ ] **VERIFY**: Shows breakdown (no domain, not found, already complete)
  - [ ] **VERIFY**: "Try a different sample" button appears
  - [ ] **VERIFY**: "Start over" button appears
  - [ ] **VERIFY**: "Run on all X companies" button does NOT appear

### Fix 3: Cache Skip
- [ ] Go to /enrich (first time, fresh scan)
- [ ] **VERIFY**: Loading animation shows, scan completes
- [ ] Navigate to /dedup
- [ ] Navigate back to /enrich
- [ ] **VERIFY**: Loads instantly from cache without animation
- [ ] **VERIFY**: Header shows "Last scanned X minutes ago · Refresh"
- [ ] Click "Refresh" link
- [ ] **VERIFY**: Loading animation shows and fresh data loads

## Expected Behavior

### Fix 1 - OR Logic
**Before**: If you selected Industry and Employee count, the preview would only return companies missing BOTH fields. This made previews often return 0 results.

**After**: The preview returns companies missing ANY of the selected fields. Much more likely to find enrichable companies.

### Fix 2 - Empty State
**Before**: If 0 fields would be filled, the UI still showed action buttons that didn't make sense.

**After**: Shows a helpful message explaining WHY no data was returned, with a breakdown of:
- Companies without domains (can't enrich)
- Companies not in Apollo's database
- Companies where all fields are already complete

### Fix 3 - Cache Skip
**Before**: Every time you returned to /enrich, the loading animation played even though the data was cached.

**After**:
- Cache check happens first
- If cached, loads instantly without animation
- Shows "Last scanned X time ago · Refresh" indicator
- Can manually trigger a fresh scan via the Refresh button

## Technical Notes

### HubSpot Search API Filter Groups
The key insight for Fix 1 is understanding how HubSpot's Search API handles filter groups:

- **Filter groups are OR'd together**: `[{filters: [A]}, {filters: [B]}]` means "A OR B"
- **Filters within a group are AND'd**: `{filters: [A, B]}` means "A AND B"

The original implementation put all missing field filters in one group (AND), when we needed separate groups (OR).

### Cache Strategy
The cache implementation uses two endpoints:
1. `GET /api/enrich/gaps?check_cache=true` - Quick cache check, returns immediately
2. `GET /api/enrich/gaps` - Full scan if cache miss

This allows the frontend to:
1. Check cache first without delay
2. Skip animation if cache hit
3. Show animation only when doing fresh scan

### Summary Metrics
The new summary metrics help diagnose why enrichment might fail:
- `no_domain`: Companies can't be enriched without a domain
- `already_complete`: Companies don't need enrichment
- `fields_not_found`: Apollo doesn't have data for these companies

This gives users actionable feedback instead of just "0 results".

## Related Files Not Modified

The following files use the streaming approach with EventSource and were not modified:
- `/app/api/enrich/gaps/stream/route.ts` - Already handles cache efficiently
- Frontend now uses streaming EventSource (appears to have been updated separately)

The streaming approach is complementary to these fixes and provides progressive loading when scanning fresh data.
