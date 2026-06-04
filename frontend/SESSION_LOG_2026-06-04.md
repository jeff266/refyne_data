# Session Log - June 4, 2026

## Session Overview
- **Date**: June 4, 2026
- **Duration**: ~3 hours
- **Focus**: Dedup policies implementation, Refyne+Search research, database audit

---

## 1. Dedup Policies Implementation (D3 Feature) ✅

### Objective
Implement configurable merge policies for dedup operations with field-level rules, compliance fields, and exclusion criteria.

### Deliverables

#### Migration 076: `dedup_policies` Table
- Created table with org-specific configurations
- Exclusion rules: `block_if_different_parent`, `block_if_closed_won_deals`
- Compliance fields JSONB array (email opt-out, bounce, legal basis)
- Field rules JSONB supporting 8 merge rule types
- Seeded `__default__` policy with lifecyclestage + fill_empty wildcard
- Applied to Supabase successfully

#### Merge Executor (`lib/dedup/merge-executor.ts`)
**8 Merge Rule Types:**
- `fill_empty` - Use duplicate value if master is blank
- `keep_master` - Always use master value
- `append_both` - Concatenate both values with separator
- `keep_highest` / `keep_lowest` - Numeric comparison
- `keep_newest` / `keep_oldest` - Date-based selection
- `keep_most_advanced` - Funnel stage progression (e.g., lifecyclestage)

**Key Functions:**
- `loadDedupPolicy()` - Fetches org policy or falls back to __default__
- `checkExclusionRules()` - Blocks merges based on conditions
- `applyFieldRules()` - Applies field-level merge logic
- Compliance field enforcement (always most restrictive value)
- `executeMerge()` - Complete policy-driven merge execution

#### API Routes
- `GET /api/settings/dedup-policies` - Load active policy or default
- `POST /api/settings/dedup-policies` - Create/update org policy with validation

#### Settings UI (`/settings/policies/dedup`)
**4 Sections:**
1. **Policy Name** - Custom naming
2. **Exclusion Rules** - Checkboxes for blocking conditions
3. **Compliance Fields** - Add/remove fields enforced across merges
4. **Field Merge Rules** - Reorderable list with inline config
   - Up/down buttons for rule ordering
   - Inline config for `keep_most_advanced` (funnel order)
   - Inline config for `append_both` (separator)

#### Integration
- Wired `executeMerge()` into `/api/dedup/clusters/[id]/merge/route.ts`
- Replaced direct HubSpot API calls (lines 111-226)
- Manual field selections override policy rules
- Applied rules tracked in `survivorshipDecisions` for audit trail
- Added link to policies page in `PoliciesTab.tsx`

#### Backward Compatibility
✅ Default policy matches current behavior:
- `lifecyclestage` → `keep_most_advanced` (never downgrade)
- `*` → `fill_empty` (prefer non-empty values)

✅ Existing merge flow preserved - policies are opt-in enhancement

✅ Manual field selections still supported and override policy

### Test Results
**All 949 tests pass** - No regressions

### Commit
```
13d5d5b feat: dedup policies (migration 076, merge executor, settings UI)
```

### Files Modified/Created
- `supabase/migrations/20260604000000_076_dedup_policies.sql` (new)
- `lib/dedup/merge-executor.ts` (new)
- `app/api/settings/dedup-policies/route.ts` (new)
- `app/(dashboard)/settings/policies/dedup/page.tsx` (new)
- `app/api/dedup/clusters/[id]/merge/route.ts` (modified)
- `components/settings/PoliciesTab.tsx` (modified)

---

## 2. Refyne+Search Architecture Research 📊

### Objective
Document APIs and tools used in Refyne+Search enrichment feature.

### APIs & Services Identified

#### 1. Serper API (Google Search)
- **URL**: `https://google.serper.dev/search`
- **Keys**: `SERPER_API_KEY` or `REFYNE_SERPER_KEY`
- **Purpose**: Runs 1-3 targeted Google searches per company
- **Queries**:
  - LinkedIn company page by domain
  - LinkedIn company page by name
  - General web search with optional industry context
  - Domain fallback search
- **File**: `lib/providers/refyne-search/serper-client.ts`

#### 2. Jina Reader API (Homepage Extraction)
- **URL**: `https://r.jina.ai/https://{domain}`
- **Keys**: `JINA_API_KEY` or `REFYNE_JINA_KEY`
- **Purpose**: Fetches full homepage content in parallel with Serper
- **Timeout**: 8 seconds
- **Max content**: 3000 chars
- **File**: `lib/providers/refyne-search/jina-client.ts`

#### 3. Fireworks.ai (DeepSeek V4 Flash)
- **URL**: `https://api.fireworks.ai/inference/v1/chat/completions`
- **Model**: `accounts/fireworks/models/deepseek-v4-flash`
- **Keys**: `FIREWORKS_API_KEY` or `REFYNE_FIREWORKS_KEY`
- **Purpose**: AI extraction from search results → structured data
- **Pricing**: $0.14/M input, $0.28/M output
- **Timeout**: 5 seconds (background mode)
- **File**: `lib/providers/refyne-search/deepseek-extractor.ts`

#### 4. Anthropic API (Claude Haiku 4.5 - Fallback)
- **URL**: `https://api.anthropic.com/v1/messages`
- **Model**: `claude-haiku-4-5-20251001`
- **Keys**: `ANTHROPIC_API_KEY` or `REFYNE_ANTHROPIC_KEY`
- **Purpose**:
  - Always used in preview context (fast UI feedback)
  - Fallback when DeepSeek times out (background)
  - Industry classification when NAICS crosswalk misses
- **Pricing**: $0.80/M input, $4/M output
- **File**: `lib/providers/refyne-search/haiku-extractor.ts`

### Architecture Flow

```
1. Cache Check (Supabase refyne_company_cache)
   ↓ (miss)
2. Parallel Data Gathering:
   - Serper: 1-3 Google searches
   - Jina: Homepage content
   ↓
3. AI Extraction (context-dependent):
   - Preview: Haiku (fast, 1-2s)
   - Background: DeepSeek V4 Flash → Haiku fallback (5s timeout)
   ↓
4. Industry Post-Processing:
   - NAICS crosswalk lookup (exact/fuzzy)
   - If miss → Haiku classification → cache
   ↓
5. Cache Storage (confidence >= 0.70 only)
6. Usage Logging (refyne_search_usage)
```

### Database Tables
- **refyne_company_cache**: Domain-keyed cross-org cache with per-field TTLs
- **refyne_search_usage**: 1,352 rows - org-level cost tracking
- **naics_to_hubspot_crosswalk**: Industry classification mapping

### Confidence Levels
- **High (0.85+)**: Multiple authoritative sources
- **Medium (0.60-0.84)**: Single authoritative source
- **Low (0.40-0.59)**: Indirect evidence
- **Insufficient (<0.40)**: Not used

### Key Files
- `lib/providers/refyne-search/index.ts` - Main interface
- `lib/providers/refyne-search-adapter.ts` - Provider adapter
- `lib/providers/refyne-search/serper-client.ts`
- `lib/providers/refyne-search/jina-client.ts`
- `lib/providers/refyne-search/deepseek-extractor.ts`
- `lib/providers/refyne-search/haiku-extractor.ts`
- `lib/providers/refyne-search/industry-classifier.ts`
- `lib/providers/refyne-search/cache.ts`

---

## 3. Database Audit (Supabase MCP) 🗄️

### Total Tables: 77

**Tables by Status:**
- RLS Enabled: 65 tables ✅
- RLS Disabled: 12 tables ⚠️

**Top Tables by Row Count:**
1. `company_dedup_index` - 68,409 rows
2. `arrangement_run_progress` - 16,000 rows
3. `normalized_records` - 9,940 rows
4. `refyne_search_usage` - 1,352 rows
5. `harmony_reference_data` - 901 rows

**Table Categories:**
- **Dedup System**: 13 tables
- **Harmonies/Normalization**: 11 tables
- **Enrichment**: 9 tables
- **Refyne Search**: 2 tables
- **Taxonomy**: 3 tables
- **Infrastructure**: ~39 tables

### ⚠️ Security Advisory

**12 tables have RLS disabled**, fully exposed to anon key:
- `dedup_decisions`
- `dedup_survivorship_rules`
- `dedup_auto_merge_settings`
- `dedup_policies` (newly created)
- `enrichment_field_sources`
- `normalization_run_progress`
- `harmony_field_assignments`
- `job_title_cache`
- `job_segmentation_runs`
- `sub_industry_packs`
- `sub_industry_pack_entries`
- `taxonomy_suggestions`

**Action Required**: Enable RLS with appropriate policies before production.

---

## 4. HubSpot API Testing 🔍

### RevOps Impact Portal
- **Portal ID**: 24202132
- **Org ID**: org_3DuSdb0FBnx7RMLmJSUegrpiNLS
- **Total Contacts**: 7,143

### Most Recent Contact
- **Contact ID**: 226382578345
- **Email**: inbox@agentdeployment.co
- **Created**: June 4, 2026 at 10:32:42 AM (TODAY)
- **URL**: https://app.hubspot.com/contacts/24202132/record/0-1/226382578345

### API Details
- **Endpoint**: `https://api.hubapi.com/crm/v3/objects/contacts/search`
- **Method**: POST with search body
- **Sort**: `sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }]`
- **Authentication**: Bearer token via `getAccessToken(orgId)`

### Top 5 Recent Contacts (June 4, 2026):
1. inbox@agentdeployment.co - 10:32 AM
2. kl022lklk@gmail.com - 4:06 AM
3. vjtech97@gmail.com - 12:41 AM
4. cristiano@smithcorona.com - June 3, 7:55 PM
5. tim.bourcier@merge.dev - June 3, 6:58 PM

---

## Technical Decisions & Notes

### Dedup Policies
- Default policy ensures zero breaking changes
- Policy-driven approach allows per-org customization
- Compliance fields always enforced (legal/GDPR requirement)
- Field rules support inheritance (specific field overrides wildcard)

### Refyne+Search
- Multi-tier architecture: cache → search → extract → classify
- Cost optimization via cross-org caching (domain-level)
- Context-aware extraction (preview=Haiku, background=DeepSeek)
- Industry post-processing via NAICS crosswalk reduces hallucinations

### Security
- 12 tables need RLS policies before production
- Token encryption working correctly (TOKEN_ENCRYPTION_KEY required)
- OAuth token refresh handled automatically by `getAccessToken()`

---

## Next Steps

### Immediate
- [ ] Enable RLS on 12 tables with appropriate org-scoped policies
- [ ] Test dedup policies UI with real merge scenarios
- [ ] Monitor Refyne+Search cache hit rate

### Short-term
- [ ] Add policy templates for common merge scenarios
- [ ] Implement policy preview/dry-run before activation
- [ ] Add admin dashboard for Refyne+Search cost tracking

### Long-term
- [ ] ML-based merge rule suggestions from merge history
- [ ] Multi-org policy inheritance (parent → child orgs)
- [ ] A/B testing framework for merge policies

---

## Commands Used

```bash
# Apply migration
# Via Supabase MCP: mcp__supabase__apply_migration

# Run tests
npm test  # 949 passing

# Get HubSpot access token
NEXT_PUBLIC_SUPABASE_URL="..." \
SUPABASE_SERVICE_ROLE_KEY="..." \
TOKEN_ENCRYPTION_KEY="..." \
npx tsx -e "import { getAccessToken } from './lib/hubspot/get-access-token.js'; ..."

# Count Supabase tables
# Via Supabase MCP: mcp__supabase__list_tables

# Query database
# Via Supabase MCP: mcp__supabase__execute_sql
```

---

## Files Created This Session

1. `supabase/migrations/20260604000000_076_dedup_policies.sql`
2. `lib/dedup/merge-executor.ts`
3. `app/api/settings/dedup-policies/route.ts`
4. `app/(dashboard)/settings/policies/dedup/page.tsx`
5. `SESSION_LOG_2026-06-04.md` (this file)

## Files Modified This Session

1. `app/api/dedup/clusters/[id]/merge/route.ts`
2. `components/settings/PoliciesTab.tsx`

---

**Session completed successfully. All objectives achieved.**
