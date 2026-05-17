# Enrichment Switcher Setup Guide

## HubSpot Webhook Configuration

### Prerequisites

1. HubSpot private app with the following scopes:
   - `crm.objects.companies.read`
   - `crm.objects.companies.write`
   - `crm.schemas.companies.read`
   - `crm.lists.read`

2. Upstash Redis for job queue (required for production):
   - Create an Upstash Redis database at https://upstash.com
   - Copy the Redis URL (starts with `rediss://`)

3. Environment variables configured:
   ```bash
   # Required for job queue
   UPSTASH_REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379

   # Required for webhook processing
   HUBSPOT_TOKEN=pat-na1-xxx        # HubSpot private app access token
   HUBSPOT_CLIENT_SECRET=xxx         # Private app client secret (for signature validation)

   # Optional: Per-portal configuration
   HUBSPOT_TOKEN_FRONTERA=pat-na1-xxx
   HUBSPOT_CLIENT_SECRET_FRONTERA=xxx
   HUBSPOT_TOKEN_GROWTHBOOK=pat-na1-xxx
   HUBSPOT_CLIENT_SECRET_GROWTHBOOK=xxx

   # App URL (for signature validation)
   NEXT_PUBLIC_APP_URL=https://your-app.com
   ```

### Setting Up HubSpot Webhooks

1. **Navigate to Private App Settings**
   - Go to Settings → Integrations → Private Apps
   - Select your private app

2. **Configure Webhook Subscriptions**
   - Click on the "Webhooks" tab
   - Add subscriptions for:
     - `company.creation` - Triggered when a new company is created
     - `company.propertyChange` - Triggered when a company property changes

3. **Set Target URL**
   ```
   https://your-app.com/api/webhooks/hubspot
   ```

4. **Signature Validation**
   - HubSpot signs webhook payloads using HMAC-SHA256
   - The integration supports both v1 and v3 signatures
   - v3 is preferred (includes timestamp for replay protection)

### Webhook Event Flow

```
HubSpot Event → POST /api/webhooks/hubspot
                        ↓
               Validate Signature
                        ↓
               Check for Duplicates
                        ↓
               Enqueue to BullMQ (Redis)
                        ↓
               Return 200 (immediate)

                    ║
                    ║  (async)
                    ▼

               BullMQ Worker
               (concurrency: 5)
                        ↓
               Fetch Company Record
                        ↓
               Run Dedup Gate
                        ↓
               Mode-Conditional:
               ├─ Implicit: Auto-apply
               └─ Explicit: Queue for Review
```

### Normalization Modes

**Implicit Mode** (default)
- Webhook events are processed automatically
- Normalized values are written back to HubSpot immediately
- Dedup conflicts are still queued for review

**Explicit Mode**
- Webhook events are queued for review
- No automatic writes
- User must approve changes in the review UI

### Running the Webhook Worker

The worker is a separate process that processes jobs from the BullMQ queue.

**Local Development:**
```bash
npm run worker:webhooks
```

**Production (Railway):**
1. Create a worker service in Railway
2. Set start command: `npm run worker:webhooks`
3. Add environment variables (UPSTASH_REDIS_URL, HUBSPOT_TOKEN)

**Worker Configuration:**
- Concurrency: 5 parallel jobs
- Rate Limit: 50 jobs per 10 seconds
- This leaves headroom for other API calls (HubSpot allows 100/10sec)

### Retry Logic

The BullMQ worker implements exponential backoff:
- Attempt 1: Immediate
- Attempt 2: 1 second delay
- Attempt 3: 2 second delay
- Attempt 4: 4 second delay (max 3 retries by default)

Retryable errors:
- HTTP 429 (Rate Limit)
- HTTP 5xx (Server Errors)
- Network timeouts

### Database Schema

The `webhook_events` table stores event history for deduplication and audit:

```sql
CREATE TABLE webhook_events (
  id              UUID PRIMARY KEY,
  org_id          TEXT NOT NULL,
  hubspot_event_id TEXT NOT NULL,
  portal_id       TEXT NOT NULL,
  object_id       TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  status          TEXT NOT NULL,  -- pending, processed, failed, duplicate
  property_name   TEXT,
  property_value  TEXT,
  attempt_number  INTEGER,
  error_message   TEXT,
  received_at     TIMESTAMPTZ,
  processed_at    TIMESTAMPTZ,
  UNIQUE(org_id, hubspot_event_id)
);
```

### Monitoring

Check webhook health:
```bash
curl https://your-app.com/api/webhooks/hubspot
# Returns: { "status": "ok", "endpoint": "/api/webhooks/hubspot", ... }
```

### Troubleshooting

**Events not processing**
- Check `HUBSPOT_TOKEN` is valid
- Verify webhook URL is accessible from HubSpot
- Check server logs for signature validation failures

**Duplicate events**
- HubSpot may retry webhooks if initial response is slow
- The handler deduplicates by `hubspot_event_id`
- Check `webhook_events` table for `status = 'duplicate'`

**Rate limiting**
- HubSpot has 100 requests / 10 seconds per app
- The handler respects this with a sliding window rate limiter
- Check for 429 errors in logs

## Running Tests

```bash
# Run all tests
npm test

# Run webhook-specific tests
npm test -- webhook-handler

# Run with coverage
npm run test:coverage
```

## Development

```bash
# Start development server
npm run dev

# Test webhook locally (use ngrok for HTTPS)
ngrok http 3000
# Then configure HubSpot webhook URL to ngrok URL
```
