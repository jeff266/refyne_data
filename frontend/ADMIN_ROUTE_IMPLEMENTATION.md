# Admin Route Implementation Summary

## Overview

A secure, read-only admin dashboard has been implemented at `/admin/workspaces` that shows all workspaces across all organizations. Access is restricted to a single admin user via environment variable.

## Files Created

### API Routes

1. **`/app/api/admin/workspaces/route.ts`**
   - Lists all workspaces with summary metrics
   - Validates admin user ID from `ADMIN_USER_ID` env var
   - Returns 404 for unauthorized users (hides route existence)
   - Uses service role key to bypass RLS

2. **`/app/api/admin/workspaces/[orgId]/route.ts`**
   - Returns detailed workspace information
   - Includes digest runs, compliance trends, dedup history
   - Same security model as main route

### Frontend Pages

3. **`/app/admin/workspaces/page.tsx`**
   - Main dashboard with workspaces table
   - Summary cards showing key metrics
   - Click-to-drill-down on table rows
   - Auto-redirects to home on 404 (unauthorized)

4. **`/app/admin/workspaces/[orgId]/page.tsx`**
   - Detailed workspace view
   - Compliance trend chart (Recharts)
   - Recent digest runs table
   - Dedup pair history
   - Record statistics

### Documentation

5. **`/docs/ADMIN_WORKSPACES.md`**
   - Complete documentation of the feature
   - API schemas and examples
   - Data source descriptions
   - Deployment instructions

6. **`/scripts/get-clerk-user-id.md`**
   - Step-by-step guide to get Clerk user ID
   - Multiple methods (console, dashboard, network)
   - Environment variable setup instructions

### Configuration

7. **Updated `.env.example`** (root)
   - Added `ADMIN_USER_ID` variable

8. **Updated `.env.local`** (frontend)
   - Added `ADMIN_USER_ID` variable

## Features Implemented

### Main Dashboard (`/admin/workspaces`)

**Summary Bar (Top):**
- Total workspaces
- Active subscriptions
- Trialing count
- Total records monitored
- Digests sent this month

**Table Columns:**
- Org name (with record count)
- Plan (trialing, starter, growth, scale, enterprise)
- Status (active, trialing, past_due, cancelled, etc.)
- Compliance score (latest, with color-coded icons)
- Last scan (from digest_runs, with status)
- Active portals (from hubspot_connections)
- Always On (enabled/since date)
- Credits (used/limit with progress bar)
- Joined date

**Interactions:**
- Click any row to view workspace details
- Color-coded status badges
- Visual indicators for compliance levels
- Progress bars for credit usage

### Workspace Detail (`/admin/workspaces/[orgId]`)

**Info Cards:**
- Subscription (plan + Stripe status)
- Credits (used/limit with progress bar)
- Records monitored (total + breakdown)

**Compliance Trend:**
- 30-day line chart
- Shows score over time
- Hover for details

**Recent Digest Runs:**
- Last 30 runs
- Status, score changes, new pairs detected
- Records scanned, notification status
- Visual indicators for success/failure

**Dedup Pair History:**
- Last 100 pairs
- Record IDs, confidence scores
- Status (merged, dismissed, pending)
- Created dates

## Security Model

### Access Control
- **Clerk Authentication Required**: Middleware protects all non-public routes
- **Admin User Check**: Only `ADMIN_USER_ID` can access
- **404 Response**: Unauthorized users get 404 (not 403) to hide route
- **Service Role Key**: Uses Supabase service role to bypass RLS

### No RLS Bypass Issues
- Uses service role key with explicit `org_id` filters
- No global queries without org context
- Read-only operations only
- No sensitive credentials exposed

## Data Sources

The dashboard queries the following tables:

### workspace_entitlements
- Core workspace metadata
- Subscription plan and status
- Credit limits and usage
- Trial lifecycle dates

### digest_runs
- Last scan timestamps
- Score changes per run
- Records scanned, pairs detected
- Notification delivery status

### compliance_score_history
- Historical compliance scores
- Trend data for charts
- Compliant/stale/unprocessed breakdowns

### hubspot_connections
- Active portal counts
- Connection metadata
- Scope information

### normalized_records
- Total records monitored per org
- Status breakdown (compliant/stale/unprocessed)

### dedup_pairs
- Deduplication history
- Confidence scores
- Merge/dismiss status

## Setup Instructions

### 1. Get Your Clerk User ID

**Browser Console Method:**
```javascript
console.log('Your Clerk User ID:', window.Clerk.user?.id);
```

Copy the output (starts with `user_`)

### 2. Set Environment Variable

**Local Development:**
```bash
# In frontend/.env.local
ADMIN_USER_ID=user_xxxxxxxxxxxxxxxxxx
```

**Vercel Production:**
```bash
vercel env add ADMIN_USER_ID
# Enter your user ID when prompted
```

Or via Vercel Dashboard:
- Settings → Environment Variables
- Add: `ADMIN_USER_ID` = `user_xxx...`
- Apply to: Production, Preview, Development

### 3. Ensure Service Role Key is Set

```bash
# Required for RLS bypass
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 4. Deploy or Restart

- Local: Restart dev server
- Vercel: Redeploy after adding env vars

## Testing

### Authorized Access
1. Sign in with the admin account
2. Navigate to `/admin/workspaces`
3. Should see the dashboard with all workspaces

### Unauthorized Access
1. Sign in with a different account
2. Navigate to `/admin/workspaces`
3. Should see a 404 page
4. No indication that the route exists

### Data Verification
- Check summary metrics match database counts
- Verify compliance scores are current
- Confirm last scan times are accurate
- Test drill-down to workspace details

## Performance Considerations

### Optimizations
- Queries use indexes on `org_id` and timestamp fields
- Pagination limits (30 digest runs, 100 dedup pairs)
- Summary bar uses aggregations, not full data pulls
- Chart data limited to 30 days

### Potential Improvements
- Add pagination for workspaces table (if >100 orgs)
- Cache summary metrics (refresh every 5 minutes)
- Add search/filter functionality
- Export to CSV option

## Monitoring

### Key Metrics to Watch
- API response times for `/api/admin/workspaces`
- Database query performance (use Supabase dashboard)
- Number of admin route accesses (add analytics)

### Logs to Check
- Unauthorized access attempts (404 responses)
- Failed database queries
- Missing environment variables

## Maintenance

### Updating Admin User
1. Update `ADMIN_USER_ID` in environment
2. Redeploy application
3. Previous admin loses access immediately

### Adding Multiple Admins
Current implementation supports one admin. To add multiple:

```typescript
// In route.ts, replace:
const adminUserId = process.env.ADMIN_USER_ID;
if (!adminUserId || userId !== adminUserId) {

// With:
const adminUserIds = process.env.ADMIN_USER_IDS?.split(',') || [];
if (!adminUserIds.includes(userId)) {
```

Then set:
```bash
ADMIN_USER_IDS=user_123,user_456,user_789
```

## Troubleshooting

### "Not found" 404 Error
- Verify `ADMIN_USER_ID` is set
- Check you're signed in with correct account
- Confirm env var matches your Clerk user ID
- Restart dev server (local) or redeploy (production)

### Missing Data
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set
- Check database has required tables
- Ensure RLS policies exist
- Review API error logs

### Empty Tables
- Normal if no data exists yet
- Check specific org has records
- Verify data is being inserted correctly

## Next Steps (Optional)

### Potential Enhancements
- [ ] Add search/filter for workspaces
- [ ] Export data to CSV
- [ ] Pagination for large datasets
- [ ] Real-time updates (WebSocket)
- [ ] Admin action logs (audit trail)
- [ ] Email alerts for critical metrics
- [ ] Multi-admin support
- [ ] Role-based admin permissions

### Advanced Features
- [ ] Workspace comparison tool
- [ ] Bulk operations (careful!)
- [ ] Custom date range filters
- [ ] Downloadable reports
- [ ] API key management
- [ ] Feature flag override

## Security Reminders

1. **Never commit** `.env.local` with real `ADMIN_USER_ID`
2. **Rotate** service role key if exposed
3. **Monitor** admin route access logs
4. **Limit** number of admin users (ideally 1-2)
5. **Use** strong Clerk MFA for admin accounts
6. **Test** unauthorized access regularly
7. **Review** this route during security audits

## Support

If you encounter issues:
1. Check environment variables are set
2. Review server logs for errors
3. Test with different Clerk accounts
4. Verify database permissions
5. Contact team if persistent issues
