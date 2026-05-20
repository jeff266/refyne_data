# Prospect Page Implementation

**Status:** Initial implementation complete
**Build:** ✅ Passing
**Date:** 2026-05-20

## Overview

Implemented the Prospect page for company discovery and ICP scoring across multiple enrichment providers (Apollo, ZoomInfo, Refyne). The implementation follows a 4-stage flow: Search → Score → Review → Push.

## Files Created

### Core Logic

**`lib/prospect/types.ts` (133 lines)**
- Type definitions for prospect search, company results, ICP config
- `ProspectSearchQuery` - search filters (industry, size, location, keywords, technologies)
- `ProspectCompany` - standardized company result format
- `ProspectSearchResult` - search result with CRM status and ICP score
- `ICPConfig` - ICP scoring configuration with target criteria and weights

**`lib/prospect/providers/apollo.ts` (172 lines)**
- Apollo.io provider integration for company search
- Maps employee ranges to Apollo's size buckets
- Supports industry, size, location, keyword, and technology filters
- Returns standardized company format

**`lib/prospect/providers/zoominfo.ts` (207 lines)**
- ZoomInfo provider integration with JWT authentication
- Module-level token caching for efficiency
- Maps employee ranges to ZoomInfo size codes
- Supports comprehensive filters including revenue ranges

**`lib/prospect/providers/refyne.ts` (125 lines)**
- Refyne provider stub implementation (pending API docs)
- Follows same interface pattern as Apollo/ZoomInfo
- Ready for implementation once credentials available

**`lib/prospect/providers/index.ts` (7 lines)**
- Central export for all provider search functions

**`lib/prospect/icp-scorer.ts` (192 lines)**
- ICP scoring engine with weighted scoring algorithm
- Four scoring dimensions:
  - Industry match (exact or contains matching)
  - Size match (employee count range with partial credit for proximity)
  - Location match (hierarchical: city > state > country)
  - Technology match (percentage of target technologies present)
- Default weights: industry 35%, size 30%, location 20%, technology 15%
- Returns score (0-100) and breakdown by dimension

**`lib/prospect/merge.ts` (117 lines)**
- Cross-provider deduplication and data merge
- Domain normalization (removes protocol, www, trailing slashes)
- Provider priority: ZoomInfo > Apollo > Refyne
- Merges fields by preferring non-null values from higher-priority providers
- Combines technologies arrays from all providers

**`lib/prospect/search.ts` (145 lines)**
- Search orchestrator coordinating all components:
  1. Queries all enabled providers in parallel
  2. Merges and deduplicates results
  3. Checks CRM status for each company
  4. Scores against ICP (if config provided)
  5. Sorts by ICP score (descending)
- Returns enriched results with provider stats

### API Routes

**`app/api/prospect/search/route.ts` (58 lines)**
- POST /api/prospect/search
- Accepts search query and optional ICP config
- Validates at least one filter is provided
- Returns search results, provider stats, dedup counts

**`app/api/hubspot/companies/batch-check/route.ts` (123 lines)**
- POST /api/hubspot/companies/batch-check
- Batch CRM status check (max 100 domains)
- Uses HubSpot CRM Search API to check domain existence
- Returns in_crm flag, HubSpot company ID, and record URL

### UI Components

**`app/(dashboard)/prospect/page.tsx` (472 lines)**
- Main Prospect page component
- Four-stage flow UI:
  1. **Search Filters** - Industry, keywords, employee count, location
  2. **Score** - ICP config (optional, not yet wired)
  3. **Review** - Results table with CRM status and ICP scores
  4. **Push** - Batch selection and HubSpot push (stub)
- Features:
  - Filter panel with industry, keyword, employee range, location
  - Provider selection (Apollo, ZoomInfo enabled by default)
  - Results table with sortable columns
  - CRM status indicators with HubSpot links
  - ICP score badges (green ≥80, amber ≥60, red <60)
  - Batch selection (select all, deselect all)
  - Provider stats display (count, query time, errors)

### Test Scripts

**`scripts/test-prospect-providers.ts` (68 lines)**
- Provider integration test script
- Tests Apollo and ZoomInfo with sample query
- Displays query time, result count, sample company data
- Usage: `npx tsx scripts/test-prospect-providers.ts`

## Architecture Decisions

### 1. Provider Abstraction
Each provider implements a standard query interface:
```typescript
async function searchCompanies(query: ProspectSearchQuery): Promise<ProviderSearchResponse>
```
This allows adding new providers without changing orchestration logic.

### 2. Domain-Based Deduplication
Companies are deduplicated by normalized domain (primary identifier). This prevents:
- Duplicate results across providers
- Inconsistent data presentation
- Inflated result counts

### 3. Provider Priority for Merge
ZoomInfo > Apollo > Refyne priority based on data comprehensiveness. Higher-priority providers' non-null values are preferred during merge.

### 4. Parallel Provider Queries
All enabled providers are queried in parallel using `Promise.all()` to minimize latency.

### 5. ICP Scoring Algorithm
Weighted scoring across 4 dimensions:
- **Industry:** Exact match or substring match = 100, else 0
- **Size:** In-range = 100, partial credit for proximity (linear decay)
- **Location:** City match = 100, state = 80, country = 60
- **Technology:** Percentage of target technologies present

### 6. CRM Status Check
Batch check using HubSpot CRM Search API (domain filter). Non-blocking - search succeeds even if CRM check fails.

## Environment Variables

Required for provider integrations:
```bash
APOLLO_API_KEY=xxx              # Apollo.io API key
ZOOMINFO_CLIENT_ID=xxx          # ZoomInfo OAuth client ID
ZOOMINFO_CLIENT_SECRET=xxx      # ZoomInfo OAuth client secret
REFYNE_API_KEY=xxx              # Refyne API key (pending)
```

## Testing

### Provider Test
Run before UI testing to verify provider integrations:
```bash
npx tsx scripts/test-prospect-providers.ts
```

Expected output:
```
Testing Apollo...
✅ Apollo: 5 results
   Query time: 1234ms
   Sample: Acme Corp (acme.com)
   Industry: Technology
   Employees: 250

Testing ZoomInfo...
✅ ZoomInfo: 5 results
   Query time: 2345ms
   Sample: Beta Inc (beta.com)
   Industry: Software
   Employees: 180
```

### Build Test
```bash
npm run build
```
Status: ✅ Passing (no TypeScript errors)

## Pending Work

### High Priority
1. **Push Flow Implementation** (app/(dashboard)/prospect/page.tsx:114)
   - Currently shows alert: "Push functionality coming soon"
   - Need to implement:
     - Batch company push to HubSpot
     - Harmony application before write
     - Progress tracking
     - Error handling

2. **ICP Config UI** (not started)
   - Modal or slide-over for ICP configuration
   - Form inputs for target industries, size, location, technologies
   - Weight sliders (must sum to 1.0)
   - Save/load ICP configs per org

3. **Provider API Testing** (recommended before production)
   - Test Apollo API with real credentials
   - Test ZoomInfo API with real credentials
   - Verify employee range mappings are correct
   - Confirm technology filters work as expected

4. **Refyne Integration** (lib/prospect/providers/refyne.ts:31)
   - Pending Refyne API documentation
   - Update payload structure once API spec available
   - Map response structure to ProspectCompany format
   - Test with real credentials

### Medium Priority
5. **Company Detail Slide-Over**
   - Click company row to view full details
   - Display all fields (description, technologies, etc.)
   - Show ICP score breakdown by dimension
   - Edit capability (update company data before push)

6. **Advanced Filters**
   - Technology filters (dropdown with popular technologies)
   - Revenue range filters (min/max USD)
   - Founded year range
   - Geographic radius search

7. **Discovery Results Table** (database migration)
   - Create `discovery_results` table for search history
   - Columns: org_id, query, results, icp_config, created_at
   - Allow users to review past searches
   - Export search results to CSV

8. **Pagination**
   - Currently fixed at 25 results per provider
   - Add pagination controls
   - "Load more" button
   - Infinite scroll option

### Low Priority
9. **Loading States**
   - Skeleton loaders for results table
   - Provider-specific loading indicators
   - Progressive results display (show as providers respond)

10. **Empty States**
    - No results found (suggest adjusting filters)
    - No providers enabled (prompt to enable at least one)
    - CRM check failed (show warning but don't block)

11. **Unit Tests**
    - ICP scorer tests (edge cases, weight validation)
    - Merge logic tests (dedup, priority, technology combination)
    - Provider query builder tests (employee range mapping)

12. **E2E Tests (Puppeteer)**
    - Search flow
    - Filter application
    - ICP scoring
    - Batch selection
    - CRM status check
    - Push to HubSpot

## API Endpoints

### POST /api/prospect/search
Search for prospect companies.

**Request:**
```json
{
  "query": {
    "industries": ["Technology", "Software"],
    "employeeMin": 50,
    "employeeMax": 500,
    "location": { "country": "United States" },
    "keywords": ["SaaS", "B2B"],
    "technologies": ["React", "Node.js"],
    "limit": 25,
    "providers": ["apollo", "zoominfo"]
  },
  "icp_config": {
    "target_industries": ["Technology"],
    "target_employee_min": 100,
    "target_employee_max": 1000,
    "weights": {
      "industry": 0.35,
      "size": 0.30,
      "location": 0.20,
      "technology": 0.15
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "provider": "apollo+zoominfo",
        "domain": "acme.com",
        "name": "Acme Corp",
        "industry": "Technology",
        "employee_count": 250,
        "city": "San Francisco",
        "state": "CA",
        "country": "United States",
        "icp_score": 87,
        "icp_breakdown": {
          "industry_match": 100,
          "size_match": 90,
          "location_match": 80,
          "technology_match": 50,
          "total_score": 87
        },
        "in_crm": false,
        "raw": {}
      }
    ],
    "provider_stats": {
      "apollo": { "count": 15, "query_time_ms": 1234 },
      "zoominfo": { "count": 12, "query_time_ms": 2345 }
    },
    "total_before_dedup": 27,
    "total_after_dedup": 20
  }
}
```

### POST /api/hubspot/companies/batch-check
Check CRM status for multiple domains.

**Request:**
```json
{
  "domains": ["acme.com", "beta.com", "gamma.io"]
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "domain": "acme.com",
      "exists": true,
      "company_id": "123456",
      "hubspot_url": "https://app.hubspot.com/contacts/49169539/company/123456",
      "name": "Acme Corp"
    },
    {
      "domain": "beta.com",
      "exists": false
    }
  ]
}
```

## Design Patterns

### Provider Pattern
Each provider implements the same interface, allowing the orchestrator to treat them uniformly:
```typescript
interface ProviderSearchFunction {
  (query: ProspectSearchQuery): Promise<ProviderSearchResponse>
}
```

### Factory Pattern
The search orchestrator creates provider-specific queries based on configuration:
```typescript
if (enabledProviders.includes('apollo')) {
  providerQueries.push(searchCompaniesApollo(query));
}
```

### Strategy Pattern
ICP scoring uses different strategies for each dimension (industry, size, location, technology), allowing easy extension:
```typescript
const industryScore = scoreIndustry(company, config);
const sizeScore = scoreSize(company, config);
```

### Observer Pattern (Future)
Push flow will notify subscribers of batch progress:
```typescript
// Future implementation
pushBatch(companies, {
  onProgress: (current, total) => setProgress(current / total),
  onComplete: () => showSuccess(),
  onError: (err) => showError(err)
});
```

## Code Quality

- ✅ TypeScript strict mode passing
- ✅ All imports resolved
- ✅ No unused variables
- ✅ Consistent error handling
- ✅ Comprehensive JSDoc comments
- ✅ Follows existing codebase patterns (Refyne design tokens)

## Next Steps

1. **Test Provider APIs** - Run test script with real credentials
2. **Implement Push Flow** - Connect to existing HubSpot batch writer
3. **Add ICP Config UI** - Modal for target criteria setup
4. **Create Unit Tests** - Cover scoring, merge, provider logic
5. **Add Navigation Link** - Update `lib/design-tokens.ts` NAV config
6. **User Documentation** - Add to docs/ with screenshots

## Notes

- Refyne provider is stubbed pending API documentation
- Push flow uses placeholder - needs integration with batch writer
- ICP config UI not implemented - users must pass config via API
- Provider stats show in footer but no detailed breakdown UI
- No rate limiting on provider APIs yet - add if needed
- CRM check is non-blocking to ensure search always succeeds
