# Dashboard Troubleshooting Guide

## Quick Diagnostics

### 1. Check if Dashboard Page Loads
```bash
# Visit the dashboard
open http://localhost:3000/dashboard

# Look for these in browser console:
- Any red errors?
- Any import errors?
- Any "Failed to fetch" errors?
```

### 2. Test API Endpoints
```bash
# Run automated tests
npx tsx scripts/test-dashboard-apis.ts

# Or manually test each endpoint:
curl http://localhost:3000/api/dashboard/summary
curl http://localhost:3000/api/dashboard/fill-rates?objectType=company
curl http://localhost:3000/api/dashboard/fill-rates?objectType=contact
curl http://localhost:3000/api/settings/always-on-status
```

### 3. Check Server Logs
```bash
# Start dev server with verbose logging
npm run dev

# Look for these error patterns:
[dashboard/summary] ...
[dashboard/fill-rates] ...
[Issue Detector] ...
```

## Common Issues

### Issue: Blank Dashboard
**Symptoms:** Page loads but nothing renders

**Possible Causes:**
1. ✅ **FIXED:** Illegal server-side import in client component
2. Component throwing error (should show error boundary)
3. Auth failure (should redirect)
4. API endpoints not responding

**Debugging:**
```javascript
// Check browser console for errors
// Look for React error messages
// Check Network tab for failed API calls
```

**Fix:**
- Error boundaries should catch component errors
- Check auth state with Clerk
- Verify API routes are returning data

---

### Issue: HubSpot API Errors
**Symptoms:** Logs show "There was a problem with the request" or "searchRecords failed"

**Possible Causes:**
1. ✅ **FIXED:** Invalid property names in HubSpot API calls
2. Rate limiting (429 errors)
3. Invalid access token
4. Property doesn't exist in portal

**Debugging:**
```bash
# Check which property is failing
grep "HubSpot search failed" logs

# Check rate limit status
grep "X-HubSpot-RateLimit" logs

# Test token validity
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.hubapi.com/crm/v3/objects/companies?limit=1
```

**Fix:**
- ✅ Error handling now catches and logs these errors
- Returns 0 count instead of crashing
- Check HubSpot property names match actual properties

---

### Issue: Field Coverage Shows "No data"
**Symptoms:** Field Coverage section empty or shows error message

**Possible Causes:**
1. HubSpot API returning errors
2. No access token
3. Property names don't exist in portal
4. Network errors

**Debugging:**
```bash
# Check fill-rates endpoint directly
curl http://localhost:3000/api/dashboard/fill-rates?objectType=company

# Look for detailed error logs
grep "\[dashboard/fill-rates\]" logs
```

**Fix:**
- ✅ Now shows specific error message instead of blank
- ✅ Logs field names being requested
- Verify property names in `app/api/dashboard/fill-rates/route.ts` match your HubSpot portal

---

### Issue: Since Yesterday Shows "Nothing new"
**Symptoms:** All stats show 0 even though data was processed

**Possible Causes:**
1. No data in last 24 hours (expected behavior)
2. Database queries returning empty results
3. Timestamps in wrong timezone

**Debugging:**
```bash
# Check summary endpoint
curl http://localhost:3000/api/dashboard/summary

# Should return:
{
  "lastNight": {
    "recordsNormalized": 0,
    "dupesFound": 0,
    "fieldsFilled": 0,
    "importsProcessed": 0
  },
  "pendingAttention": []
}
```

**Fix:**
- If data exists, check database table timestamps
- Verify queries in `app/api/dashboard/summary/route.ts`
- Check timezone handling

---

### Issue: Needs Attention Section Missing
**Symptoms:** Section doesn't render at all

**Possible Causes:**
1. No pending items (expected - component returns null)
2. API error (should show error boundary)

**Debugging:**
```javascript
// Check component logic
// NeedsAttentionSection returns null if items.length === 0
```

**Fix:**
- This is expected behavior if there are no attention items
- Component only renders when there are items to show

## Error Boundary Testing

To test error boundaries are working:

1. **Simulate Component Error:**
```typescript
// Temporarily add to any dashboard component:
throw new Error('Test error boundary');
```

2. **Expected Behavior:**
- Error boundary catches error
- Shows fallback UI with error message
- Shows "Reload page" button
- Other sections continue to work

3. **Verify:**
- No blank screen
- Error is logged to console
- Sentry captures error (if configured)

## Performance Monitoring

### Check Redis Cache
```bash
# Summary endpoint should use cache
curl http://localhost:3000/api/dashboard/summary

# Check logs for cache hit:
# [dashboard/summary] Cache hit

# Force refresh:
curl "http://localhost:3000/api/dashboard/summary?refresh=true"
```

### Check API Response Times
```bash
# Use browser DevTools Network tab
# Or use curl with timing:
curl -w "@curl-format.txt" -o /dev/null -s \
  http://localhost:3000/api/dashboard/summary
```

Create `curl-format.txt`:
```
time_namelookup:  %{time_namelookup}\n
time_connect:     %{time_connect}\n
time_total:       %{time_total}\n
```

## Environment Checklist

- [ ] `NEXT_PUBLIC_APP_URL` is set
- [ ] HubSpot connection is active
- [ ] Access token is valid
- [ ] Supabase connection works
- [ ] Redis connection works (optional but recommended)
- [ ] Clerk auth is configured

## Component Hierarchy

```
DashboardPage (Server Component)
├── StatCards (Server, Suspense)
├── OnboardingWrapper (Client)
├── DashboardErrorBoundary
│   └── DashboardTopSection (Client)
│       ├── AlwaysOnUpsell (if not enabled)
│       └── SinceYesterdaySection (if enabled)
├── DashboardErrorBoundary
│   └── FieldCoverageSection (Client)
├── DashboardErrorBoundary
│   └── NeedsAttentionSection (Client)
├── ClientData (Server, Suspense)
├── HarmonyBarsSection (Server, Suspense)
├── TrendChartSection (Server, Suspense)
├── InsightsSection (Server, Suspense)
├── PortalsSection (Server, Suspense)
└── ComplianceAIOverview (Client)
```

## API Dependencies

```
DashboardTopSection
├── GET /api/settings/always-on-status
└── GET /api/dashboard/summary (if not enabled)

SinceYesterdaySection
└── GET /api/dashboard/summary

FieldCoverageSection
├── GET /api/dashboard/fill-rates?objectType=company
└── GET /api/dashboard/fill-rates?objectType=contact

NeedsAttentionSection
└── GET /api/dashboard/summary

/api/dashboard/fill-rates
├── HubSpot API: GET /crm/v3/objects/{objectType}
└── Depends on: HubSpot access token

/api/dashboard/summary
├── Supabase: normalization_runs
├── Supabase: dedup_clusters
├── Supabase: arrangement_run_progress
├── Supabase: event_imports
├── Supabase: dedup_pairs
├── Supabase: arrangements
└── Redis: Cache (15 min TTL)
```

## Next Steps After Fix

1. ✅ Verify dashboard loads without errors
2. ✅ Check all sections render
3. ✅ Test error boundaries work
4. ✅ Monitor HubSpot API errors
5. [ ] Add caching to fill-rates endpoint
6. [ ] Add retry logic for transient failures
7. [ ] Add more specific error messages
8. [ ] Add loading skeletons for better UX
9. [ ] Add Sentry error tracking
10. [ ] Add performance monitoring
