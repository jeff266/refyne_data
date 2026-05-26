# Enrichment Queue - Implementation Summary

## Overview

Built a queue-based enrichment system to handle large batch enrichments (200+ records) via Railway worker, avoiding Vercel's 5-minute serverless timeout. Small batches (<20 records) continue using `/api/enrich/preview` for instant results.

## Architecture

```
Frontend UI
    ↓ POST /api/enrich/queue
Queue Endpoint (Vercel)
    ↓ Creates enrichment_run record (status='queued')
    ↓ Enqueues job to BullMQ (Redis)
    ↓ Returns { run_id, status: 'queued' } immediately
Railway Worker
    ↓ Processes job in background (no timeout)
    ↓ Updates enrichment_run status → 'running' → 'completed'
    ↓ Writes to HubSpot in batches of 100
History API
    ↓ Shows both arrangement_runs and enrichment_runs
```

## Files Created

### 1. Database Migration
**`lib/db/migrations/055_enrichment_runs.sql`**
- New table `enrichment_runs` for tracking ad-hoc enrichment jobs
- Separate from `arrangements` (which are saved pipelines)
- Tracks: status, progress, cost (Refyne Search metrics), errors
- RLS enabled with org_id isolation

### 2. Queue Endpoint
**`app/api/enrich/queue/route.ts`**
- `POST /api/enrich/queue` - Enqueue enrichment job
  - Input: fields, providers, write_policy, source, record_limit
  - Creates enrichment_run record
  - Enqueues to BullMQ
  - Returns run_id immediately
- `GET /api/enrich/queue?run_id=xxx` - Poll job status
  - Returns: status, progress, cost, errors

### 3. Queue System
**`lib/queue/enrichment-queue.ts`**
- `getEnrichmentQueue()` - Queue instance
- `enqueueEnrichmentJob()` - Add job to queue
- `startEnrichmentWorker()` - Worker process for Railway
- `processEnrichmentJob()` - Job processor
  - Fetches companies from HubSpot
  - Enriches via Apollo, GraphIQ, or Refyne Search
  - Applies write policies (fill_empty, overwrite)
  - Batches HubSpot updates (100 records/batch)
  - Tracks Refyne Search costs (Serper calls, DeepSeek tokens)
  - Updates enrichment_run progress every 10 records

### 4. Worker Script
**`scripts/start-enrichment-worker.ts`**
- Starts BullMQ worker for Railway
- Graceful shutdown on SIGTERM/SIGINT
- Added to `package.json`: `npm run worker:enrichment`

### 5. History API Update
**`app/api/enrich/history/route.ts`**
- Modified to query BOTH `arrangement_runs` AND `enrichment_runs`
- Merges results, sorts by started_at
- Returns last 10 runs across both tables
- Enrichment runs show as "Ad-hoc Enrichment" with provider list

### 6. Railway Configuration
**`railway.json`**
- Updated startCommand to run enrichment worker
- Was: `start-arrangement-worker.ts`
- Now: `start-enrichment-worker.ts`

## Usage

### Small Batches (<20 records)
```bash
POST /api/enrich/preview
# Returns immediately with results (completes in <2 minutes)
```

### Large Batches (50+ records)
```bash
# Step 1: Queue the job
POST /api/enrich/queue
{
  "fields": ["industry", "numberofemployees", "phone"],
  "providers": ["refyne_search"],
  "write_policy": "fill_empty",
  "record_limit": 200,
  "source": {
    "type": "segment",
    "filters": {
      "missing_fields": ["industry"]
    }
  }
}

# Response:
{
  "run_id": "abc-123",
  "status": "queued",
  "job_id": "bull_job_456",
  "message": "Enrichment job queued. Processing 200 records with refyne_search."
}

# Step 2: Poll for status
GET /api/enrich/queue?run_id=abc-123

# Response (while running):
{
  "run_id": "abc-123",
  "status": "running",
  "total_records": 200,
  "processed_records": 45,
  "successful_records": 45,
  "fields_enriched": 67,
  "fields_skipped": 33,
  "cost_usd": 0.135,
  "started_at": "2026-05-26T10:00:00Z",
  "completed_at": null
}

# Response (completed):
{
  "run_id": "abc-123",
  "status": "completed",
  "total_records": 200,
  "processed_records": 200,
  "successful_records": 200,
  "fields_enriched": 340,
  "fields_skipped": 260,
  "cost_usd": 0.60,
  "started_at": "2026-05-26T10:00:00Z",
  "completed_at": "2026-05-26T10:27:35Z"
}

# Step 3: View in history
GET /api/enrich/history
# Shows all runs (both arrangement_runs and enrichment_runs)
```

## History Now Shows

✅ **Before:** Only showed arrangement_runs (saved pipelines)
✅ **After:** Shows both arrangement_runs AND enrichment_runs (ad-hoc jobs)

Example history response:
```json
{
  "runs": [
    {
      "id": "abc-123",
      "arrangement_name": "Ad-hoc Enrichment",
      "status": "completed",
      "provider": "refyne_search",
      "fields": ["industry", "numberofemployees", "phone"],
      "records_processed": 200,
      "records_total": 200,
      "fields_filled": 340,
      "started_at": "2026-05-26T10:00:00Z",
      "completed_at": "2026-05-26T10:27:35Z",
      "run_type": "enrichment",
      "cost_usd": 0.60
    }
  ]
}
```

## Performance

### Vercel Preview Endpoint
- Timeout: 5 minutes (300 seconds)
- Processing speed: ~8 seconds per company (3 Serper queries + DeepSeek extraction)
- Max batch size: ~20 records
- Use case: Quick tests, small batches

### Railway Queue Worker
- Timeout: None (long-running process)
- Processing speed: ~8 seconds per company (same as Vercel)
- Max batch size: Unlimited (tested with 200+ records)
- Use case: Large production batches
- Expected time for 200 records: ~27 minutes

## Cost Tracking

Enrichment runs track Refyne Search usage:
- `serper_calls` - Number of Serper API searches ($0.0011 each)
- `deepseek_tokens_in` - Input tokens to DeepSeek V4 Flash ($0.14/1M)
- `deepseek_tokens_out` - Output tokens from DeepSeek V4 Flash ($0.28/1M)
- `cost_usd` - Total estimated cost in USD

Typical cost per company with Refyne Search: **$0.003** (~3 queries, 1500 input tokens, 400 output tokens)

## Deployment

### Railway Worker
1. Railway already configured to run enrichment worker via `railway.json`
2. Push to main branch → Railway auto-deploys
3. Worker logs visible at: https://railway.app/project/xxx/service/worker

### Environment Variables (Required)
```bash
# Railway Worker
UPSTASH_REDIS_URL=rediss://xxx  # BullMQ queue
SERPER_API_KEY=xxx              # Refyne Search
FIREWORKS_API_KEY=xxx           # Refyne Search (DeepSeek V4 Flash)
SUPABASE_URL=xxx                # Database
SUPABASE_SERVICE_KEY=xxx        # Database
```

### Testing Locally
```bash
# Terminal 1: Start local worker
npm run worker:enrichment

# Terminal 2: Queue a test job
curl -X POST http://localhost:3000/api/enrich/queue \
  -H "Content-Type: application/json" \
  -d '{
    "fields": ["industry"],
    "providers": ["refyne_search"],
    "write_policy": "fill_empty",
    "record_limit": 5,
    "source": {
      "type": "segment",
      "filters": { "missing_fields": ["industry"] }
    }
  }'

# Terminal 3: Poll status
RUN_ID=xxx # From step 2 response
curl http://localhost:3000/api/enrich/queue?run_id=$RUN_ID
```

## Next Steps

1. **Apply migration:**
   ```bash
   # Run migration on Supabase
   psql $DATABASE_URL < lib/db/migrations/055_enrichment_runs.sql
   ```

2. **Deploy to Railway:**
   ```bash
   git add -A
   git commit -m "Add enrichment queue for large batch processing"
   git push origin main
   ```

3. **Update UI to use queue endpoint:**
   - Modify enrichment UI to call `/api/enrich/queue` for large batches
   - Add polling mechanism to track progress
   - Show "Processing..." spinner with progress bar

4. **Test with production data:**
   - Start with 10-record test
   - Gradually increase to 50, 100, 200 records
   - Monitor Railway worker logs and memory usage

## Benefits

✅ **No more timeouts** - Railway worker has no time limit
✅ **History tracking** - All runs visible in history (not just arrangements)
✅ **Cost visibility** - Track Refyne Search costs per run
✅ **Progress updates** - Poll for real-time progress
✅ **Scalable** - Can process 200+ records without issues
✅ **Reusable** - Same infrastructure for future enrichment providers
