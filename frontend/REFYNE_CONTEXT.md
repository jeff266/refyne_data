# Refyne Context

**Last updated:** 2026-05-30 (Session 7 - Harmony Architecture Phase 1)
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
| **data.refynedata.com** | Internal ops dashboard | Refyne Data Platform UI - cache metrics, seed management, vertical stats (Session 5) |
| **refyne-platform** | Data platform API | Scaffolded, not yet deployed. Handles cache, scraping, extraction, seed ingestion (Session 5) |
| **coolify.refynedata.com** | Coolify dashboard | Worker management at 31.220.63.174:8000 |
| **Org ID (RevOps Impact)** | org_3EO4lJVNFJTFXSaUi8iieMKwFTx | Test org, Portal ID 24202132 |
| **Org ID (Frontera Health)** | org_3EPCVbtxHZLdwMPwi4Q9WOD2iZU | Primary test org, Portal ID 49169539, 2,835 companies, 57 pending dedup clusters |
| **Org ID (GrowthBook)** | org_3EO4lJVNFJTFXSaUi8iieMKwFTx | Test org, Portal ID 8863617, 20,962 companies, 63 pending dedup clusters (NOTE: May share org_id with RevOps Impact - verify) |
| **Vercel** | Next.js frontend hosting | Production deployment at app.refynedata.com |
| **Railway** | BullMQ worker + platform API | US East region, 8GB RAM, 8 vCPU, auto-deploys from GitHub main |
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

2. **BYOK (Bring Your Own Keys) model:** Customers use their own Apollo, ZoomInfo, Clearbit, Cognism accounts. Managed providers (GraphIQ, TinyFish, Refyne Search) use platform keys. No credit markup. 88-92% gross margins. This is the core business model. Refyne Search is branded as proprietary but uses Fireworks AI (DeepSeek V4 Flash) + Serper under the hood.

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

## Harmony Architecture

**HARMONY ARCHITECTURE - Phase 1 complete (May 30, 2026)**

Added transform_function and transform_config columns to harmonies table. FORMAT_FUNCTIONS now keyed by harmony.transform_function (not harmony.id). Fallback to harmony.id for backward compatibility. 8 format harmonies seeded with transform_function values. Phone harmony now reads default_country_code from transform_config. New numeric_parse transform function added.

**Current state:**
- Format harmonies use data-driven transform functions (e164_phone, email_lowercase, linkedin_url, smart_title_case, numeric_parse)
- Multiple harmonies can share same transform function (phone + contact-phone-e164 both use e164_phone)
- Transform config enables customization without code changes (phone country code, extension stripping)
- Backward compatible: harmonies without transform_function fall back to harmony.id lookup

**Phase 2 next:** harmony_field_assignments table (separate harmony definition from field assignment per org)

**Phase 3 next:** user-created harmony wizard UI (org-specific harmonies, custom reference tables, output format selection)

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
| **Serper** | API key | process.env.REFYNE_SERPER_KEY (for Refyne Search) |
| **GraphIQ** | API key | process.env.GRAPHIQ_API_KEY |
| **TinyFish** | API key | process.env.TINYFISH_API_KEY |
| **Refyne Search** | Fireworks AI + Serper | process.env.REFYNE_FIREWORKS_KEY + REFYNE_SERPER_KEY. Branded as proprietary. Model: accounts/fireworks/models/deepseek-v4-flash. Cost: $0.14/$0.28 per M tokens. |

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

## Dedup System

### Status: Sprints 1-5 Complete ✅

**Architecture:** Unified real-time + batch dedup system with database-backed clusters, survivorship rules engine, auto-merge scheduling, and webhook bridge.

### Dedup Sprint 1 ✅
**Shipped:** Signal explainability, bulk merge history, similarity signals audit

**Features:**
- 7-signal cascade matching (domain, LinkedIn, phone, name, industry, address, executive overlap)
- Union-Find clustering algorithm groups duplicate pairs into clusters
- Grade system: A (97%+), B (85-96%), C (70-84%), D (60-69%)
- `signals_fired` surfaced in ClusterCard UI - shows which signals matched (e.g., "domain, linkedin, phone")
- Field-level merge preview with master/duplicate selection
- Pre-merge snapshots stored in `dedup_merge_history` for audit trail
- `similarity_signals` column on single merge history records - JSON array of fired signals
- `dedup_decisions` table created - accumulates user merge/reject decisions for future ML weight training
- Bulk merge history view - see all past merges across org

### Dedup Sprint 2 ✅
**Shipped:** Survivorship rules engine, rollback/restore, TLD penalty

**Features:**
- **Survivorship rules engine** (`dedup_survivorship_rules` table)
  - 3 default rules seeded on org creation:
    - `never_downgrade` (lifecyclestage) - never downgrade lifecycle stage on merge
    - `prefer_nonempty` (all fields) - prefer non-empty values
    - `tld_disqualifier` (domain) - penalize TLD mismatches (.com vs .com.au)
  - Org-specific rules override defaults
  - Automatic field-level winner selection before manual review
- **TLD mismatch penalty** (20 points) for international domain variants (e.g., `.com` vs `.com.au`)
- **Rollback/restore UI** (`/dedup` History tab → MergeHistoryTab component)
  - Recreates absorbed companies from pre-merge snapshots
  - Reopens cluster for re-review after restoration
  - Full system field filtering (excludes `hs_object_id`, `createdate`, etc.)
- **`started_at` fix** in `arrangement_run_progress` (6 locations) - was nullable, now always set

### Dedup Sprint 3 ✅
**Shipped:** Auto-merge with waiting period, pending merges UI

**Features:**
- **Auto-merge with waiting period** (`dedup_auto_merge_settings` table)
  - Default 24-hour waiting period for Grade A clusters (≥97% confidence)
  - Configurable per org: enabled/disabled, waiting period, confidence threshold
  - Email/Slack notifications when clusters are scheduled (not yet implemented)
- **Pending merges UI** (`/dedup` Pending tab → PendingMergesTab component)
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

### Dedup Sprint 4 ✅
**Shipped:** Source preference and most recent survivorship rules, enrichment field sources, Why column, survivorship audit

**Features:**
- **Source preference survivorship rule**
  - Default rule: graphiq > apollo > zoominfo > cognism > refyne_search > user_entered
  - Uses `enrichment_field_sources` table to track which provider enriched each field
  - When merging, prefer field from higher-ranked source
  - Configurable per org via Settings → Policies
- **Most recent survivorship rule**
  - Org-configurable rule (not default)
  - Prefers field value that was updated most recently
  - Uses HubSpot `hs_lastmodifieddate` property
- **Why column in cluster review**
  - Shows which survivorship rule won for each field
  - Format: "Source: graphiq (source_preference)" or "Non-empty (prefer_nonempty)"
  - Helps users understand automatic field selection
- **Survivorship audit in merge history**
  - `survivorship_decisions` column on `dedup_merge_history`
  - JSON object mapping field → rule that won
  - Example: `{"industry": "source_preference", "employee_count": "prefer_nonempty"}`
  - Provides full audit trail of why each field was chosen

### Dedup Sprint 5 ✅
**Shipped:** Specific value rule for enums, Rollup rule for numeric fields

**Features:**
- **Specific value survivorship rule**
  - Org-configurable rule for enum fields only
  - Fetches HubSpot picklist values via `/crm/v3/properties/companies/{fieldName}`
  - User selects preferred value from dropdown (e.g., always prefer "Customer" over "Lead")
  - Add rule modal detects field type: enum fields show "Specific value" option
  - Stored in `dedup_survivorship_rules` table with `rule_config: {preferred_value: "Customer"}`
- **Rollup survivorship rule**
  - Org-configurable rule for number fields only
  - Aggregation strategies: max, min, sum, average
  - Example: "Employee count" → max (take larger value)
  - Example: "Annual revenue" → sum (add together)
  - Add rule modal detects field type: number fields show "Rollup" option
  - Stored in `dedup_survivorship_rules` table with `rule_config: {aggregation: "max"}`
- **UI improvements**
  - Add rule modal is 3-step wizard
  - Step 1: Select field (with type detection)
  - Step 2: Select rule type (shows only applicable types based on field)
  - Step 3: Configure rule (enum shows value dropdown, number shows aggregation dropdown)
  - Rules table shows human-readable labels instead of raw keys

### Survivorship Rules - 6 Rule Types Live

| Rule Type | Default? | Applies To | Description | Configuration |
|-----------|----------|------------|-------------|---------------|
| `prefer_nonempty` | ✅ Default | All fields | Prefer non-empty values over empty | None |
| `never_downgrade` | ✅ Default | lifecyclestage | Never downgrade lifecycle stage | None |
| `tld_disqualifier` | ✅ Default | domain | Penalize TLD mismatches (.com vs .com.au) | None |
| `source_preference` | ✅ Default | All fields | Prefer values from higher-ranked enrichment source | graphiq > apollo > zoominfo > cognism > refyne_search > user_entered |
| `most_recent` | Org-configurable | All fields | Prefer most recently updated value | None |
| `specific_value` | Org-configurable | Enum fields only | Always prefer specific enum value | User selects preferred value from HubSpot picklist |
| `rollup` | Org-configurable | Number fields only | Aggregate numeric values using strategy | User selects: max, min, sum, or average |

**UI Location:** Settings → Policies tab

**Add Rule Flow:**
1. Click "Add rule" button
2. Select field from dropdown (detects field type from HubSpot schema)
3. Select rule type (only shows applicable types: enum fields show specific_value, number fields show rollup)
4. Configure rule (enum shows value dropdown, number shows aggregation dropdown)
5. Save

**Rules Table Columns:**
- Field (human-readable label, not raw key - fixed in Sprint 5)
- Rule Type
- Configuration (shows preferred value or aggregation strategy)
- Actions (Edit, Delete)

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
   - `company.creation` → creates cluster if matches existing company ≥60%
   - `company.propertyChange` → creates cluster if changes trigger duplicate match
   - `company.deletion` → marks clusters as `status='invalid'`
   - `company.merge` → records in `dedup_merge_history` with `merge_method='hubspot_initiated'` (placeholder)
   - `company.restore` → reopens clusters, marks merge as reversed (placeholder)

### Scanner Performance Fix - Critical Bug

**Problem:** Pair generation was a stub (returned empty array). Scanner created clusters with no pairs, no signals, no grades. Clusters appeared in UI but were incomplete.

**Root Cause:** Original implementation did 25,340+ database queries (1 query per company × N companies) to find matches. This was too slow, so it was stubbed out with `return []`.

**Fix (May 29 2026):**
- Load entire `company_dedup_index` table into memory (1 query)
- Build JavaScript Maps for O(1) lookups:
  - `domainMap` - domain → company IDs
  - `phoneMap` - normalized phone → company IDs
  - `nameMap` - normalized name → company IDs
  - `linkedinMap` - LinkedIn URL → company IDs
- Load all existing pairs into a Set (1 query) for deduplication
- Scan all companies in memory, fire signals via O(1) Map lookups
- Build pairs with full signal data (domain, linkedin, phone, name, industry, address, executive overlap)
- Cluster pairs using Union-Find algorithm
- Assign grades based on confidence: A (97%+), B (85-96%), C (70-84%), D (60-69%)

**Performance After Fix:**
- **Frontera:** 2,835 companies → 41 seconds (68 clusters, 17 Grade A, 51 Grade B)
- **GrowthBook:** 20,962 companies → 91 seconds (63 clusters, all Grade B)
- **RevOps Impact:** Scan pending (52 clusters expected based on history)

**Scanner now fully operational** - all clusters have complete pair lists, signal badges, and grades.

### Database Tables

**Core dedup tables:**
- `dedup_clusters` - Clustered duplicate groups with status (open/merged/invalid)
- `dedup_pairs` - Individual company pairs with confidence, grade, signals_fired
- `dedup_merge_history` - Audit trail of all merges with pre-merge snapshots, survivorship_decisions
- `dedup_survivorship_rules` - Field-level rules for automatic winner selection (3 default rules + org-configurable)
- `dedup_auto_merge_settings` - Per-org auto-merge configuration (waiting period, threshold)
- `dedup_decisions` - User accept/reject decisions for probabilistic weight training (**0 records** - accumulates from first merge)
- `dedup_domain_exclusions` - Domains to exclude from dedup (org-configurable)
- `enrichment_field_sources` - Tracks which provider enriched each field (for source_preference rule)
- `company_dedup_index` - Normalized company data for fast in-memory scanning

**Current Status:**
- **120 pending clusters** across Frontera (57) and GrowthBook (63)
- **0 dedup_decisions** - waiting for user to execute first merges/rejects
- **Probabilistic weight engine** - waiting for 500+ decisions before training ML model

### Running the Dedup Worker
```bash
# Start dedup scanner + auto-merge worker (on Railway worker dyno)
npm run worker:dedup

# Or directly
UPSTASH_REDIS_URL=rediss://xxx npx tsx scripts/start-dedup-worker.ts
```

**Worker Jobs:**
- `company-dedup-scan` - Full scan of all companies, builds clusters (runs nightly or on-demand)
- `auto-merge` - Finds clusters due for auto-merge, executes merge (runs every 15 minutes)

**Concurrency:**
- Dedup scanner: 1 (sequential, memory-intensive)
- Auto-merge: 1 (sequential, HubSpot API rate limits)

### Supported Webhook Events (Now Create Clusters)
- `company.creation` - Creates cluster if matches existing company ≥60%
- `company.propertyChange` - Creates cluster if changes trigger duplicate match
- `company.deletion` - Marks clusters as invalid
- `company.merge` - Records HubSpot-initiated merge (placeholder for future API)
- `company.restore` - Reopens clusters (placeholder for future API)

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

## Enrichment Async System

**Status:** Deployed to production (May 29 2026)

### Architecture

**BullMQ queues:**
- `enrich-preview` - Preview enrichment results before applying
- `enrich-apply` - Apply approved enrichments to HubSpot

**Workers:**
- `enrich-preview-worker` - Fetches provider data, applies harmonies, caches results in Redis (10 min TTL)
- `enrich-apply-worker` - Writes approved enrichments to HubSpot via batch writer

**Deployment:** Railway enrichment worker service (separate from dedup/webhook/digest workers)

### Preview Flow

1. User selects fields + providers on Enrich page
2. POST `/api/enrich/preview/enqueue` - creates job in `enrich-preview` queue
3. Preview worker:
   - Fetches companies from HubSpot (respects filters)
   - Calls provider APIs (Apollo, GraphIQ, etc.) with rate limiting
   - Applies harmonies to normalize values
   - Stores preview results in Redis (10 min TTL, key: `preview:${jobId}`)
4. Frontend polls GET `/api/enrich/preview/status` for job completion
5. When complete, GET `/api/enrich/preview/results` fetches from Redis cache
6. UI shows preview table with checkboxes for selective apply

### Apply Flow

1. User selects rows/fields to apply from preview table
2. POST `/api/enrich/apply/enqueue` - creates job in `enrich-apply` queue with selected changes
3. Apply worker:
   - Fetches preview results from Redis cache
   - Filters to selected changes only
   - Writes to HubSpot via `batchUpdateCompanies` (100 records per batch)
   - Updates `arrangement_runs` table with progress
   - Logs completion to `arrangement_run_progress`
4. Frontend polls for completion, shows success/error counts

### History Tracking

**Fixed (May 29 2026):** Enrich preview/apply runs now log to `arrangement_runs` table with `arrangement_id` nullable.

**Before:** Preview runs failed with "arrangement not found" error because `arrangement_id` was required foreign key.

**After:** `arrangement_id` nullable in `arrangement_runs`. Preview runs set `arrangement_id=null`, scheduled runs set `arrangement_id={uuid}`.

**History page:** Shows both arrangement-based runs (scheduled) and preview-based runs (manual) in unified list.

### Deprecation Timeline

**Old sync endpoints:**
- POST `/api/enrich/preview` (synchronous, 30s timeout) → deprecated
- POST `/api/enrich/apply` (synchronous, no progress tracking) → deprecated

**Deprecation headers added:**
```
Sunset: Wed, 01 Jul 2026 00:00:00 GMT
Deprecation: true
Link: </api/enrich/preview/enqueue>; rel="successor-version"
```

**Migration deadline:** July 1, 2026 (clients must switch to async endpoints)

### Redis Cache

**Preview results:**
- Key: `preview:${jobId}`
- TTL: 10 minutes
- Format: JSON array of enriched company records with metadata
- Size: ~1-5 KB per company (100 companies = 100-500 KB)

**Provider responses:**
- Key: `provider:${provider}:${domain}`
- TTL: 24 hours
- Shared across preview jobs (deduplication)

---

## Org Isolation Fix

**Status:** Fixed (May 29 2026)

### Problem

Multi-tenant isolation was broken. Users switching orgs in Clerk saw stale data from previous org. Root cause: `auth()` from `@clerk/nextjs` returns `orgId: null` when user has multiple orgs.

### Root Cause

Clerk stores active org in `sessionClaims.o` but Next.js `auth()` doesn't extract it automatically. The `orgId` field only populates when user has exactly 1 org.

**Session claims structure:**
```typescript
{
  userId: "user_xxx",
  sessionId: "sess_xxx",
  orgId: null,  // ❌ Always null for multi-org users
  sessionClaims: {
    o: {
      id: "org_3EPCVbtxHZLdwMPwi4Q9WOD2iZU",  // ✅ Actual active org
      rol: "org:admin",
      slg: "frontera"
    }
  }
}
```

### Fix

**File:** `lib/auth/clerk-helpers.ts`

**Before:**
```typescript
export async function getOrgContext() {
  const { userId, orgId } = auth()
  if (!userId || !orgId) throw new Error('Unauthorized')
  return { userId, orgId }
}
```

**After:**
```typescript
export async function getOrgContext() {
  const { userId, sessionClaims } = auth()
  if (!userId) throw new Error('Unauthorized')

  // Extract org from sessionClaims.o first (multi-org users)
  let orgId = sessionClaims?.o?.id

  // Fallback to orgId field (single-org users)
  if (!orgId) {
    const { orgId: directOrgId } = auth()
    orgId = directOrgId
  }

  if (!orgId) throw new Error('No active organization')
  return { userId, orgId, orgRole: sessionClaims?.o?.rol }
}
```

### Client-Side Fix

**Problem:** React components with `useEffect(() => {}, [])` didn't re-fetch on org switch.

**Fix:** Add `orgId` to dependency array:

```typescript
// Before
useEffect(() => {
  fetchData()
}, [])  // ❌ Only runs once on mount

// After
useEffect(() => {
  fetchData()
}, [orgId])  // ✅ Re-runs when user switches org
```

**Files fixed:**
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/dedup/page.tsx`
- `app/(dashboard)/settings/page.tsx`
- `app/(dashboard)/history/page.tsx`

### Verification

**Test:** User switches from Frontera → GrowthBook in Clerk org dropdown.

**Before fix:** Dashboard still showed Frontera data (2,835 companies)

**After fix:** Dashboard immediately shows GrowthBook data (20,962 companies)

**Three orgs tested:**
- RevOps Impact: `org_3EO4lJVNFJTFXSaUi8iieMKwFTx` → Portal 24202132
- Frontera Health: `org_3EPCVbtxHZLdwMPwi4Q9WOD2iZU` → Portal 49169539 (2,835 companies)
- GrowthBook: `org_3EO4lJVNFJTFXSaUi8iieMKwFTx` → Portal 8863617 (20,962 companies)

**Note:** GrowthBook and RevOps Impact share `org_3EO4lJVNFJTFXSaUi8iieMKwFTx` - verify if intentional or configuration error.

---

## Security Fixes (May 29 2026)

### Fix 1: Token Encryption ✅

**Status:** Deployed to production

**Implementation:**
- AES-256-GCM encryption for all HubSpot OAuth tokens (access_token, refresh_token)
- New file: `lib/crypto/token-encryption.ts`
- Functions: `encryptToken()`, `decryptToken()`, `isTokenEncrypted()`
- Encryption key: `TOKEN_ENCRYPTION_KEY` env var (Railway + Vercel)
- Backward compatible: `decryptToken()` detects plaintext tokens and returns them unchanged

**Encryption algorithm:**
```typescript
Algorithm: AES-256-GCM
IV length: 16 bytes (random per encryption)
Auth tag: 16 bytes
Encoding: hex
Format: iv:ciphertext:authTag
```

**Migration:**
- Script: `scripts/migrate-encrypt-tokens.ts`
- Run date: May 29, 2026
- Result: 3 HubSpot connections encrypted (Frontera, GrowthBook, RevOps Impact)
- No downtime (backward compatibility handled decryption)

**Files modified:**
- `app/api/hubspot/callback/route.ts` - encrypt tokens before INSERT
- `lib/hubspot/get-access-token.ts` - decrypt on read, encrypt on refresh
- `lib/hubspot/refresh-token.ts` - encrypt new tokens after refresh

**Provider connections:**
- BYOK provider API keys (Apollo, ZoomInfo, Cognism, Clearbit) also encrypted
- Table: `provider_connections.api_key_enc` column
- Same AES-256-GCM algorithm

### Fix 2: Header-Based Auth Bypass ✅

**Status:** Fixed

**Problem:** 4 endpoints trusted `x-org-id` header from request instead of extracting from session.

**Attack vector:** Malicious client sends `x-org-id: victim_org_id` header to access another org's data.

**Endpoints fixed:**
- POST `/api/always-on/config`
- POST `/api/always-on/test-slack`
- GET `/api/always-on/digest-preview`
- POST `/api/always-on/trigger-digest`

**Before:**
```typescript
const orgId = request.headers.get('x-org-id')  // ❌ Trusted user input
```

**After:**
```typescript
const ctx = await getOrgContext()  // ✅ Extract from Clerk session
const orgId = ctx.orgId
```

**Commit:** Added `getOrgContext()` auth check with proper error handling.

### Fix 3: BullMQ Job Enqueueing (Partial) ✅

**Status:** 2 of 3 fixed, 1 reverted

**Fixed:**
1. **Arrangement delete** - DELETE `/api/arrangements/:id` now calls `cancelArrangementJobs(arrangementId)` to stop BullMQ jobs when arrangement is deleted. Prevents deleted arrangements from continuing to run, stops memory leak.

2. **Onboarding scan** - POST `/api/onboarding/scan-trigger` now calls `enqueueScan(orgId, accessToken, true)` to trigger compliance scan. Uses existing compliance scanner queue + worker. New users see real scan running instead of stub.

**Reverted:**
3. **Normalize apply** - POST `/api/normalize/apply` investigation revealed feature **never worked**. Route creates `normalization_runs` record with `status='running'` but has TODO stub instead of actual processing. No HubSpot write path exists. Created `normalize-queue.ts` with no worker (same bug pattern), reverted. Needs full implementation sprint before re-adding queue infrastructure.

**Commits:**
- `81df9ab` - Fix BullMQ job enqueueing for 3 critical endpoints (original commit)
- `8a2b31b` - Revert normalize-queue changes - feature never worked (revert commit)

---

## Known Open Items

### Critical Before Beta

1. **Normalize apply implementation** - Confirmed never worked. Needs full implementation sprint:
   - Create `normalize-worker.ts` script
   - Implement job handler: fetch `normalized_records`, apply harmonies, write to HubSpot
   - Progress tracking in `normalization_runs` table
   - Rollback support (already in schema, never implemented)
   - UI shows "queued" status but nothing happens - fix before customers see it

2. **Next.js 14.2.3 security vulnerability** - Known CVEs in Next.js 14.2.3. Upgrade to 15.0+ before paying customers. Test thoroughly (App Router breaking changes).

3. **Clerk SDK deprecation warnings** - Console shows deprecated imports:
   - `@clerk/types@4.26.0` deprecated
   - `@clerk/clerk-react@5.12.0` deprecated
   - Upgrade to latest Clerk SDK before production launch

### Product Gaps

4. **Arrangement schedule update** - PUT `/api/arrangements/:id` has TODO: "If schedule changed, update BullMQ cron job". Arrangements can have schedules but worker doesn't respect them. Need to wire schedule changes to BullMQ repeatable jobs.

5. **Sync frequency update** - Always-on config has `schedule` field but changing it doesn't update worker cron. Digest worker and compliance scanner ignore schedule changes.

6. **Contact dedup UI** - Tables exist (`contact_dedup_pairs`, `contact_dedup_clusters`) but UI incomplete. Missing:
   - `contact_dedup_index` table (never created)
   - `/dedup/contacts` page (only `/dedup` for companies exists)
   - Contact-specific signals (email, phone, name, company association)

7. **Prospect/Claygent Lite dropped** - Feature was being built but dropped pending Arrangements stabilization. Nav item still exists but leads to incomplete page. Hide before beta launch.

8. **Run detail page errors** - `/history/[id]` shows "Run not found" for some runs. History list shows run, detail page 404s. Possible arrangement_id vs run_id mismatch.

9. **Fill rates showing mock data** - Dashboard shows fill rate percentages but data is hardcoded. Need to calculate actual fill rates from `arrangement_run_progress` table.

10. **dedup_decisions: 0 records** - No merges executed yet. Accumulation starts from first merge. Probabilistic weight engine waiting for 500+ decisions before training ML model.

### Beta Readiness

11. **Team invite flow** - Settings → Team tab exists but invite functionality not built. Users can see team members but can't invite new ones. Blocking multi-user beta testing.

12. **Dashboard onboarding checklist** - "Connect HubSpot" step shows complete even when no connection exists. Need to verify `hubspot_connections` table has active connection before marking complete.

13. **Prospect nav item** - Leads to incomplete page. Hide nav item or build full prospect search feature before beta.

14. **Survivorship rules table** - `specific_value` rule type shows raw key (e.g., "lifecyclestage") instead of human-readable label (e.g., "Lifecycle Stage"). Fixed in Add Rule modal but not in rules table.

---

## Deployment State

### Railway Services (Production)

**Deployment:** US East region, 8GB RAM, 8 vCPU per service, auto-deploys from GitHub `main` branch

| Service | Queues | Workers | Concurrency | Status |
|---------|--------|---------|-------------|--------|
| **enrichment-worker** | `enrich-preview`, `enrich-apply` | Preview worker, Apply worker | 10 | ✅ Running |
| **dedup-worker** | `company-dedup-scan`, `auto-merge` | Dedup scanner, Auto-merge | 1 | ✅ Running |
| **webhook-worker** | `hubspot-webhooks` | Webhook handler | 5 | ✅ Running |
| **digest-worker** | `always-on-digest`, `compliance-scan` | Digest generator, Compliance scanner | 3 | ✅ Running |

**Job queue backend:** Upstash Redis (`UPSTASH_REDIS_URL`)

**Retry policy:** Exponential backoff with jitter (1s, 2s, 4s), max 3 attempts

**Monitoring:** Sentry error tracking on all workers

### Vercel (Production)

**URL:** https://app.refynedata.com

**Framework:** Next.js 15 App Router

**Deployment:** Auto-deploy from GitHub `main` branch

**Environment:** Production (uses production Supabase, Clerk, Stripe)

**Edge functions:** Vercel Edge Runtime for API routes

**CDN:** Vercel Edge Network (global)

### Supabase (Production)

**Project:** `iidsiejbhdpzzmbotybw`

**Database:** PostgreSQL 15

**Migrations:** 056 applied (through `survivorship_decisions` column on `dedup_merge_history`)

**RLS:** Enabled on all org-scoped tables

**Auth:** Service role client for workers, org client for API routes

**Connection pooling:** Enabled (PgBouncer)

**Backups:** Daily automated backups, 7-day retention

### Environment Variables

**Synced across Railway + Vercel:**
- `DATABASE_URL` - Supabase connection string
- `SUPABASE_SERVICE_ROLE_KEY` - Service role for workers
- `UPSTASH_REDIS_URL` - BullMQ backend
- `CLERK_SECRET_KEY` - Clerk authentication
- `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET` - OAuth app
- `TOKEN_ENCRYPTION_KEY` - AES-256-GCM key for token encryption
- `SENTRY_DSN` - Error tracking
- `STRIPE_SECRET_KEY` - Billing integration

**Vercel-only:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Client-side Clerk
- `NEXT_PUBLIC_APP_URL` - https://app.refynedata.com

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

### Session Accomplishments (May 26 2026)

| Accomplishment | Details |
|----------------|---------|
| **GraphIQ end-to-end write confirmed** | First real production write: 44 companies enriched, 0 failures. Full flow working: GraphIQ → harmony → preview → selective write → HubSpot. |
| **Preview review table with selective write** | Found value column with arrow notation: `Healthcare → HOSPITAL_HEALTH_CARE [high]`. Checkboxes for selective write. Select all / Deselect all / Deselect overrides controls. Industry enum validation before write. |
| **Harmony auto-generation** | Connected harmony-generator.ts to preview endpoint. NAICS crosswalk first, Claude fallback. Stored in field_mappings. Second preview confirmed reuse: `[Harmony] Using stored harmony, skipping Claude`. |
| **Gap analysis refresh after apply** | Triggers automatically after successful write. |
| **Completion screen (P4)** | Inline replacement after apply. Shows company count, field breakdown, View in HubSpot, Run another buttons. |
| **HubSpot filterGroup limit fix** | Two-call approach for 6+ fields instead of slicing to 5. Prevents missing records in enrichment scope. |
| **History Run not found fix (P5)** | Fixed column name mismatch, preview apply runs now log to history correctly. |
| **Refyne Search architecture complete** | Full implementation: Serper + DeepSeek V4 Flash via Fireworks.ai. 4 provider files built (serper-client.ts, deepseek-extractor.ts, cache.ts, index.ts). Database tables created (refyne_company_cache, refyne_search_usage). Preview API integration complete. UI confidence display (high/medium/low badges) with evidence tooltips. Cost: $0.14/$0.28 per million tokens. Model: accounts/fireworks/models/deepseek-v4-flash. |

### Session Accomplishments (May 26 2026 - Session 5)

| Accomplishment | Details |
|----------------|---------|
| **New repos created** | refyne-data-platform-ui (data.refynedata.com internal ops dashboard) and refyne-platform (API service, scaffolded, not yet deployed). |
| **Architecture decision: Platform separation** | Data platform is separate API service from Refyne app. data.refynedata.com is internal team ops dashboard only. Refyne app will call platform API instead of providers directly. Platform handles: cache, scraping, extraction, seed ingestion. App handles: HubSpot auth, users, harmony, preview UI. |
| **Data strategy: Proactive cache builder** | Nightly Railway cron job. Seed sources: NPI database (healthcare), G2 (SaaS), Google Maps. Vertical-aware extraction: detect vertical, extract vertical-specific fields. |
| **Claygent Light stack** | Jina.ai scrape + Serper targeted + DeepSeek V4 Flash. Fake progress delay on preview (cache feels like live enrichment). Cross-org domain-level cache: public web data shared, HubSpot data org-scoped. |
| **Refyne Search keys confirmed** | Serper + Fireworks keys working in Vercel. Phone numbers being found (Step Ahead 888-686-1263, Triangle ABA 919-504-4171). Coverage still low: need Jina.ai + website scraping to improve yield. |

### Session Accomplishments (May 29 2026 - Session 6)

| Accomplishment | Details |
|----------------|---------|
| **Dedup scanner stub fixed** | Root cause: pair generation returned empty array (stub). Scanner created clusters with no pairs, no signals, no grades. Fixed by loading entire `company_dedup_index` into memory (1 query), building JavaScript Maps for O(1) lookups (domain, phone, name, LinkedIn), avoiding 25,340+ database queries. Pairs now include full signal data. Performance: Frontera 41s (2,835 companies), GrowthBook 91s (20,962 companies). |
| **Dedup sprints 1-5 complete** | Sprint 1: Signal explainability (signals_fired in ClusterCard), bulk merge history, similarity_signals, dedup_decisions table. Sprint 2: Survivorship rules engine (3 defaults: never_downgrade, prefer_nonempty, tld_disqualifier), rollback/restore UI, started_at fix. Sprint 3: Auto-merge with 24hr waiting period, PendingMergesTab with countdown timers, auto-merge worker every 15 min. Sprint 4: Source preference (graphiq > apollo > zoominfo > cognism > refyne_search > user_entered), most_recent rule, Why column, survivorship audit. Sprint 5: Specific value rule (enum fields, fetches HubSpot picklist), Rollup rule (number fields: max/min/sum/average), Add rule 3-step wizard with field type detection. |
| **Survivorship rules - 6 types live** | 4 default rules seeded: prefer_nonempty (all fields), never_downgrade (lifecyclestage), tld_disqualifier (domain), source_preference (all fields: graphiq > apollo > zoominfo > cognism > refyne_search > user_entered). 3 org-configurable rules: most_recent (all fields), specific_value (enum fields only, user selects preferred HubSpot value), rollup (number fields only: max/min/sum/average). UI: Settings → Policies tab. Rules table shows human-readable labels (fixed in Sprint 5). |
| **Webhook bridge complete** | Unified real-time + batch dedup systems. Before: webhook dedup used in-memory ReviewQueueItems, silent 90% auto-merge, no UI visibility. After: webhooks create database clusters via createDedupClusterFromWebhook(), all matches ≥60% visible in UI, same Grade A/B/C/D system. Hardcoded portal IDs replaced with hubspot_connections table lookup. Event handlers: company.creation, company.deletion, company.merge, company.restore. |
| **120 pending clusters ready** | Frontera: 57 clusters. GrowthBook: 63 clusters. All clusters have complete pairs, signals (domain, linkedin, phone, name, industry, address, executive overlap), and grades (A/B/C/D). Visible in /dedup UI with signal badges, field-level merge preview, Why column showing survivorship rule that won. |
| **Enrichment async system deployed** | BullMQ queues live: enrich-preview (preview enrichment before applying), enrich-apply (write approved to HubSpot). Workers running on Railway enrichment-worker service. Preview results cached in Redis (10 min TTL). History tracking fixed: arrangement_id nullable in arrangement_runs (preview runs set null, scheduled runs set uuid). Deprecation headers on old sync endpoints (Sunset: 2026-07-01). |
| **Org isolation fixed** | Root cause: Clerk stores active org in sessionClaims.o object {id, rol, slg} but auth() returns orgId: null for multi-org users. Fixed getOrgContext() in clerk-helpers.ts to extract sessionClaims.o.id first. Client components fixed: added orgId to useEffect dependency array so they re-fetch on org switch. Three orgs tested: RevOps Impact (org_3EO4lJVNFJTFXSaUi8iieMKwFTx, Portal 24202132), Frontera (org_3EPCVbtxHZLdwMPwi4Q9WOD2iZU, Portal 49169539, 2,835 companies), GrowthBook (org_3EO4lJVNFJTFXSaUi8iieMKwFTx, Portal 8863617, 20,962 companies). Note: GrowthBook and RevOps Impact share org_id - verify. |
| **Security Fix 1: Token encryption** | AES-256-GCM encryption for all HubSpot OAuth tokens (access_token, refresh_token) and BYOK provider API keys. New file: lib/crypto/token-encryption.ts. Encryption key: TOKEN_ENCRYPTION_KEY env var (Railway + Vercel). Migration script run: 3 connections encrypted (Frontera, GrowthBook, RevOps Impact). Backward compatible: decryptToken() handles plaintext legacy tokens. Files modified: hubspot callback (encrypt on insert), get-access-token (decrypt on read, encrypt on refresh). |
| **Security Fix 2: Header-based auth bypass** | Fixed 4 always-on endpoints that trusted x-org-id header instead of extracting from Clerk session. Endpoints: /api/always-on/config, test-slack, digest-preview, trigger-digest. Now all use getOrgContext() to extract orgId from session claims. Prevents malicious client from accessing another org's data. |
| **Security Fix 3: BullMQ job enqueueing** | Arrangement delete: now calls cancelArrangementJobs() to stop BullMQ jobs when arrangement deleted (prevents memory leak, unnecessary API calls). Onboarding scan: now calls enqueueScan() to trigger compliance scan (new users see real scan). Normalize apply: reverted - feature never worked, needs implementation sprint. |
| **Normalize apply investigation** | Confirmed feature never worked. UI calls /api/normalize/apply which has TODO stub. No HubSpot write path exists. No synchronous apply path. applyHarmony is just lookup function with no side effects. Route creates normalization_runs with status='running' but never processes. Created normalize-queue.ts with no worker (same bug pattern), reverted. Needs: normalize worker script, job handler (fetch normalized_records, apply harmonies, write to HubSpot), progress tracking, rollback support. |
| **dedup_decisions: 0 records** | No merges executed yet. Accumulation starts from first merge. Each merge/reject creates decision record with signals + outcome for future ML weight training. Probabilistic weight engine waiting for 500+ decisions before training model. |

### Built but Not End-to-End Verified

| Feature | Status | What Needs Verification |
|---------|--------|------------------------|
| **Normalize** | **Never worked** | Route creates normalization_runs record with status='running' but has TODO stub instead of actual processing. No HubSpot write path exists. Needs full implementation sprint before adding BullMQ queue. |
| Prospect search | Partial | Apollo key fixed, results in browser unconfirmed |
| Arrangements detail | Partial | Crash fixed, content never verified |
| Inline live feed | Partial | Progress bar works, row-by-row feed not populating |
| Worker parallel processing | Complete | Benchmark with 2,816 records needed, target <20 min |
| **Refyne Search** | Built, not tested | Fireworks API key and Serper key not yet verified. Model: deepseek-v4-flash. End-to-end preview test needed on 10 companies. Cache behavior not confirmed. |

### Dedup System Status (May 29 2026)

| Metric | Value |
|--------|-------|
| **Total orgs configured** | 3 (RevOps Impact, Frontera, GrowthBook) |
| **Total companies scanned** | 24,097 (2,835 Frontera + 20,962 GrowthBook + RevOps Impact TBD) |
| **Pending clusters** | 120 total (57 Frontera, 63 GrowthBook) |
| **Grade A clusters (≥97%)** | TBD (breakdown pending re-scan after fix) |
| **Grade B clusters (85-96%)** | TBD (breakdown pending re-scan after fix) |
| **Auto-merge waiting period** | 24 hours (default for Grade A) |
| **Dedup decisions collected** | 0 (accumulation starts from first merge) |
| **Survivorship rules active** | 6 types: prefer_nonempty, never_downgrade, tld_disqualifier, source_preference (4 defaults) + most_recent, specific_value, rollup (3 org-configurable) |
| **Scan performance** | 41s for 2,835 companies (Frontera), 91s for 20,962 companies (GrowthBook) |
| **Scanner status** | ✅ Fully operational - all clusters have complete pairs, signals, grades |

### Not Started

| Feature | Priority |
|---------|----------|
| Haiku extractor (fallback for Refyne Search) | P0 - 5s timeout fallback when DeepSeek V4 Flash slow |
| Normalize queue (BullMQ) | P1 - reverted, needs implementation before re-adding queue |
| Railway worker migration | P1 - auto-scaling for multi-client |
| Salesforce connector | P2 |
| Chrome extension | P3 |

---

## Pending Work — Priority Order

### High Priority (Next Session)

1. **Normalize worker implementation** - Normalize apply currently has TODO stub. Needs full implementation: fetch normalized_records, apply harmonies to each record, write to HubSpot via batchUpdateCompanies, update normalization_runs with results. BullMQ queue infrastructure reverted until actual processing logic exists.

2. **Arrangement schedule update** - PUT /api/arrangements/:id has TODO comment: "If schedule changed, update BullMQ cron job". Arrangements can have schedules but worker doesn't respect them. Need to wire schedule changes to BullMQ repeatable jobs.

3. **Sync frequency update** - Always-on config has schedule field but changing it doesn't update worker cron. Need to handle schedule updates for digest worker and compliance scanner.

4. **Contact dedup UI** - Database tables support contact dedup (contact_dedup_pairs, contact_dedup_clusters). UI only shows company dedup. Need /dedup/contacts page with same pattern as company dedup.

5. **Next.js security upgrade** - Next.js 15 has known vulnerabilities. Upgrade to latest stable release for security patches.

6. **data.refynedata.com UI polish** - Review screenshots from Session 5, polish internal ops dashboard UI. Wire to real Supabase stats (cache hit rate, provider breakdown, vertical distribution).

7. **refyne-platform deployment** - Deploy API service to Railway. Set up environment variables, test health endpoint.

8. **NPI database download and seed ingestion** - Download NPI registry (healthcare providers), parse, seed into refyne_company_cache. First proactive cache build for healthcare vertical.

9. **Jina.ai integration** - Add Jina.ai website scraping to Claygent Light pipeline. Improves yield for companies with websites but no Serper results.

10. **Refyne Search: Wire into provider chain** - Currently runs independently. Wire as fallback: Apollo → GraphIQ → Refyne Search. Test with all three selected.

### Medium Priority

11. **Haiku extractor (fallback)** - Build haiku-extractor.ts for 5s timeout fallback when DeepSeek V4 Flash slow. Wire into extractWithFallback().
12. **Preview context flag** - Pass context: 'preview' | 'background' to refyneSearch(). Preview → Haiku, Background → Haiku head (50) + V4 Flash tail.
13. **Build enrichment review UI** on Enrich page (Spec 1 UI: approve/reject modal for pending enrichments)
14. CSV import workflow (/import page with upload, mapping, preview, confirm)
15. Field mappings guided setup (onboarding flow for canonical ↔ HubSpot mapping)
16. **refyne_record_status table** - track last enriched timestamp per field per company
17. **Job priority queue** - high-priority runs jump ahead of long-running jobs
18. Credit system and pricing page (Stripe metering integration, usage-based pricing)
19. Prospect page canonical schema normalization (merge Apollo + GraphIQ + ZoomInfo results by domain)
20. GitHub Harmonies repo (open-source default library for community contributions)

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
