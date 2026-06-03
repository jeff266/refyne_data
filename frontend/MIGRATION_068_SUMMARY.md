# Migration 068: Add object_type to arrangement_runs and enrichment_runs

## Problem
The enrich history endpoint was failing with database errors:
- `column arrangement_runs.object_type does not exist`
- `column enrichment_runs.object_type does not exist`

## Solution
Created migration 068 to add the `object_type` column to both tables with:
- Default value of 'company' for backward compatibility
- Indexed for query performance
- Composite indexes for common query patterns

## Files Changed

### Migration Files Created
1. `/lib/db/migrations/068_add_object_type_to_runs.sql`
2. `/supabase/migrations/20260602120000_068_add_object_type_to_runs.sql`

### Code Updated - INSERT Statements
1. `/app/api/enrich/apply/route.ts` - Added `object_type: 'company'` to arrangement_runs insert
2. `/app/api/arrangements/[id]/run/route.ts` - Added `object_type: 'company'` to arrangement_runs insert
3. `/app/api/arrangements/[id]/rehearse/route.ts` - Added `object_type: 'company'` to arrangement_runs insert
4. `/app/api/enrich/queue/route.ts` - Added `object_type: 'company'` to enrichment_runs insert
5. `/scripts/test-arrangement-pipeline.ts` - Added `object_type: 'company'` to test script

### Code Already Correct
1. `/app/api/enrich/preview/enqueue/route.ts` - Already had `object_type: objectType` (line 50)
2. `/app/api/enrich/apply/enqueue/route.ts` - Already had `object_type: objectType` (line 74)

### Query Already Updated
1. `/app/api/enrich/history/route.ts` - Already includes `object_type` in SELECT and WHERE clauses (lines 48, 56, 64)

## Migration Details

The migration adds:
- `object_type TEXT NOT NULL DEFAULT 'company'` to both tables
- Indexes:
  - `idx_arrangement_runs_object_type` on (org_id, object_type)
  - `idx_enrichment_runs_object_type` on (org_id, object_type)
  - `idx_arrangement_runs_org_object_started` on (org_id, object_type, started_at DESC)
  - `idx_enrichment_runs_org_object_started` on (org_id, object_type, started_at DESC)

## Next Steps

1. Run the migration on your Supabase instance:
   ```sql
   -- Execute the migration file content
   ```

2. Verify the migration:
   ```sql
   -- Check columns exist
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns 
   WHERE table_name IN ('arrangement_runs', 'enrichment_runs') 
   AND column_name = 'object_type';
   
   -- Check indexes
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE tablename IN ('arrangement_runs', 'enrichment_runs') 
   AND indexname LIKE '%object_type%';
   ```

3. Test the history endpoint:
   ```bash
   curl -X GET "https://your-app.com/api/enrich/history?objectType=company"
   ```

## Backward Compatibility

All existing rows will automatically get `object_type = 'company'` due to the DEFAULT constraint. All new inserts default to 'company' unless explicitly set to 'contact' or 'deal'.
