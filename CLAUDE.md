# Enrichment Switcher - Claude Context

## HubSpot Portals

### Frontera Health
Token: `pat-na1-9fbd00e9-d997-4cc0-a567-c96095476522`
Service Key (with crm.export): `pat-na1-6d9a8b39-229c-4483-8e18-2377b785459a`
Portal: `49169539`

### GrowthBook
Token: `pat-na1-7817798e-3dfc-426d-aaa9-f9ed91d90b32`
Portal: `8863617`

## Quick Commands

```bash
# Run HubSpot write validation (dry-run)
cd frontend && HUBSPOT_TOKEN=pat-na1-9fbd00e9-d997-4cc0-a567-c96095476522 npx tsx scripts/validate-hubspot-write.ts --dry-run

# Run HubSpot write validation (live)
cd frontend && HUBSPOT_TOKEN=pat-na1-9fbd00e9-d997-4cc0-a567-c96095476522 npx tsx scripts/validate-hubspot-write.ts

# Run tests
cd frontend && npm test
```

## Project Structure

- `frontend/` - Next.js app with HubSpot integration
- `frontend/lib/hubspot/` - HubSpot client, dedup gate, batch writer
- `frontend/scripts/` - Validation scripts

## H2 Write Path

The write path includes:
1. **Dedup Gate** - Checks for duplicates using domain/LinkedIn/Apollo indexes
2. **Parent-Child Awareness** - Uses `hs_parent_company_id` property to detect corporate hierarchies
3. **Field-Level Write Policies** - `always_overwrite`, `overwrite_if_blank_or_ours`, `never_overwrite`
4. **Batch Writer** - Executes writes in batches of 100 records
5. **Schema Discovery** - Syncs enum field options from HubSpot at connect time

## Schema Sync

Schema discovery runs at connect time and extracts enum field options from HubSpot:

```bash
# Test schema sync
HUBSPOT_TOKEN=pat-na1-9fbd00e9-d997-4cc0-a567-c96095476522 npx tsx scripts/test-schema-sync.ts
```

Features:
- Fetches all company and contact properties from `/crm/v3/properties/{objectType}`
- Extracts `select` and `checkbox` field types with their valid options
- Stores `valid_values` (value/label pairs) in field_mappings table
- Supports `canonical_to_hubspot_map` for admin-configured value translations
- Blocks writes with `enum_mismatch` if value not in valid_values or map

## H4 Webhook + Real-Time

Real-time processing via HubSpot webhooks with BullMQ job queue.

### Endpoint
`POST /api/webhooks/hubspot`

### Supported Events
- `company.creation` - New company created
- `company.propertyChange` - Company property changed

### Features
- **BullMQ Job Queue** - Events enqueued to Upstash Redis, processed by worker
- **Signature Validation** - Supports v1 and v3 HubSpot signatures
- **Event Deduplication** - Uses `hubspot_event_id` at handler and queue level
- **Dynamic Rate Limiting** - Reads `X-HubSpot-RateLimit-Max` from headers, uses 50%
- **Concurrency** - 5 parallel job processors
- **Retry Logic** - Exponential backoff with jitter (1s, 2s, 4s) for transient failures
- **Mode-Conditional Behavior**:
  - Implicit: Auto-apply normalized values
  - Explicit: Queue for review

### Rate Limiting
- **General API**: Dynamic from `X-HubSpot-RateLimit-Max` header (default 100/10s)
- **Search API**: Separate 4 req/sec limiter for CRM Search endpoints
- **Daily Limit Monitoring**:
  - Warning at <10% remaining
  - Critical + pause at <2% remaining
- **Retry-After**: Respects header on 429 responses
- **Jitter**: Added to all retry delays to prevent thundering herd

### Database
- `webhook_events` - Event idempotency and audit trail
- `hubspot_connections.rate_limit_per_10s` - Stored burst limit

### Environment Variables
```bash
UPSTASH_REDIS_URL=rediss://xxx  # Required for job queue
HUBSPOT_CLIENT_SECRET=xxx       # For signature validation
NEXT_PUBLIC_APP_URL=xxx         # For v3 signature validation
```

### Running the Worker
```bash
# Start webhook worker (on Railway worker dyno)
npm run worker:webhooks

# Or directly
UPSTASH_REDIS_URL=rediss://xxx npx tsx scripts/start-webhook-worker.ts
```

### Test Webhook
```bash
curl -X GET http://localhost:3000/api/webhooks/hubspot
# Returns: { "status": "ok", "queue": { "concurrency": 5, ... } }
```
