# Dedup Merge History - Auditability Guide

## Overview

Every dedup merge is now fully auditable with complete before/after snapshots. When you merge duplicate companies, Refyne captures:

- **Pre-merge snapshots**: Complete field values from both records before merge
- **Post-merge result**: Final field values after merge completes
- **Field selections**: Which fields were chosen from which source
- **Metadata**: Who merged, when, confidence score

## How It Works

### During Merge

1. **Before merging**, Refyne fetches complete data for all records in the cluster
2. **Performs the merge** in HubSpot (using HubSpot's native merge API)
3. **After merge completes**, fetches the final state of the master record
4. **Saves history entry** to `dedup_merge_history` table with all snapshots

### History Entry Contains

```typescript
{
  id: uuid,
  org_id: string,
  cluster_id: uuid,

  // Who and when
  merged_by: string,           // Clerk user ID
  merged_by_name: string,      // Display name
  merged_at: timestamp,
  merge_method: 'manual' | 'auto' | 'bulk',

  // Record IDs
  survivor_record_id: string,  // HubSpot company ID that survived
  merged_record_id: string,    // HubSpot company ID that was merged away

  // Snapshots (complete field values)
  survivor_snapshot: jsonb,    // Before merge
  merged_snapshot: jsonb,      // Before deletion
  result_snapshot: jsonb,      // After merge

  // Selection tracking
  field_selections: jsonb,     // { "domain": "survivor", "phone": "merged", ... }

  // Metadata
  confidence_score: number,
  similarity_signals: string[]
}
```

## Viewing Merge History

### In the UI

1. Navigate to **Dedup → Review queue**
2. Filter by **"Merged"** status
3. Click on any merged cluster
4. You'll see a **"Merge History"** section at the top
5. Click to expand each merge event to see field-by-field comparison

### History Timeline

Each merge event shows:

- **Timestamp**: When the merge occurred
- **Merge method**: Manual, auto, or bulk
- **Who merged**: User name (if available)
- **Records involved**: Survivor and merged record IDs
- **Field count**: Number of fields that changed

### Field Comparison Table

When you expand a merge event, you see:

| Field | Before (Survivor) | Before (Merged) | After (Result) | Source |
|-------|-------------------|-----------------|----------------|--------|
| domain | acme.com | acme.com | acme.com | same |
| phone | +1234567890 | +0987654321 | +1234567890 | survivor |
| industry | (empty) | Technology | Technology | merged |

**Source badges:**
- **Survivor** (blue): Value came from the master record
- **Merged** (green): Value came from the merged-away record
- **Same** (gray): Both records had the same value
- **Custom** (amber): Value was edited during merge

## Use Cases

### 1. Verify Merge Quality

After merging duplicates, check the history to ensure:
- Correct fields were preserved
- No data was lost
- Field selections match expectations

### 2. Audit Trail for Compliance

Full audit trail showing:
- Who performed each merge
- Exactly what changed
- When it happened
- Complete before/after state

### 3. Rollback Decisions

While we don't auto-rollback merges (since HubSpot's merge is irreversible), the history helps you:
- Manually recreate records if needed
- Understand what was lost
- Make informed decisions about re-creating data

### 4. Training and Quality Assurance

Review merge history to:
- Train team members on proper merge procedures
- Identify patterns of mistakes
- Improve dedup rules based on actual outcomes

## API Access

### Get Merge History

```bash
GET /api/dedup/clusters/{clusterId}/history
```

Response:
```json
{
  "history": [
    {
      "id": "...",
      "merged_by_name": "John Doe",
      "merged_at": "2026-05-20T12:00:00Z",
      "humanReadableTime": "May 20, 2026, 12:00 PM",
      "survivor_record_id": "12345",
      "merged_record_id": "67890",
      "merge_method": "manual",
      "confidence_score": 95,
      "fieldDiff": {
        "domain": {
          "survivorValue": "acme.com",
          "mergedValue": "acme.com",
          "resultValue": "acme.com",
          "source": "same",
          "changed": false
        },
        "phone": {
          "survivorValue": "+1234567890",
          "mergedValue": "+0987654321",
          "resultValue": "+1234567890",
          "source": "survivor",
          "changed": true
        }
      }
    }
  ],
  "count": 1
}
```

## Database Schema

### Table: `dedup_merge_history`

```sql
CREATE TABLE dedup_merge_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  cluster_id uuid,
  merged_by text NOT NULL,
  merged_by_name text,
  merged_at timestamptz NOT NULL DEFAULT now(),
  merge_method text NOT NULL CHECK (merge_method IN ('manual', 'auto', 'bulk')),
  survivor_record_id text NOT NULL,
  merged_record_id text NOT NULL,
  survivor_snapshot jsonb NOT NULL,
  merged_snapshot jsonb NOT NULL,
  result_snapshot jsonb NOT NULL,
  field_selections jsonb,
  confidence_score numeric(5,2),
  similarity_signals text[],
  notes text
);
```

**Indexes:**
- `dedup_merge_history_org` on `org_id`
- `dedup_merge_history_cluster` on `cluster_id`
- `dedup_merge_history_merged_at` on `merged_at DESC`
- `dedup_merge_history_survivor` on `survivor_record_id`

**RLS Enabled**: Only members of the org can view their org's merge history.

## Best Practices

### For Admins

1. **Review merge history regularly** to ensure quality
2. **Train users** by showing examples of good vs bad merges
3. **Monitor for patterns** of repeated mistakes
4. **Keep history forever** - disk is cheap, data recovery is expensive

### For Operators

1. **Double-check before merging** - history helps, but prevention is better
2. **Use field selections carefully** - prefer survivor when in doubt
3. **Add notes** when merging unusual cases (future enhancement)
4. **Review your own merges** to improve decision-making

## Future Enhancements

- **Undo merge**: Use history to recreate merged-away record
- **Merge notes**: Add context about why merge was performed
- **Export history**: Download merge history as CSV for external audits
- **Change detection**: Alert when specific fields are unexpectedly overwritten
- **Bulk history**: Summary view for bulk merge operations

## Migration

Apply migration 036:

```bash
cd frontend
psql $DATABASE_URL -f lib/db/migrations/036_dedup_merge_history.sql
```

Or via Supabase dashboard:
1. Go to SQL Editor
2. Paste contents of `lib/db/migrations/036_dedup_merge_history.sql`
3. Run query

## Troubleshooting

### History not showing

**Symptom**: Merged cluster shows no history

**Causes**:
1. Merge was performed before migration 036
2. History save failed (check server logs)
3. RLS policy blocking access

**Solution**: Check server logs for `[Merge History] Failed to save history` messages

### Performance concerns

**Symptom**: History endpoint slow with many merges

**Solution**:
- Pagination coming soon
- For now, snapshots are indexed by `merged_at DESC`
- Most recent merges load first

### Missing field data

**Symptom**: Some fields show as `(empty)` in history

**Cause**: Field wasn't returned by HubSpot API at snapshot time

**Expected behavior**: This is normal for truly empty fields
