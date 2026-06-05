# Enrichment Switcher - Claude Context

## Enum Validation System - COMPLETE (June 2026)

**Status:** Implemented and shipped ✅

Complete three-tier enum validation system prevents HubSpot write failures for enumeration fields:

**Fix 1: Worker error tracking (migration 079)**
- Added `error_message TEXT` column to `normalization_run_progress`
- Normalize worker captures field-level errors from HubSpot batch API
- Stores specific rejection reasons (e.g., "Property 'industry' with value 'ABA Therapy' was not one of the allowed options")

**Fix 2: Reference data validation UI**
- Harmony detail page validates canonical values against HubSpot enum options
- Inline indicators: ✓ green CheckCircle for valid, ⚠️ amber AlertTriangle for invalid
- Warning banner at top when invalid values exist
- Shared utility: `lib/harmonies/enum-validator.ts`

**Fix 3: Preview enum validation warning**
- Normalize preview validates ALL proposed changes before apply
- Fetches properties from `hubspot_properties_cache` (no HubSpot API calls)
- Groups invalid values by harmony with record counts
- Warning banner above Apply button:
  ```
  ⚠️ Some changes may fail in HubSpot

  Company Industry Taxonomy: "ABA Therapy" is not a valid option
  for the industry field. 23 records affected. [Fix reference data →]
  ```
- "Fix reference data →" links to `/harmonies/{harmonyId}#reference-data`
- User can choose "Apply anyway" (they may know something we don't)

**Implementation:**
- `lib/harmonies/enum-validator.ts`: Shared validation utility
- `app/(dashboard)/harmonies/[id]/page.tsx`: Reference data validation
- `app/(dashboard)/normalize/page.tsx`: Preview validation warnings
- `components/harmonies/ReferenceDataTable.tsx`: Inline validation UI
- Recent Changes table shows write errors with specific rejection reasons

---

## Dormant Features

### Field Mappings (Removed June 2026)

**Decision:** Removed Field Mappings from navigation. Route and table remain in place but are no longer accessible to users.

**Why dormant:**
- `field_mappings` table has 0 rows - feature was never used in production
- Architectural duplication with `harmony_field_assignments` table
- Harmonies already provide field-level mapping through assignments with better integration
- Potential customer confusion between two similar features

**What was removed:**
- Navigation entry in sidebar (`lib/design-tokens.ts` NAV array)
- Page metadata entry (`lib/design-tokens.ts` PAGE_META object)

**What remains:**
- Route file: `app/(dashboard)/mappings/page.tsx` (with dormancy comment)
- Database table: `field_mappings` (with 0 rows)
- API endpoints (if any)

**Can be fully deleted in future cleanup sprint if confirmed unnecessary.**

---

## Security Checklist for New Tables

**Before creating any new table in a migration, follow this checklist:**

- [ ] **If table has org_id column:** Enable RLS in the same migration
  ```sql
  -- RLS: Required if table has org_id column
  -- Pattern: CREATE POLICY {table}_org_isolation ON {table}
  --   USING (org_id = (auth.jwt() ->> 'org_id'));

  ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

  CREATE POLICY {table_name}_org_isolation ON {table_name}
    FOR ALL
    USING (org_id = (auth.jwt() ->> 'org_id'))
    WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));
  ```

- [ ] **If table is global (no org_id):** Add read-only RLS for defense in depth
  ```sql
  ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

  CREATE POLICY {table_name}_read_all ON {table_name}
    FOR SELECT
    USING (true);
  ```

- [ ] **Verify all queries use supabaseAdmin:** Search codebase for non-admin access
  ```bash
  grep -rn "supabase\." app/ lib/ --include="*.ts" | grep -v "supabaseAdmin" | grep "{table_name}"
  ```

- [ ] **Run RLS verification query after applying migration:**
  ```sql
  SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename = '{table_name}';
  -- Should return: rowsecurity = true
  ```

**Why this matters:** Migration 077 (June 4, 2026) fixed 9 org-specific tables that shipped without RLS, including `dedup_policies` which was added just hours before the vulnerability was discovered. RLS must be applied in the same migration that creates the table.

---

## HubSpot Portals

### Frontera Health
Token: `pat-na1-9fbd00e9-d997-4cc0-a567-c96095476522`
Service Key (with crm.export): `pat-na1-6d9a8b39-229c-4483-8e18-2377b785459a`
Portal: `49169539`

### GrowthBook
Token: `pat-na1-7817798e-3dfc-426d-aaa9-f9ed91d90b32`
Portal: `8863617`

### RevOps Impact
Portal: `24202132`
Org ID: `org_3DuSdb0FBnx7RMLmJSUegrpiNLS`
Total Contacts: 7,143
Token: OAuth (encrypted in database, use `getAccessToken(orgId)`)

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

## Dedup System

### Status: Sprints 1-3 Complete ✅

**Architecture:** Unified real-time + batch dedup system with database-backed clusters, survivorship rules, and auto-merge scheduling.

### Dedup Sprint 1 ✅
- 7-signal cascade matching (domain, LinkedIn, phone, name, industry, address, executive overlap)
- Union-Find clustering algorithm groups duplicate pairs into clusters
- Grade system: A (97%+), B (85-96%), C (70-84%), D (60-69%)
- Cluster review UI with signal badges showing which signals fired
- Field-level merge preview with master/duplicate selection
- Pre-merge snapshots stored in `dedup_merge_history` for audit trail

### Dedup Sprint 2 ✅
- **Survivorship rules engine** (`dedup_survivorship_rules` table)
  - Default rules: `never_downgrade` (lifecyclestage), `prefer_nonempty` (*), `tld_disqualifier` (domain)
  - Org-specific rules override defaults
  - Automatic field-level winner selection before manual review
- **TLD mismatch penalty** (20 points) for international domain variants (e.g., `.com` vs `.com.au`)
- **Rollback/restore UI** (`/dedup` History tab)
  - Recreates absorbed companies from pre-merge snapshots
  - Reopens cluster for re-review after restoration
  - Full system field filtering (excludes `hs_object_id`, `createdate`, etc.)
- **`started_at` fix** in `arrangement_run_progress` (6 locations)

### Dedup Sprint 3 ✅
- **Auto-merge with waiting period** (`dedup_auto_merge_settings` table)
  - Default 24-hour waiting period for Grade A clusters (≥97% confidence)
  - Configurable per org: enabled/disabled, waiting period, confidence threshold
  - Email/Slack notifications when clusters are scheduled
- **Pending merges UI** (`/dedup` Pending tab)
  - Countdown timers showing time until auto-merge
  - Individual "Cancel" buttons and "Cancel all" functionality
  - Auto-refreshes every minute
- **BullMQ auto-merge worker** runs every 15 minutes
  - Finds clusters due for auto-merge (scheduled_at < now, not cancelled)
  - Executes merge using survivorship rules
  - Logs to `dedup_merge_history` with `merge_method='auto'`
- **Cluster tracking** in incremental scanner
  - `buildClusters()` returns `{ count, clusterIds }`
  - Calls `scheduleAutoMerges()` at end of scan

### Dedup Policies (D3) ✅ - June 4, 2026
**Migration 076:** Configurable merge policies with field-level rules and exclusion criteria

**Policy Components:**
- **Exclusion Rules** - Block merges based on conditions:
  - Different parent companies (`block_if_different_parent`)
  - Closed-won deals present (`block_if_closed_won_deals`)
- **Compliance Fields** - Always use most restrictive value:
  - Email opt-out, bounce status, legal basis
  - JSONB array, org-customizable
- **Field Merge Rules** - 8 rule types with wildcard support:
  - `fill_empty` - Use duplicate if master blank
  - `keep_master` - Always use master
  - `append_both` - Concatenate with separator
  - `keep_highest` / `keep_lowest` - Numeric comparison
  - `keep_newest` / `keep_oldest` - Date-based
  - `keep_most_advanced` - Funnel progression (e.g., lifecyclestage)

**Implementation:**
- `lib/dedup/merge-executor.ts` - Policy-driven merge execution
- `app/api/settings/dedup-policies/` - GET/POST endpoints
- `/settings/policies/dedup` - UI with 4 sections (name, exclusions, compliance, rules)
- Wired into cluster merge route, replaces direct HubSpot API calls
- Manual selections override policy rules
- Applied rules tracked in merge history

**Default Policy:** Matches current behavior (lifecyclestage never_downgrade + fill_empty wildcard)

**Backward Compatible:** Existing merge flow preserved, policies opt-in

### RLS Security (D3.1) ✅ - June 4, 2026
**Migration 077:** Row Level Security for 9 org-specific tables + 3 global tables

**Critical Security Fix:** Immediately after shipping migration 076 (dedup_policies), RLS audit revealed 12 tables without row-level security protection.

**Org-Isolated Tables (9):**
- `dedup_policies` - Merge policy configurations per org
- `dedup_decisions` - User merge decisions for ML training
- `dedup_auto_merge_settings` - Auto-merge wait periods per org
- `dedup_survivorship_rules` - Field-level merge rules (allows reading defaults with NULL org_id)
- `enrichment_field_sources` - Provider attribution per company
- `harmony_field_assignments` - Field mappings per org (allows reading defaults)
- `job_segmentation_runs` - Job segmentation execution history
- `normalization_run_progress` - Field change audit trail (org via FK to normalization_runs)
- `taxonomy_suggestions` - Suggested taxonomy mappings

**Global Read-Only Tables (3):**
- `job_title_cache` - Global job title normalization (BCBA → IC/Clinical)
- `sub_industry_packs` - Global industry taxonomy packs
- `sub_industry_pack_entries` - Industry normalization mappings

**RLS Policy Pattern:**
```sql
USING (org_id = (auth.jwt() ->> 'org_id'))
```

**Application Impact:** Zero - All app code uses `supabaseAdmin` (service role) which bypasses RLS. Policies protect against direct client-side access and Supabase dashboard exposure only.

**Tests:** 946/949 passed (3 unrelated GraphIQ API key failures)

### Webhook Bridge Complete ✅
**Critical fix:** Unified two previously separate dedup systems (webhook vs scanner)

**Before:**
- Webhook dedup used in-memory queue (Map-based `ReviewQueueItem`)
- Silent 90% auto-merge with no audit trail or UI visibility
- Duplicates detected by webhooks bypassed entire dedup UI

**After:**
- Webhook dedup creates database clusters (`createDedupClusterFromWebhook()`)
- All matches ≥60% create `dedup_pairs` + `dedup_clusters` visible in UI
- Silent 90% auto-merge removed - all matches go through cluster system
- Webhook-detected duplicates follow same Grade A/B/C/D system with signal badges

**Changes:**
1. **Hardcoded portal IDs replaced** (`app/api/webhooks/hubspot/route.ts`)
   - Queries `hubspot_connections` table for `org_id`, `access_token`, `connection_status` by `portal_id`
   - Queries `normalization_settings` for `mode` (implicit/explicit)
   - Real `org_id` from database replaces synthetic `portal-${portalId}`

2. **Dedup gate bridged to cluster system** (`lib/hubspot/dedup-gate.ts`)
   - `createDedupClusterFromWebhook()` creates `dedup_pairs` + `dedup_clusters`
   - `addToReviewQueue()` calls database cluster creation instead of in-memory storage
   - Threshold logic changed: all matches ≥`review_min` return `action='review'`

3. **Event handlers added** (`lib/hubspot/webhook-handler.ts`)
   - `company.deletion` → marks clusters as `status='invalid'`
   - `company.merge` → records in `dedup_merge_history` with `merge_method='hubspot_initiated'` (placeholder)
   - `company.restore` → reopens clusters, marks merge as reversed (placeholder)

### Database Tables

**Core dedup tables:**
- `dedup_clusters` - Clustered duplicate groups with status (open/merged/invalid)
- `dedup_pairs` - Individual company pairs with confidence, grade, signals
- `dedup_merge_history` - Audit trail of all merges with pre-merge snapshots
- `dedup_survivorship_rules` - Field-level rules for automatic winner selection (3 default rules seeded)
- `dedup_auto_merge_settings` - Per-org auto-merge configuration (waiting period, threshold)
- `dedup_decisions` - User accept/reject decisions for probabilistic weight training (**0 records** - accumulates from merges/rejects)

**Waiting for 500+ decisions** before enabling probabilistic weight engine.

### Running the Dedup Worker
```bash
# Start dedup scanner + auto-merge worker (on Railway worker dyno)
npm run worker:dedup

# Or directly
UPSTASH_REDIS_URL=rediss://xxx npx tsx scripts/start-dedup-worker.ts
```

### Supported Webhook Events (Now Create Clusters)
- `company.creation` - Creates cluster if matches existing company ≥60%
- `company.propertyChange` - Creates cluster if changes trigger duplicate match
- `company.deletion` - Marks clusters as invalid (NEW)
- `company.merge` - Records HubSpot-initiated merge (NEW, placeholder for future API)
- `company.restore` - Reopens clusters (NEW, placeholder for future API)
