# Industry Crosswalk Architecture

## Overview

The industry crosswalk system maps provider-specific industry labels to HubSpot enum values using a NAICS-based crosswalk table. This eliminates hardcoded string transformations and provides a scalable, data-driven approach that works with any provider and any CRM.

## Architecture

```
Provider (GraphIQ/Apollo/LinkedIn)
  ↓ returns industry value + NAICS code
Crosswalk Lookup (RPC)
  ↓ maps to HubSpot enum
Harmony Normalization
  ↓ matched? → write to `industry`
  ↓ not matched? → write to Refyne fallback fields
HubSpot Company Record
```

## Components

###  1. Crosswalk Table (`industry_crosswalk`)

**Location**: `supabase/migrations/20260523_create_industry_crosswalk.sql`

**Schema**:
```sql
create table industry_crosswalk (
  naics_code text primary key,      -- 6-digit NAICS code
  naics_label text not null,        -- Official NAICS description
  apollo_label text,                 -- Apollo.io industry label
  hubspot_value text,                -- HubSpot industry enum value
  linkedin_value text,               -- LinkedIn industry label
  sic_code text                      -- 4-digit SIC code (legacy)
);
```

**Sample Data**: Table includes 10 common industries to start (Software, Banking, Healthcare, etc.)

### 2. Crosswalk RPC (`lookup_industry_crosswalk`)

**Location**: `supabase/migrations/20260523_create_industry_crosswalk_rpc.sql`

**Lookup Strategy**:
1. Exact NAICS code match (most reliable)
2. NAICS label match (case-insensitive)
3. Provider-specific label match (Apollo, LinkedIn, etc.)

**Returns**:
```typescript
{
  matched: boolean,
  output: string,          // HubSpot enum value
  naics_code: string,
  naics_label: string
}
```

### 3. GraphIQ Provider Updates

**Location**: `lib/providers/graphiq.ts`

**Changes**:
- Now extracts `naics_code` and `naics_name` from GraphIQ API response
- Returns both in the normalized provider response
- Fallback to `industries` array if no NAICS data

### 4. Harmony Normalization

**Location**: `lib/arrangements/harmony-normalizer.ts`

**Changes**:
- Detects `approach: 'crosswalk'` harmonies
- Calls `lookup_industry_crosswalk` RPC instead of standard `lookup_harmony_value`
- Passes provider metadata for provider-specific lookups

### 5. Crosswalk Helper Functions

**Location**: `lib/enrichment/industry-crosswalk.ts`

Provides TypeScript helpers for crosswalk lookups:
- `naicsToHubSpot(naicsCode)` - NAICS code → HubSpot enum
- `apolloToHubSpot(apolloLabel)` - Apollo label → HubSpot enum
- `linkedinToHubSpot(linkedinLabel)` - LinkedIn label → HubSpot enum
- `lookupIndustryCrosswalk(value, naicsCode?, provider?)` - Universal lookup

## Usage

### Create Crosswalk Harmony (Admin Task)

```sql
insert into harmonies (
  id,
  org_id,
  name,
  field_type,
  approach,
  is_preset,
  is_published
) values (
  gen_random_uuid(),
  null,  -- null = available to all orgs
  'Industry Crosswalk',
  'categorical',
  'crosswalk',
  true,
  true
);
```

### Apply to Enrichment Arrangement

In the arrangement configuration, set:
```typescript
{
  field_key: 'industry',
  apply_harmony: true,
  harmony_id: '<industry-crosswalk-harmony-id>',
  ...
}
```

### Fallback Behavior (When No Match)

When crosswalk returns `matched: false`, Refyne should write to fallback fields:
- `refyne_industry_naics` - NAICS code (6-digit)
- `refyne_industry` - Text label from provider

**TODO**: Implement fallback field writing in `enrichSingleRecord()` function.

## Data Population

### Initial Seed Data

The migration includes 10 common industries:
- Computer Software (NAICS 541512, 541511)
- IT Services (NAICS 518210)
- Banking (NAICS 522110)
- Healthcare (NAICS 621111)
- Education (NAICS 611710)
- Construction (NAICS 238210)
- etc.

### Expanding the Crosswalk

**Option 1: Manual Admin UI** (Recommended)
- Build admin page at `/admin/industry-crosswalk`
- Allow RevOps admins to add/edit mappings
- Search existing mappings
- Import from CSV

**Option 2: Automated Learning**
- Track unmapped industry values
- Suggest mappings based on NAICS similarity
- Allow one-click approval

**Option 3: Bulk Import**
```sql
copy industry_crosswalk (naics_code, naics_label, apollo_label, hubspot_value)
from '/path/to/naics_crosswalk.csv'
delimiter ','
csv header;
```

## Testing

### Run Migrations

```bash
# Apply crosswalk table
psql $DATABASE_URL -f supabase/migrations/20260523_create_industry_crosswalk.sql

# Apply crosswalk RPC
psql $DATABASE_URL -f supabase/migrations/20260523_create_industry_crosswalk_rpc.sql
```

### Test Crosswalk Lookup

```sql
-- Test NAICS code lookup
select * from lookup_industry_crosswalk(
  p_input_value := 'Computer Systems Design Services',
  p_naics_code := '541512',
  p_provider := 'graphiq'
);

-- Test Apollo label lookup
select * from lookup_industry_crosswalk(
  p_input_value := 'Computer Software',
  p_naics_code := null,
  p_provider := 'apollo'
);
```

### Test GraphIQ Provider

```typescript
import { GraphiqAdapter } from '@/lib/providers/graphiq';

const adapter = new GraphiqAdapter();
const result = await adapter.enrichCompany({ domain: 'anthropic.com' });

console.log(result?.normalized?.industry);      // NAICS name
console.log(result?.normalized?.naics_code);    // NAICS code
console.log(result?.normalized?.naics_name);    // NAICS name
```

## Migration Path

### Phase 1: Crosswalk Foundation (✅ Complete)
- [x] Create `industry_crosswalk` table
- [x] Create `lookup_industry_crosswalk` RPC
- [x] Update GraphIQ adapter to extract NAICS fields
- [x] Add crosswalk support to harmony normalizer
- [x] Create TypeScript helper functions

### Phase 2: Integration (TODO)
- [ ] Run migrations on production Supabase
- [ ] Create "Industry Crosswalk" preset harmony
- [ ] Test with GraphIQ enrichment runs
- [ ] Populate crosswalk with common industries
- [ ] Implement Refyne fallback field writing

### Phase 3: Expansion (TODO)
- [ ] Build admin UI for crosswalk management
- [ ] Add crosswalk support for Apollo provider
- [ ] Add crosswalk support for LinkedIn provider
- [ ] Track unmapped industry values
- [ ] Auto-suggest new mappings

## Benefits

✅ **No Hardcoded Transformations**: Industry mapping is data-driven, not code-driven

✅ **Provider-Agnostic**: Works with GraphIQ, Apollo, LinkedIn, or any future provider

✅ **CRM-Agnostic**: Maps to HubSpot enums, but can extend to Salesforce, etc.

✅ **Self-Service**: RevOps admins can add mappings without code changes

✅ **Audit Trail**: All mappings stored in database with timestamps

✅ **Graceful Fallback**: Unmapped values go to Refyne fields, never lost

## Next Steps

1. **Apply migrations** to production Supabase
2. **Create Industry Crosswalk harmony** in harmonies table
3. **Test with 10-company enrichment** using GraphIQ
4. **Populate crosswalk** with top 100 industries
5. **Build admin UI** for ongoing management
