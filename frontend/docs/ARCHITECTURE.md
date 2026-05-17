# Harmonies Normalization Engine - Architecture Document

> Last updated: 2026-05-16
> Status: Active development

## Overview

The Harmonies engine normalizes data from multiple enrichment providers into canonical company/person entities. It sits within the Enrichment Switcher application (Next.js frontend, TypeScript throughout).

---

## Provider Port Assessment

### Inspection Results (from actual Python files)

| Provider | Lines | Pagination | Token Refresh | Retry/Backoff | Rate Limit | Error Mapping | BYOK |
|----------|-------|------------|---------------|---------------|------------|---------------|------|
| serper.py | 60 | None | N/A | None | None | None | Minimal |
| apollo.py | 123 | None | N/A | None | None | None | Minimal |
| zoominfo.py | 139 | None | Partial* | None | None | None | Minimal |
| clay.py | 99 | N/A | N/A | None | None | None | Minimal |
| graphiq.py | 139 | None | N/A | None | None | None | Minimal |
| yelp.py | 293 | None | N/A | None | None | Partial** | Minimal |
| **Total** | **853** | | | | | | |

*ZoomInfo has `_get_access_token()` that caches JWT in a global variable, but: no expiration check, no refresh on 401, no token invalidation.

**Yelp checks for GraphQL errors in response and raises Exception, but no structured error types.

### Non-Trivial Logic Present

**serper.py (60 lines)**
- Single function: `search_local_businesses()`
- Response transformation: field mapping only
- No complex logic

**apollo.py (123 lines)**
- `enrich_company()`: domain/name lookup
- `search_contacts()`: people search with title filter
- `_format_revenue()`: revenue number formatting (11 lines)
- No pagination cursor handling despite `per_page` param

**zoominfo.py (139 lines)**
- `_get_access_token()`: JWT auth with global cache (23 lines)
- `enrich_company()`: dual API calls (company + contacts)
- `_format_revenue()`: revenue formatting (15 lines)
- Token caching but NO: expiration tracking, 401 retry, refresh flow

**clay.py (99 lines)**
- ~50 lines are mock implementation (`_generate_mock_brief`)
- Actual API integration: webhook POST only
- `check_claygent_status()`: placeholder, not implemented

**graphiq.py (139 lines)**
- `search_by_capabilities()`: capability-based search
- `search_organizations()`: general search with filters
- `_format_location()`: location string builder (8 lines)
- Two functions share duplicate response transformation (~30 lines each)

**yelp.py (293 lines)**
- **Async implementation** (httpx, different from others using requests)
- GraphQL query strings (~80 lines)
- `transform_response()` / `transform_business()`: response normalization
- `format_hours()`: hours array formatting (19 lines)
- Category mapping dict (14 entries)
- Largest provider, async paradigm change

### Port Complexity Assessment

| Category | Current State | Required for Production | Effort |
|----------|---------------|------------------------|--------|
| Basic API calls | Present | Keep | Low |
| Response transformation | Present | Keep + enhance | Low |
| Pagination | **Missing** | Required (Apollo, ZoomInfo, GraphIQ) | Medium |
| Token refresh | **Incomplete** | Required (ZoomInfo) | Medium |
| Retry with backoff | **Missing** | Required (all) | Medium |
| Rate limit handling | **Missing** | Required (all) | Medium |
| Structured errors | **Missing** | Required (all) | Medium |
| BYOK multi-tenant | **Missing** | Required (all) | High |
| Async consolidation | Mixed | Decide: all sync or all async | Medium |

### Conclusion

**Decision: TypeScript consolidation (locked)**

Two separate cost categories:

| Category | Estimate | Notes |
|----------|----------|-------|
| **Port cost** | 853 lines | Mechanical conversion of existing PoC wrappers. Straightforward, few days of work. |
| **Production build cost** | 1,500-2,000 lines | Pagination, retry, rate limiting, structured errors, BYOK storage. Language-agnostic work required regardless of runtime choice. |

The production build cost is not a TypeScript tax—it applies to any implementation. The port itself is mechanical.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| BYOK credential security | Medium | High | Use encrypted storage, audit logging |
| Rate limit conflicts (multiple orgs) | Medium | Medium | Per-org rate tracking, queue with priority |
| ZoomInfo token expiration | High | Low | Implement proper refresh flow first |
| Yelp async/sync mismatch | Medium | Low | Port all to async, use connection pooling |
| Production logic scope creep | Medium | Medium | Define MVP feature set per provider before porting |

---

## Normalization Mode Design

### Problem Statement

Users need two modes:
- **Implicit**: Normalization runs automatically on every data pull
- **Explicit**: Normalization is a separate user-initiated step

This affects request flow architecture, not just a settings toggle.

### Implicit Mode

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌────────────┐
│   Request   │───▶│   Provider   │───▶│   Harmonies     │───▶│  Response  │
│  (domain)   │    │   Adapter    │    │   Pipeline      │    │ (canonical)│
└─────────────┘    └──────────────┘    └─────────────────┘    └────────────┘
                          │                    │
                          │ raw data           │ normalized
                          ▼                    ▼
                   provider-specific      CanonicalCompany
```

**Characteristics:**
- Engine sits IN the response path
- Every pull returns normalized data
- No raw data exposure to caller
- Latency added to every request (~10-50ms for normalization)
- Org's default pipeline auto-applied

**Implementation:**
- Pipeline configured at org level in settings
- Provider adapter calls `harmonies.normalize(rawData, orgPipeline)`
- Response always typed as `CanonicalCompany` or `CanonicalPerson`

### Explicit Mode

```
┌─────────────┐    ┌──────────────┐    ┌────────────┐
│   Pull      │───▶│   Provider   │───▶│  Raw Data  │
│  Request    │    │   Adapter    │    │  Response  │
└─────────────┘    └──────────────┘    └────────────┘

                        (later)

┌─────────────┐    ┌─────────────────┐    ┌────────────┐
│  Normalize  │───▶│   Harmonies     │───▶│ Normalized │
│  Request    │    │   Pipeline      │    │  Response  │
└─────────────┘    └─────────────────┘    └────────────┘
```

**Characteristics:**
- Pull and normalize are separate operations
- Raw provider data returned first
- User can inspect raw before normalizing
- User can choose which pipeline to apply
- Supports batch normalization of historical data

**Implementation:**
- Pull returns provider's native format (with `_source` metadata)
- Separate `normalize()` call with explicit pipeline selection
- Can normalize previously-pulled data

### MCP Tool Surface Decision

**Decision: Separate tools, always available**

```
enrichment_pull      - Fetch data from provider(s), return raw or normalized based on mode
enrichment_normalize - Apply Harmony pipeline to data (always available, any mode)
harmony_list         - List available Harmonies for field/entity
harmony_test         - Test a Harmony against sample data
```

**Justification:**
1. `enrichment_normalize` is always available—mode only controls whether `enrichment_pull` auto-normalizes
2. Implicit-mode orgs may still call normalize directly (re-normalize, batch historical data, test pipelines)
3. Separating concerns allows batch operations (`normalize` on array of records)
4. Testing Harmonies shouldn't require pulling live data

**Mode behavior:**
- **Implicit mode**: `enrichment_pull` auto-normalizes by default (`normalize: true`)
- **Explicit mode**: `enrichment_pull` returns raw by default (`normalize: false`)
- Both modes: `enrichment_normalize` always available for direct invocation

**Tool Signatures:**

```typescript
// Pull with optional normalization
enrichment_pull({
  provider: 'apollo' | 'zoominfo' | 'serper' | ...,
  query: { domain?: string, name?: string, ... },
  normalize?: boolean,        // default: org's implicit setting
  pipeline?: string,          // override default pipeline
}): ProviderResponse | CanonicalEntity

// Explicit normalization
enrichment_normalize({
  data: ProviderResponse | ProviderResponse[],
  pipeline?: string,          // default: org's default pipeline
  entity: 'company' | 'person',
}): CanonicalEntity | CanonicalEntity[]
```

---

## Data Flow: Normalize-then-Resolve

### Problem

Previous design had resolution (step 5) before normalization (step 6). This breaks:
- **Consensus strategy**: Cannot detect "ACME CORPORATION" = "Acme Corp" without normalization
- **Conservative strategy**: Cannot compare "$15M" vs 15000000 without parsing

### Corrected Flow

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                        Multi-Provider Enrichment Flow                         │
└───────────────────────────────────────────────────────────────────────────────┘

Step 1: Request
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 2: Fan-out to Providers (parallel)                                    │
│                                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                                     │
│  │ Apollo  │  │ZoomInfo │  │ Serper  │  ...                                │
│  └────┬────┘  └────┬────┘  └────┬────┘                                     │
│       │            │            │                                           │
│       ▼            ▼            ▼                                           │
│   Raw Data     Raw Data     Raw Data                                        │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 3: NORMALIZE EACH PROVIDER'S DATA (per-provider, parallel)           │
│                                                                             │
│  For each provider result:                                                  │
│    1. Apply provider-specific adapter (field mapping)                       │
│    2. Run Harmony pipeline for each field                                   │
│    3. Output: NormalizedCandidate per field                                │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Apollo          │  │ ZoomInfo        │  │ Serper          │             │
│  │ normalized      │  │ normalized      │  │ normalized      │             │
│  │                 │  │                 │  │                 │             │
│  │ name: "Acme Co" │  │ name: "Acme Co" │  │ name: "Acme Co" │             │
│  │ revenue: 15M    │  │ revenue: 15M    │  │ revenue: null   │             │
│  │ employees: 150  │  │ employees: 142  │  │ employees: null │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 4: RESOLVE ACROSS NORMALIZED CANDIDATES                              │
│                                                                             │
│  For each canonical field:                                                  │
│    1. Collect normalized candidates from all providers                     │
│    2. Apply resolution strategy (priority | recency | consensus | conserv) │
│    3. Output: ResolvedField<T> with winning value + provenance            │
│                                                                             │
│  Example: company.name                                                      │
│    Candidates: ["Acme Co", "Acme Co", "Acme Co"] → consensus: "Acme Co"    │
│                                                                             │
│  Example: company.employee_count                                            │
│    Candidates: [150, 142] → conservative: 142 (lower), or priority: 150    │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 5: Assemble CanonicalEntity                                          │
│                                                                             │
│  CanonicalCompany {                                                         │
│    name: ResolvedField<"Acme Co">,                                         │
│    revenue: ResolvedField<15000000>,                                       │
│    employee_count: ResolvedField<150>,                                     │
│    _meta: { providers_used: ["apollo", "zoominfo", "serper"], ... }        │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
Step 6: Return Response
```

### Why This Ordering Works

| Strategy | Requires Normalization First? | Example |
|----------|-------------------------------|---------|
| Priority | No, but benefits from it | Values are comparable after normalization |
| Recency | No | Uses timestamp, not value comparison |
| Consensus | **Yes** | "ACME CORP" vs "Acme Corp" → both become "Acme Corp" → match |
| Conservative | **Yes** | "$15M" vs 15000000 → both become 15000000 → can compare |

### Implementation in Pipeline

```typescript
interface NormalizedCandidate<T> {
  value: T;                    // Post-normalization value
  raw_value: unknown;          // Original provider value
  source: string;              // Provider ID
  retrieved_at: string;        // ISO timestamp
  harmony_applied: string;     // Harmony ID that transformed it
}

interface ResolverInput<T> {
  field: string;               // Canonical field path
  candidates: NormalizedCandidate<T>[];
  strategy: ResolutionStrategy;
}

// Pipeline execution order
async function enrichAndNormalize(
  request: EnrichmentRequest
): Promise<CanonicalCompany> {
  // Step 2: Fan-out
  const rawResults = await Promise.all(
    request.providers.map(p => p.fetch(request.query))
  );

  // Step 3: Normalize each provider's data
  const normalizedResults = await Promise.all(
    rawResults.map(raw => normalizeProviderData(raw, request.pipeline))
  );

  // Step 4: Resolve across normalized candidates
  const resolved = resolveAcrossProviders(
    normalizedResults,
    request.resolutionStrategy
  );

  // Step 5: Assemble
  return assembleCanonicalCompany(resolved);
}
```

---

## Unverified Items

The following items have NOT been validated and should be marked as assumptions:

| Item | Status | Needs |
|------|--------|-------|
| JSONata performance at scale | Unverified | Load testing with 1000+ records |
| Supabase RLS performance | Unverified | Benchmark with multi-tenant queries |
| Redis cache hit rates | Unverified | Production metrics needed |
| Provider API rate limits | Partially known | Document limits per provider |

---

## Phase Dependencies

```
Phase 1 ✓ Canonical Entities
Phase 2 ✓ Spec Parser
Phase 3 ✓ JSONata Runner
Phase 4   Execution Engine ← (ready to start)
Phase 5   Pipeline & Resolver ← (blocked by 4, design accepted)
Phase 6   Provider Adapters ← (blocked by 5)
```

**Accepted decisions:**
- Implicit/explicit mode design (with normalize tool always available)
- Normalize-before-resolve ordering

**Locked decisions:**
- TypeScript consolidation (do not reopen)
