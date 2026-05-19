# Admin Workspaces Dashboard

## Overview

The Admin Workspaces dashboard provides a read-only view of all workspaces across all organizations. This is a super admin feature that bypasses RLS (Row Level Security) to query all data.

## Security

- **Access Control**: Only users whose Clerk user ID matches `ADMIN_USER_ID` can access this route
- **404 Response**: Unauthorized users receive a 404 response (not 403) to hide the route's existence
- **Service Role Key**: Uses Supabase service role key to bypass RLS with explicit `org_id` filters
- **Read-Only**: No write operations are exposed in this interface

## Setup

1. Get your Clerk user ID:
   - Sign in to your application
   - Open browser DevTools → Console
   - Run: `window.Clerk.user.id`
   - Copy the user ID (starts with `user_`)

2. Add to environment variables:
   ```bash
   # In .env.local or Vercel environment variables
   ADMIN_USER_ID=user_xxxxxxxxxxxxxxxxxx
   ```

3. Ensure service role key is configured:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

## Routes

### List All Workspaces
**GET** `/admin/workspaces`

Displays a table of all workspaces with:
- Org name
- Plan (trialing, starter, growth, scale, enterprise)
- Status (active, trialing, past_due, cancelled, etc.)
- Compliance score (latest)
- Last scan time (from digest_runs)
- Active portals count (from hubspot_connections)
- Always On status
- Credits used/limit
- Joined date

**Summary Bar:**
- Total workspaces
- Active subscriptions
- Trialing count
- Total records monitored
- Digests sent this month

### Workspace Detail
**GET** `/admin/workspaces/[orgId]`

Drill-down view for a specific workspace showing:
- Recent digest runs (last 30)
- Compliance trend chart (30 days)
- Dedup pair history (last 100)
- Record statistics (compliant/stale/unprocessed breakdown)
- HubSpot connection details

## Data Sources

### workspace_entitlements
- `plan` - Subscription plan tier
- `subscription_status` - Current status
- `enrich_credits_used`, `enrich_credits_limit` - Credit metering
- `always_on_enabled`, `always_on_since` - Always On feature status
- `trial_ends_at`, `created_at` - Subscription lifecycle

### always_on_config
- Used to determine last scan time via `digest_runs`

### digest_runs
- `run_at` - Last scan timestamp
- `status` - Run status (completed, failed, skipped)
- `score_before`, `score_after`, `score_delta` - Compliance changes
- `new_pairs_detected`, `records_scanned` - Run metrics
- `digest_sent`, `slack_sent` - Notification status

### compliance_score_history
- `score`, `compliant`, `stale`, `unprocessed`, `total` - Score breakdown
- `computed_at` - Score timestamp

### hubspot_connections
- Portal count per org
- `portal_id`, `scopes`, `created_at`

### normalized_records
- Total records monitored per org
- Status breakdown (compliant/stale/unprocessed)

### dedup_pairs
- Deduplication history
- `confidence`, `status`, `created_at`

## API Endpoints

### GET /api/admin/workspaces
Returns all workspaces with summary metrics.

**Response:**
```json
{
  "workspaces": [
    {
      "org_id": "org_123",
      "org_name": "Acme Corp",
      "plan": "growth",
      "status": "active",
      "compliance_score": 87.5,
      "last_scan": "2026-05-18T10:00:00Z",
      "active_portals": 1,
      "always_on": true,
      "credits_used": 25,
      "credits_limit": 100,
      "joined_date": "2026-01-15T00:00:00Z",
      "records_monitored": 1250
    }
  ],
  "summary": {
    "total_workspaces": 42,
    "active_subscriptions": 28,
    "trialing": 14,
    "total_records_monitored": 52500,
    "digests_sent_this_month": 420
  }
}
```

### GET /api/admin/workspaces/[orgId]
Returns detailed information for a specific workspace.

**Response:**
```json
{
  "workspace": { ... },
  "digest_runs": [ ... ],
  "compliance_trend": [ ... ],
  "dedup_pairs": [ ... ],
  "hubspot_connections": [ ... ],
  "record_stats": {
    "compliant": 1000,
    "stale": 150,
    "unprocessed": 100,
    "total": 1250
  }
}
```

## Deployment

### Vercel Environment Variables

Add `ADMIN_USER_ID` to your Vercel project:

```bash
vercel env add ADMIN_USER_ID
# Enter your Clerk user ID when prompted
```

Or via Vercel Dashboard:
1. Project → Settings → Environment Variables
2. Add new variable:
   - Key: `ADMIN_USER_ID`
   - Value: `user_xxxxxxxxxxxxxxxxxx`
   - Environment: Production, Preview, Development

### Local Development

```bash
# In .env.local
ADMIN_USER_ID=user_xxxxxxxxxxxxxxxxxx
```

## Usage

1. Navigate to `/admin/workspaces` in your browser
2. If not authorized, you'll see a 404 page
3. If authorized, you'll see the workspaces table
4. Click any row to drill down into workspace details

## Notes

- **No RLS Bypass Needed**: Uses service role key with explicit `org_id` filters per query
- **Read-Only**: This is intentionally read-only to prevent accidental modifications
- **Performance**: Queries are optimized with indexes on `org_id` and timestamp fields
- **Security**: Returns 404 (not 403) to hide route existence from unauthorized users
