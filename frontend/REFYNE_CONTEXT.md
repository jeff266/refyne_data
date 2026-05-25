# Refyne Context

**Last updated:** 2026-05-25
**Status:** Active development
**Product name:** TBD (Refyne is working name)

---

## What Refyne Is

Refyne is a four-stage data quality pipeline that sits between B2B data providers and CRMs. Every record is enriched through the customer's own provider accounts (BYOK), cleaned, normalized to canonical form, and checked for duplicates before it lands. The CRM receives clean, consistent, provenance-tracked data rather than becoming the place where data quality problems accumulate. Built for Series A to C B2B SaaS companies with GTM systems leads who need controllability, visibility, and reliability in their data operations.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | Next.js (App Router) | 15 |
| **Runtime** | React | 18.3.1 |
| **Language** | TypeScript | 5.4.5 |
| **Database** | Supabase (PostgreSQL) | 2.105.4 |
| **Job Queue** | BullMQ + Upstash Redis | 5.76.9 |
| **Auth** | Clerk | 5.7.6 |
| **Payments** | Stripe | 22.1.1 |
| **Normalization Engine** | JSONata | 2.2.0 |
| **Validation** | Zod | 4.4.3 |
| **Error Tracking** | Sentry | 10.53.1 |
| **Email** | Resend | 6.12.3 |
| **Testing** | Vitest | 4.1.6 |
| **Build Tool** | tsx | 4.22.1 |
| **Rate Limiting** | Upstash Rate Limit | 2.0.8 |
| **Charts** | Recharts | 3.8.1 |

---

## Infrastructure

| Service | Purpose | Details |
|---------|---------|---------|
| **app.refynedata.com** | Production URL | Vercel deployment, live in production |
| **coolify.refynedata.com** | Coolify dashboard | Worker management at 31.220.63.174:8000 |
| **Org ID (RevOps Impact)** | org_3DuSdb0FBnx7RMLmJSUegrpiNLS | Primary test org |
| **HubSpot Portal (Frontera)** | 49169539 | Primary test portal, 2,816 companies |
| **Vercel** | Next.js frontend hosting | Production deployment at app.refynedata.com |
| **Railway** | BullMQ worker deployment | US East region, 8GB RAM, 8 vCPU, auto-deploys from GitHub main |
| **Coolify** | Deprecated worker hosting | Worker stopped, no longer in use |
| **Supabase** | PostgreSQL database | RLS policies, service role for workers, org client for user operations |
| **Upstash Redis** | Job queue + rate limiting | BullMQ backend, sliding window rate limiters |
| **Clerk** | Authentication + org management | Multi-tenant with org_id extraction |
| **Stripe** | Billing + metering | Usage-based pricing per CRM record count |
| **Sentry** | Error tracking | Integrated in API routes and workers |

---

## Design System

### Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Navy** | #162944 | Primary brand, headers, buttons |
| **Off-white** | #F9F8F5 | Backgrounds, cards |
| **Steel blue** | #2E6BA8 | Links, accents, hover states |

### Typography

- Font family: System fonts (inherited from Next.js defaults)
- Monospace: For code blocks and technical output

### Rules

- **Square corners everywhere:** `border-radius: 0` is a hard rule. No rounded corners.
- **Dark mode only:** No light mode toggle. All UI is dark navy + off-white.
- **No em dashes:** Use hyphens or commas in all UI text and output.
- **No Tailwind utility classes:** Use CSS modules or styled components, not inline Tailwind classes.
- **No form tags:** Use `onClick` handlers on buttons instead of wrapping in `<form>` tags.

---

## Key Product Decisions (Do Not Revisit)

### Architecture Locked

1. **TypeScript consolidation:** All provider adapters, normalization engine, and pipeline logic in TypeScript. No Python runtime. Decision is locked per ARCHITECTURE.md.

2. **BYOK (Bring Your Own Keys) model:** Customers use their own Apollo, ZoomInfo, Clearbit, Cognism accounts. Managed providers (Serper, GraphIQ, TinyFish) use platform keys. No credit markup. 88-92% gross margins. This is the core business model.

3. **Normalize-before-resolve ordering:** Multi-provider enrichment normalizes each provider's data first, then resolves conflicts across normalized candidates. Not the other way around. Critical for consensus and conservative strategies to work.

4. **Dedup gate inside enrichment pipeline:** Dedup check runs before every CRM write, not as a separate cleanup step. Prevention is primary mode, cleanup is secondary.

5. **Provenance at field level:** Every canonical field carries `ResolvedField` with source, timestamp, and harmony version. This is the data model foundation. Cannot be retrofitted later.

6. **Harmonies as YAML + JSONata:** Normalization rules are readable, versioned, tested, community-owned. Not opaque internal logic. This is the product moat.

7. **Implicit vs explicit mode:** Two modes for normalization behavior. Implicit = auto-apply on every pull. Explicit = separate normalize step. Both supported, mode per org.

8. **HubSpot first, then Salesforce:** Test accounts are HubSpot (Frontera, GrowthBook, GrowthX). Salesforce comes after HubSpot is validated.

9. **Company dedup before person dedup:** Different signals, different merge implications. Company ships first.

10. **Square corners, dark mode, no em dashes:** Design system rules are hard constraints, not suggestions.

11. **Enrich page never redirects to Arrangements.** The Enrich page is the simple front door. Arrangements is the power-user surface. Creating an arrangement from Enrich is silent. User stays on /enrich with inline progress.

12. **BYOK for Apollo/ZoomInfo/Cognism/Clearbit. Managed for Serper/GraphIQ/TinyFish.** Provider keys stored encrypted in provider_connections table via AES-256. Never from process.env. Key hint (last 4 chars) stored plaintext for display.

13. **Worker looks up HubSpot connection by org_id from hubspot_connections table.** Never passes portal_id through arrangement config. RLS policy requires service_role access on hubspot_connections for worker operations.

14. **field_configs uses canonical field keys, not HubSpot property names.** Mapping: employee_count (not numberofemployees), linkedin_url (not linkedin_company_page), revenue (not annualrevenue). Worker handles HubSpot property name translation.

15. **Policy values are fill_empty or overwrite only.** No other values. Worker rejects any other string.

16. **NAICS is the canonical intermediate for industry classification.** All providers normalize TO NAICS first, then NAICS maps to the org's CRM field via the industry_crosswalk table. Never transform industry values with string manipulation.

17. **Export API falls back to pagination on daily limit.** HubSpot limits Export API to 30 exports/day. When limit hit, fall back to cursor pagination. Never fail a run due to export limit.

18. **arrangement_runs.status includes pending_review.** Enrichment review flow uses pending_review status for runs awaiting admin approval before HubSpot write.

19. **Enrichment write behavior configurable per org.** Write behavior stored in org_enrichment_settings table: always_review (always require approval), review_first_run (approve first run, then auto-write), always_auto_write (no approval needed).

20. **Pending enrichments stored with 7-day TTL.** pending_enrichment_values table holds enriched values before HubSpot write. After admin approval, values written to HubSpot. Expires after 7 days.

21. **Harmony auto-generated on first run.** First enrichment run per portal+field auto-generates Harmony using NAICS crosswalk + Claude API fallback. Stored in harmonies_library and reused on subsequent runs.

### Infrastructure Locked

1. **Vercel for frontend:** Next.js deployment on Vercel edge network.
2. **Railway for workers:** BullMQ workers on Railway (US East, 8GB RAM, 8 vCPU). Auto-deploys from GitHub main.
3. **Supabase for database:** PostgreSQL with RLS. Service role client for workers, org client for user operations.
4. **Upstash Redis for queue:** BullMQ backend. No self-hosted Redis.

---

## Database — Migrations Applied to Production

**Total migrations:** 45 (as of 2026-05-22)

### Core Tables

| Migration | Table | Key Columns | Purpose |
|-----------|-------|-------------|---------|
| 001 | `normalization_settings` | org_id, mode (implicit/explicit) | Per-org normalization mode |
| 001 | `pipelines` | org_id, harmony_ids[], is_default | Named sets of Harmonies |
| 005 | `hubspot_connections` | org_id, portal_id, encrypted_token, scopes | HubSpot private app credentials |
| 006 | `webhook_events` | org_id, hubspot_event_id, status | Webhook idempotency log |
| 007 | (rate_limit_column) | Added to hubspot_connections | rate_limit_per_10s |
| 008 | (export_scope_column) | Added to hubspot_connections | crm.export scope tracking |
| 009 | `provider_entity_cache` | org_id, provider, cache_key, data | Provider response caching |
| 010 | `compliance_tables` | org_id, record_id, harmony_id, compliance_score | Continuous compliance monitoring |
| 011 | `dedup_config` | org_id, prevention_enabled, block_threshold, review_threshold | Dedup settings |
| 012 | `dedup_pairs` | org_id, record_a_id, record_b_id, confidence_score, status | Dedup pair queue |
| 013 | (hubspot_oauth) | OAuth flow support (not just private app) |
| 014 | `always_on` | org_id, enabled, schedule | Always-on monitoring config |
| 015 | (clerk_orgs_rbac) | Clerk org IDs, role-based access control |
| 015b | `org_events` | org_id, event_type, payload | Org-level event log |
| 016 | (dedup_display_fields) | Display field preferences for dedup UI |
| 016 | `notification_subscriptions` | org_id, user_id, type, channel | Notification preferences |
| 017 | (billing_metering) | Stripe subscription + usage tracking |
| 018 | (normalize_rollback) | Rollback support for normalize runs |
| 019 | `onboarding_progress` | org_id, step, completed | Onboarding checklist |
| 020 | `data_write_policies` | org_id, field, policy | Field-level write policies (always_overwrite, overwrite_if_blank_or_ours, never_overwrite) |
| 021 | `arrangements` | org_id, name, config | Arrangements (multi-provider enrichment configs) |
| 022 | (contact_dedup_normalize) | Contact-level dedup + normalize |
| 023 | (hubspot_connection_friendly_name) | Display name for connections |
| 024 | (onboarding_experience) | Enhanced onboarding UI |
| 024 | (settings_cleanup) | Settings table consolidation |
| 025 | (sync_health) | HubSpot sync health monitoring |
| 026 | (benchmark_columns) | Benchmark data for arrangements |
| 027 | (dedup_connection_tracking) | Track which connection was used for dedup |
| 028 | `dedup_domain_exclusions` | org_id, domain | Domains to exclude from dedup |
| 029 | `dedup_clusters` | org_id, record_ids[], confidence_score, status | Multi-record dedup clusters |
| 029 | `normalize_exclusions` | org_id, exclusion_type, pattern | Records to exclude from normalize |
| 030 | (dedup_incremental) | Incremental dedup scan support |
| 031 | `harmonies_library` | harmony_id, version, spec, tests | Harmony storage |
| 031 | (harmony_reference_data) | Reference data for Harmonies (industry taxonomy, etc.) |
| 032 | `field_mappings` | org_id, canonical_field, hubspot_property, write_policy, valid_values | Canonical ↔ HubSpot field mapping |
| 032 | (harmony_lookup_functions) | SQL functions for Harmony lookups |
| 033 | (arrangements_v2_schema) | Arrangements V2 with waterfall builder |
| 034 | `org_policies` | org_id, policy_type, config | Org-level policies |
| 034 | `prospect_saved_searches` | org_id, name, filters | Saved prospect searches |
| 035 | `notifications` | org_id, user_id, type, message, read | User notifications |
| 036 | `dedup_merge_history` | org_id, master_id, retired_id, snapshots | Audit log for merges |
| 037 | `industry_crosswalk` | naics_code, naics_label, apollo_label, hubspot_value, linkedin_value | NAICS-based industry mapping to CRM enums |
| 037 | `lookup_industry_crosswalk` | RPC function | Multi-strategy lookup (NAICS code → NAICS label → provider label), returns matched/output/naics_code |
| 038 | `enrichment_review_sessions` | org_id, run_id, status, pending_count | Tracks pending review state per enrichment run |
| 038 | `pending_enrichment_values` | org_id, run_id, company_id, field_key, enriched_value, provider, expires_at | Stores enriched values before HubSpot write, 7-day TTL |
| 038 | `org_enrichment_settings` | org_id, write_behavior (always_review/review_first_run/always_auto_write) | Write behavior preferences per org |
| 039 | `csv_import_sessions` | org_id, status, file_name, rows_total, rows_processed | CSV import tracking (spec written, not yet built) |
| 039 | `csv_import_records` | session_id, row_number, record_data, status | CSV import record-level data (spec written, not yet built) |

### RLS Pattern

**Every org-scoped table has:**
- `org_id` column
- RLS policies: `auth.jwt() ->> 'org_id' = org_id`
- Indexes on `org_id` for performance

**Service role client:** Used by workers, bypasses RLS
**Org client:** Used by API routes, enforces RLS

---

## Auth Pattern

### Clerk Integration

1. **Middleware check:** Every API route starts with Clerk auth check
2. **Extract org_id:** `auth.orgId` from Clerk session
3. **Never from request body:** org_id is always from session, never user input
4. **RBAC:** Roles stored in Clerk metadata, enforced at route level

```typescript
// Standard auth pattern
const { userId, orgId } = auth()
if (!userId || !orgId) {
  return new Response('Unauthorized', { status: 401 })
}
// org_id is now trusted, use for all DB queries
```

---

## Provider Pattern

### BYOK Providers

Customer brings their own API keys. Keys stored encrypted in `provider_connections` table.

| Provider | Auth Method | Key Storage |
|----------|-------------|-------------|
| **Apollo** | API key | Encrypted in provider_connections |
| **ZoomInfo** | JWT (username/password) | Encrypted credentials, JWT cached |
| **Cognism** | API key | Encrypted in provider_connections |
| **Clearbit** | API key | Encrypted in provider_connections |

### Managed Providers

Platform provides keys. No customer setup required.

| Provider | Auth Method | Notes |
|----------|-------------|-------|
| **Serper** | API key | process.env.SERPER_API_KEY |
| **GraphIQ** | API key | process.env.GRAPHIQ_API_KEY |
| **TinyFish** | API key | process.env.TINYFISH_API_KEY |

### Key Storage

- **Never from process.env for BYOK providers**
- Always from `provider_connections` table
- AES-256-GCM encryption
- Service role client reads keys (workers)
- Org client reads own keys only (API routes with RLS)

---

## API Pattern

### Standard Route Structure

```typescript
// app/api/[feature]/[action]/route.ts

import { auth } from '@clerk/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { createOrgClient } from '@/lib/db/client'

export async function POST(request: NextRequest) {
  // 1. Auth check
  const { userId, orgId } = auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  const body = await request.json()

  // 3. Create org-scoped DB client
  const supabase = await createOrgClient()

  // 4. Execute operation
  const result = await someOperation(supabase, orgId, body)

  // 5. Return response
  return NextResponse.json(result)
}
```

### Error Handling

- **400:** Bad request (invalid input)
- **401:** Unauthorized (no auth)
- **403:** Forbidden (wrong org)
- **404:** Not found
- **429:** Rate limited
- **500:** Server error (log to Sentry)

### Rate Limiting

- **HubSpot API:** Dynamic from `X-HubSpot-RateLimit-Max` header (default 100/10s)
- **HubSpot Search API:** Separate 4 req/sec limiter
- **Upstash Rate Limit:** For user-facing API routes

---

## Worker Pattern

### BullMQ Configuration

| Worker | Script | Concurrency | Purpose |
|--------|--------|-------------|---------|
| **Webhook Worker** | `scripts/start-webhook-worker.ts` | 5 | HubSpot webhook events |
| **Digest Worker** | `scripts/start-digest-worker.ts` | 3 | Daily/weekly digest emails |
| **Arrangement Worker** | `scripts/start-arrangement-worker.ts` | 10 | Multi-provider enrichment runs |
| **Dedup Worker** | `scripts/start-dedup-worker.ts` | 5 | Batch dedup scans |

### Job Queue

- **Backend:** Upstash Redis (`UPSTASH_REDIS_URL`)
- **Retry:** Exponential backoff with jitter (1s, 2s, 4s)
- **Max retries:** 3 for transient failures
- **Idempotency:** Job IDs based on content hash
- **Dead letter queue:** Failed jobs after max retries

### Deployment

- **Railway:** Primary worker hosting (US East, 8GB RAM, 8 vCPU)
- **Auto-deploy:** GitHub main branch triggers automatic Railway deployment
- **Separate processes:** Each worker type runs as its own service
- **Environment variables:** Synced from Vercel via Railway dashboard

---

## HubSpot Write Rules

### Write Policy per Field

| Policy | Behavior |
|--------|----------|
| **always_overwrite** | Write normalized value regardless of current CRM value |
| **overwrite_if_blank_or_ours** | Write if CRM field is empty OR we last wrote it (default) |
| **never_overwrite** | Never overwrite; route to secondary field if configured |

### "We Last Wrote It" Check

Uses `field_provenance` table:
- SHA-256 hash of written value
- Compare hash to current CRM value
- If match → we last wrote it → overwrite allowed

### Batch Writer

- **Batch size:** 100 records per HubSpot API request
- **Upsert:** Uses domain as unique identifier
- **Rate limiting:** Sliding window, 50% of HubSpot's burst limit
- **Retry:** Respects `Retry-After` header on 429 responses

### Schema Sync

At connect time:
1. Fetch all company properties from HubSpot `/crm/v3/properties/companies`
2. Extract `select` and `checkbox` field types with valid options
3. Store in `field_mappings.valid_values` column
4. Block writes with `enum_mismatch` if value not in valid_values

### Dedup Gate

**Every write checks for duplicates before creating a new record:**

1. Extract blocking key (normalized domain)
2. Query HubSpot for existing companies with matching domain
3. Compute similarity score (see Dedup PRD for full cascade)
4. Route based on score:
   - ≥0.90: Upsert existing record
   - 0.60–0.89: Hold for review
   - <0.60: Insert as new

---

## Worker Architecture

**Location:** lib/queue/arrangement-queue.ts
**Startup script:** scripts/start-digest-worker.ts (starts all 4 workers)
**Deployment:** Railway (US East region, 8GB RAM, 8 vCPU, auto-deploys from GitHub main)

### Workers

| Worker | Concurrency | Purpose |
|--------|-------------|---------|
| digest-worker | 2 | Nightly compliance scans, email digest |
| company-dedup-worker | 1 | Dedup cluster scanning |
| arrangement-worker | 10 | Enrichment pipeline execution |
| webhook-worker | (varies) | HubSpot webhook processing |

### Arrangement Worker Flow

1. BullMQ picks up job from Upstash Redis
2. Read arrangement field_configs from Supabase
3. Look up HubSpot connection by org_id from hubspot_connections (uses service role client, RLS policy required for service_role)
4. Get access token via getAccessToken(orgId)
5. Fetch companies from HubSpot with cursor pagination (100 per page)
6. For each company: call provider API using decrypted BYOK key
7. Write enriched fields to HubSpot via batchUpdateCompanies
8. Insert progress row to arrangement_run_progress
9. Save checkpoint every 500 records

### Critical RLS Note

hubspot_connections requires explicit service_role policy:

```sql
CREATE POLICY service_role_full_access ON hubspot_connections
FOR ALL TO service_role USING (true);
```

This was the root cause of the May 21 worker failure.

### field_configs Shape

```json
{
  "field_key": "industry",
  "field_type": "categorical",
  "aggregation_strategy": "waterfall",
  "apply_harmony": true,
  "harmony_id": null,
  "steps": [{
    "order": 1,
    "provider": "apollo",
    "policy": "fill_empty"
  }]
}
```

**Important:** field_key uses canonical keys (employee_count, revenue, linkedin_url), NOT HubSpot property names (numberofemployees, annualrevenue, linkedin_company_page). Worker handles HubSpot property name translation.

**Policy values:** Only `fill_empty` or `overwrite` allowed. Worker rejects any other string.

---

## Current Feature Status

### Done and Verified End-to-End (Production)

| Feature | Status | Verified |
|---------|--------|---------|
| Dedup | Complete | Clusters confirmed, merge confirmed in HubSpot |
| Enrich pipeline | Complete | Worker writes to HubSpot confirmed May 21 2026 |
| Benchmark (Venn diagram) | Complete | Apollo vs Refyne Data overlap confirmed |
| Run history | Complete | /history page, /history/[run_id] detail |
| Persistent run state | Complete | Sidebar indicator, localStorage, resume on nav |
| Provider connections (BYOK) | Complete | Encrypted key storage, test endpoint |
| Harmony engine | Complete | Fuzzy matching, phonetic, reference data |
| Compliance dashboard | Complete | Scores, trends, breakdown |
| Always-on monitoring | Complete | Nightly scan, email digest |
| Industry crosswalk | Complete | NAICS-based mapping, 173 mappings covering all 148 HubSpot industry enums |
| Railway migration | Complete | Worker deployed on Railway US East, auto-deploys from GitHub main |
| Export API fallback | Complete | Pagination fallback when daily Export API limit hit (30/day) |
| Domain extraction | Complete | Extracts domain from website + hs_additional_domains fields |
| Enrichment review backend | Complete | pending_review pattern with enrichment_review_sessions table |
| Harmony auto-generation | Complete | Claude + NAICS crosswalk, auto-generates on first run per portal+field |
| Progress bar polling fix | Complete | Fetch state + 3s polling interval for live updates |

### Session Accomplishments (May 24 2026)

| Accomplishment | Details |
|----------------|---------|
| **Memory leak fixed** | Root cause: `processWithPool` used recursive closure pattern holding 6GB RAM. Replaced with simple `Promise.allSettled` batching. Memory now 3MB per chunk vs 6GB crash. |
| **Railway deployment overlap** | Fixed graceful SIGTERM shutdown, stalled job cleanup on startup |
| **Export API fallback** | Confirmed working - falls back to pagination when daily limit hit (30/day) |
| **Domain extraction** | Confirmed working - extracts from `website` + `hs_additional_domains` fields |
| **Enrichment review backend** | Deployed Spec 1: `pending_enrichment_values`, `enrichment_review_sessions`, `org_enrichment_settings` tables live with RLS |
| **Progress counters fixed** | `skipped` and `fields_filled` now tracking correctly |
| **Worker pool size** | Increased to 5 after memory confirmed stable (was 10, reduced to 3, now 5) |
| **History detail error logging** | Enhanced error messages distinguish arrangement ID vs run ID mismatch |

### Session Accomplishments (May 25 2026)

| Accomplishment | Details |
|----------------|---------|
| **Provider cache race condition FIX** | Changed from parallel `Promise.allSettled` to sequential field processing. Cache now shows MISS→HIT→HIT pattern instead of duplicate MISSes. Only 1 API call per company regardless of field count. |
| **GraphIQ provider integration** | Added GraphIQ alongside Apollo as enrichment provider. Uses same BYOK pattern with API key from provider_connections. Rate limiter (100 req/min) and provider cache fully integrated. Returns NAICS codes for accurate industry mapping. |
| **storePendingEnrichments field lookup bug** | Fixed critical mismatch - was iterating HubSpot property keys but looking up canonical field keys. Now iterates `fieldDetail` (canonical) and maps to HubSpot keys via `mapCanonicalToHubSpot()`. Pending enrichment values now populate correctly. |
| **Test scripts for GraphIQ** | Created `test-graphiq-simple.ts` and `test-graphiq-integration.ts` to verify provider integration. All tests passing - adapter init, enrichment, normalized field extraction confirmed. |

### Built but Not End-to-End Verified

| Feature | Status | What Needs Verification |
|---------|--------|------------------------|
| Normalize | Partial | Apply to HubSpot and rollback never confirmed |
| Prospect search | Partial | Apollo key fixed, results in browser unconfirmed |
| Arrangements detail | Partial | Crash fixed, content never verified |
| Inline live feed | Partial | Progress bar works, row-by-row feed not populating |
| Worker parallel processing | Complete | Benchmark with 2,816 records needed, target <20 min |

### Not Started

| Feature | Priority |
|---------|----------|
| Serper+Haiku provider | P0 - core coverage for domain-less companies |
| Normalize queue (BullMQ) | P1 - currently synchronous stub |
| Railway worker migration | P1 - auto-scaling for multi-client |
| Salesforce connector | P2 |
| Chrome extension | P3 |

---

## Pending Work — Priority Order

### High Priority (Next Session)

1. **Provider cache race condition (store Promise not value)** - CRITICAL: Current fix uses sequential processing (slower). Better fix: cache the Promise itself, not the resolved value. All fields can run in parallel, first field's Promise gets cached, subsequent fields await same Promise. No duplicate API calls, no sequential bottleneck.

2. **Progress counter bug (450/213 wrong total)** - `processed_records` showing incorrect totals. Example: "450 of 213 companies processed" indicates counter arithmetic is broken. Need to debug total calculation vs processed increment logic.

3. **Fields filled/skipped = 0 bug** - Despite fix deployed May 24, counters still showing 0 in production. Indicates either increment logic not firing or Supabase update failing silently. Need production run with enhanced logging.

4. **Completion screen after enrichment** - No UI feedback when enrichment run completes. User sees progress bar hit 100% then nothing. Need completion modal with summary: records processed, fields filled, credits used, review link (if pending_review).

5. **History detail Run not found** - Error on `/history/[run_id]` page. Enhanced logging deployed but root cause not yet identified. Suspect either arrangement_id vs run_id confusion or missing run_id in arrangement_runs table.

### Medium Priority

6. **Build enrichment review UI** on Enrich page (Spec 1 UI: approve/reject modal for pending enrichments)
7. **Serper+Haiku provider** - **P0 for Frontera** - Apollo 422 rate ~95%+, fills 0 fields without this
8. CSV import workflow (/import page with upload, mapping, preview, confirm)
9. Field mappings guided setup (onboarding flow for canonical ↔ HubSpot mapping)
10. **refyne_record_status table** - track last enriched timestamp per field per company
11. **Job priority queue** - high-priority runs jump ahead of long-running jobs
12. Credit system and pricing page (Stripe metering integration, usage-based pricing)
13. Prospect page canonical schema normalization (merge Apollo + GraphIQ + ZoomInfo results by domain)
14. Normalize BullMQ queue implementation (async processing for normalize apply)
15. GitHub Harmonies repo (open-source default library for community contributions)

---

## Key People and Clients

### Test Accounts

| Account | HubSpot Portal | Token Env Var | Purpose |
|---------|----------------|---------------|---------|
| **Frontera Health** | 49169539 | `HUBSPOT_TOKEN_FRONTERA` | Basic normalize + write back testing |
| **GrowthBook** | 8863617 | `HUBSPOT_TOKEN_GROWTHBOOK` | Dedup prevention testing |
| **GrowthX** | (TBD) | `HUBSPOT_TOKEN_GROWTHX` | Batch monitoring testing (500+ records) |

### Contacts

- **Jeff Ignacio** — RevOps Impact LLC, product owner

### Apollo Coverage Baseline (Frontera Health Portal, May 21 2026)

2,816 companies scanned. Apollo filled approximately 106 fields total across a full enrichment run. Fill rate is low because most companies are small ABA therapy practices with no domain in HubSpot. Apollo cannot match companies without a domain.

This is the gap Serper+Haiku is designed to fill.

---

## Critical Product Insights

### Apollo Coverage Gap - Healthcare Vertical

**Discovery Date:** May 24, 2026
**Portal:** Frontera Health (49169539) - 2,816 companies
**Vertical:** ABA therapy providers (Applied Behavior Analysis)

**Finding:** Apollo 422 rate on Frontera Health is approximately **95%+**. Almost every ABA therapy domain gets rejected with "Company not found" error. Apollo does not have coverage for this vertical.

**Impact:**
- **Without Serper+Haiku:** Enrichment fills **0 fields** for this client
- **With Apollo alone:** ~422 errors / ~445 attempted enrichments = 95% failure rate
- **Root cause:** Small healthcare practices, regional ABA clinics, pediatric therapy centers not in Apollo's B2B SaaS database

**Business Implication:**
Serper+Haiku is **not optional** for healthcare/therapy verticals. It is **required** for any client with small regional service providers. Apollo-only enrichment would deliver zero value to Frontera Health.

**Priority:** P0 - blocking production use for healthcare vertical clients.

---

## Hard Rules

### No Exceptions

1. **No em dashes** — Use hyphens or commas in all UI text, commit messages, documentation.
2. **No Tailwind utility classes** — Use CSS modules or styled components only.
3. **No form tags** — Use `onClick` handlers on buttons, not `<form>` wrappers.
4. **No border-radius** — Square corners everywhere. `border-radius: 0` is enforced.
5. **Dark mode only** — No light mode. Navy + off-white color scheme.
6. **org_id from session only** — Never accept org_id from request body or query params.
7. **RLS on all org tables** — Every org-scoped table has RLS policies.
8. **Service role for workers only** — API routes use org client with RLS.
9. **Encrypted keys for BYOK** — AES-256-GCM encryption for all provider API keys.
10. **Dedup gate on every write** — No writes to CRM bypass the dedup gate.
11. **Field-level provenance** — Every canonical field carries ResolvedField metadata.
12. **Harmonies are YAML + JSONata** — Normalization rules are readable and versioned.
13. **BYOK model is locked** — No credit markup, no data redistribution.
14. **TypeScript consolidation is locked** — No Python runtime for providers.
15. **HubSpot before Salesforce** — Test accounts are HubSpot, Salesforce comes after validation.

---

## Architecture References

For detailed architecture decisions, see:

- `docs/ARCHITECTURE.md` — Normalization engine, provider adapters, normalize-before-resolve flow
- `docs/PRODUCT_PRD.md` — Product vision, market positioning, feature roadmap
- `docs/HUBSPOT_INTEGRATION_BRIEF.md` — HubSpot read/write paths, field mapping, webhook flow
- `docs/DEDUPE_PRD_ADDENDUM.md` — Dedup signal cascade, survivorship logic, parent-child awareness

---

**End of Context File**

*This file is the single source of truth for all Refyne architecture, product, and implementation decisions. Before starting any session, Claude Code agents should read this file in full to avoid conflicts with established patterns.*
