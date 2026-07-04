# Data Health Historical Tracking

## Overview

Automated daily snapshots of data health metrics enable week-over-week trend analysis on the dashboard.

## Architecture

### Database Table: `data_health_snapshots`

Stores daily snapshots with:
- `org_id` - Organization identifier
- `snapshot_date` - Date of snapshot (one per org per day)
- `data_health_score` - Calculated health score (0-100)
- `company_count` - Total companies
- `contact_count` - Total contacts
- `normalize_issues` - Pending normalization issues
- `dedup_clusters` - Open dedup clusters
- `enrich_credits_used` / `enrich_credits_total` - Enrichment usage

### Daily Snapshot Worker

**Script:** `scripts/capture-data-health-snapshot.ts`

Runs daily at midnight UTC via GitHub Actions, calculating and storing metrics for all orgs.

**Features:**
- Queries all active orgs from `workspace_entitlements`
- Calculates real-time metrics for each org
- Upserts snapshot (insert or update if exists for that date)
- Logs success/failure for each org

### Dashboard Integration

**File:** `app/(dashboard)/dashboard/page.tsx`

Dashboard queries historical snapshot from 7 days ago to calculate delta:

```typescript
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

const { data: historicalSnapshot } = await supabaseAdmin
  .from('data_health_snapshots')
  .select('data_health_score')
  .eq('org_id', orgId)
  .lte('snapshot_date', sevenDaysAgoDate)
  .order('snapshot_date', { ascending: false })
  .limit(1)
  .single();

const dataHealthDelta = historicalSnapshot
  ? dataHealthScore - historicalSnapshot.data_health_score
  : 0;
```

Displays:
- Green ▲ for positive change
- Red ▼ for negative change
- Hidden when delta is 0

## Setup

### 1. Run Migration

Apply migration 083 to create the table:

```bash
# In Supabase SQL editor
cat lib/db/migrations/083_data_health_snapshots.sql
```

Or use Supabase CLI:

```bash
supabase db push
```

### 2. Verify GitHub Actions Secrets

Ensure these secrets are set in GitHub repository settings:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 3. Initial Snapshot (Optional)

Manually capture first snapshot:

```bash
cd frontend
npm run snapshot:capture
```

### 4. Test

Workflow runs automatically daily at midnight UTC, or trigger manually:

```bash
# Via GitHub UI: Actions → Daily Data Health Snapshot → Run workflow
```

## Manual Usage

### Capture Snapshot

```bash
cd frontend
npm run snapshot:capture
```

### Query Snapshots

```sql
-- Last 7 days for an org
SELECT
  snapshot_date,
  data_health_score,
  company_count,
  normalize_issues
FROM data_health_snapshots
WHERE org_id = 'org_xxx'
ORDER BY snapshot_date DESC
LIMIT 7;

-- All orgs today
SELECT
  org_id,
  data_health_score,
  company_count + contact_count as total_records
FROM data_health_snapshots
WHERE snapshot_date = CURRENT_DATE
ORDER BY data_health_score ASC;
```

## Monitoring

Check GitHub Actions runs:
- Navigate to **Actions** → **Daily Data Health Snapshot**
- View logs for success/failure per org
- Alerts sent if workflow fails

## Future Enhancements

- [ ] Weekly/monthly rollup tables for long-term trends
- [ ] Alert on significant drops in data health
- [ ] Historical charts on dashboard
- [ ] Export snapshots to CSV
- [ ] Retention policy (keep 90 days by default)
