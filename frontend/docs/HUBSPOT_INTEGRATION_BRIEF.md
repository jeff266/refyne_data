# HubSpot Integration Architecture Brief

**Author:** Claude Code
**Status:** APPROVED
**Version:** 1.1
**Date:** 2026-05-16

> **Approved with corrections applied. H1 may proceed.**

---

## Overview

This brief specifies the architecture for integrating HubSpot as the first CRM target. The integration enables:

- **Read path:** Pull company records from HubSpot lists into the normalization pipeline
- **Write path:** Write normalized, deduplicated records back to HubSpot
- **Real-time path:** Webhook-triggered normalization on record create/update
- **Batch path:** Scheduled monitoring runs on the full company dataset

Three test accounts are available: Frontera, GrowthBook, GrowthX. Each creates a private app in their HubSpot portal with scoped access tokens.

---

## 1. Request + Response Flow

### Read Path

```
HubSpot API                    This Product                    UI/Caller
───────────                    ────────────                    ─────────
                               HubSpotRecordSource
GET /crm/v3/lists/{listId}  ←  fetchListMembers()
    companies?properties=*
                               ↓
200 { results: [...] }      →  Transform to RawRecord[]
                               ↓
                               Normalization Pipeline
                               (Harmonies → Resolver)
                               ↓
                               DiffTable preview           →   User reviews
                               ↓
                               User clicks Apply
                               ↓
                               Write Path (below)
```

### Write Path

```
Normalization Output           This Product                    HubSpot API
────────────────────           ────────────                    ───────────
CanonicalCompany[]             enrichment_apply
with ResolvedFields            ↓
                               Dedup Gate Check
                               ├─ High confidence (≥0.90): upsert existing
                               ├─ Review zone (0.60–0.89): hold, notify
                               └─ No match (<0.60): insert new
                               ↓
                               Field Mapping Layer
                               (canonical → HubSpot properties)
                               ↓
                               Batch Writer (100 records/request)
                               ↓
POST /crm/v3/objects/      →   HubSpot API
     companies/batch/upsert
                               ↓
200 { results: [...] }     ←   Response handling
                               ↓
                               Update provenance records
                               Log results
```

### Real-Time Path (Webhook)

```
HubSpot                        This Product
───────                        ────────────
Company created/updated
↓
POST /api/webhooks/hubspot  →  Webhook Handler
                               ↓
                               Validate signature
                               Parse payload
                               ↓
                               Load single record
                               ↓
                               Normalization Pipeline
                               ↓
                               Dedup Gate
                               ↓
                               Write back (single record)
                               ↓
                               Log + notify if review needed
```

---

## 2. Field Mapping Layer

The field mapping layer translates between canonical fields and HubSpot properties.

### Canonical → HubSpot Default Mapping

| Canonical Field | HubSpot Property | Type | Notes |
|-----------------|------------------|------|-------|
| `company.name` | `name` | string | Required |
| `company.domain` | `domain` | string | Used for dedup blocking |
| `company.industry` | `industry` | enumeration | Must match HubSpot's taxonomy |
| `company.revenue` | `annualrevenue` | number | In dollars |
| `company.employees` | `numberofemployees` | number | |
| `company.phone` | `phone` | string | E.164 format |
| `company.address.country` | `country` | string | ISO 3166-1 alpha-2 |
| `company.address.state` | `state` | string | ISO 3166-2 subdivision |
| `company.address.city` | `city` | string | |
| `company.address.street` | `address` | string | |
| `company.address.postal_code` | `zip` | string | |
| `company.linkedin_url` | `linkedin_company_page` | string | |
| `company.description` | `description` | string | |

### Custom Property Support

Customers may have custom HubSpot properties. The mapping layer supports:

1. **Standard mappings** (above) — applied by default
2. **Custom overrides** — customer maps a canonical field to a different property
3. **Extension fields** — customer maps a canonical field to a custom property they created

The mapping is stored per org and loaded at pipeline execution time.

### Unmapped Fields

Fields in the canonical output that have no HubSpot mapping are:
- Logged as warnings
- Excluded from the write payload
- Surfaced in the UI as "unmapped fields"

---

## 3. Write-Back Conflict Resolution

Every write respects the **per-field write policy** defined in the PRD.

### Write Policy Options

| Policy | Behavior |
|--------|----------|
| `always_overwrite` | Write the normalized value regardless of current HubSpot value |
| `overwrite_if_blank_or_ours` | Write if HubSpot field is empty OR we last wrote it (default) |
| `never_overwrite` | Never overwrite; route to a secondary field if configured |

### Implementation

```typescript
interface WritePolicy {
  field: string;
  policy: 'always_overwrite' | 'overwrite_if_blank_or_ours' | 'never_overwrite';
  secondary_field?: string; // For never_overwrite routing
}
```

### Determining "We Last Wrote It"

Each write records provenance in the `field_provenance` table:

```sql
CREATE TABLE field_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  hubspot_object_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  value_hash TEXT NOT NULL,           -- SHA-256 of written value
  written_at TIMESTAMPTZ NOT NULL,
  harmony_version TEXT NOT NULL,
  source_provider TEXT NOT NULL,
  UNIQUE(org_id, hubspot_object_id, field_name)
);
```

On write:
1. Compute hash of new value
2. Check if `field_provenance` has a matching record
3. If match exists and `value_hash` matches current HubSpot value → we last wrote it
4. Apply write policy accordingly

### Survivorship with Provenance

When multiple providers contribute to a record, the `ResolvedField` carries:
- `source`: which provider the value came from
- `retrieved_at`: when it was retrieved
- `harmony_version`: which Harmony processed it
- `confidence`: resolution confidence (for dedup)

The write-back layer uses this to:
1. Log which source won for each field
2. Populate provenance table for future conflict checks
3. Surface source attribution in the UI

---

## 4. Rate Limiting

### HubSpot API Limits

| Limit Type | Value | Scope |
|------------|-------|-------|
| Burst limit | 100 requests / 10 seconds | Per private app |
| Daily limit | 500,000 requests / day | Per private app |
| Batch size | 100 records / batch request | Per endpoint |

### Rate Limiter Implementation

```typescript
interface RateLimiter {
  /** Check if request can proceed, wait if necessary */
  acquire(): Promise<void>;

  /** Record a completed request */
  release(): void;

  /** Get current rate status */
  status(): { available: number; resetIn: number };
}
```

Implementation uses a sliding window counter stored in Redis (Upstash):

```typescript
class HubSpotRateLimiter implements RateLimiter {
  private readonly windowMs = 10_000; // 10 seconds
  private readonly maxRequests = 100;
  private readonly redisKey: string;

  constructor(orgId: string) {
    this.redisKey = `hubspot:ratelimit:${orgId}`;
  }

  async acquire(): Promise<void> {
    const count = await redis.incr(this.redisKey);
    if (count === 1) {
      await redis.expire(this.redisKey, 10);
    }
    if (count > this.maxRequests) {
      const ttl = await redis.ttl(this.redisKey);
      await sleep(ttl * 1000);
      return this.acquire(); // Retry after wait
    }
  }
}
```

### Backoff Strategy

On 429 (rate limited) response:
1. Parse `Retry-After` header
2. Wait the specified duration
3. Retry with exponential backoff (max 3 retries)
4. Log rate limit events for monitoring

---

## 5. Authentication

### Private App Model

Each customer creates a private app in their HubSpot portal:

1. Navigate to Settings → Integrations → Private Apps
2. Create app with required scopes (see section 9)
3. Copy access token
4. Paste into this product's settings UI

### Token Storage

Tokens are stored in the `hubspot_connections` table (see Open Questions section):

```sql
INSERT INTO hubspot_connections (org_id, portal_id, encrypted_token, scopes)
VALUES (
  'org-123',
  '12345678',                    -- HubSpot portal ID
  encrypt('pat-xxx...'),         -- AES-256-GCM encrypted
  ARRAY['crm.objects.companies.read', 'crm.objects.companies.write',
        'crm.schemas.companies.read', 'crm.lists.read']
);
```

### Token Validation

On first save and periodically:
1. Call `GET /crm/v3/objects/companies?limit=1`
2. Verify 200 response
3. Store validation timestamp
4. Surface "Connected" / "Invalid" / "Expired" status in UI

### Token Refresh

Private app tokens do not expire but can be revoked. The integration:
- Detects 401 responses
- Marks token as invalid
- Notifies user to regenerate

---

## 6. Dedup Gate Integration

**This is a core architectural invariant. The dedup gate runs before every HubSpot write.**

### Flow

```
Normalized Records             Dedup Gate                      HubSpot Write
──────────────────             ──────────                      ─────────────
CanonicalCompany[]             For each record:
                               ↓
                               1. Extract blocking key (normalized domain)
                               ↓
                               2. Query HubSpot for existing companies
                                  with matching domain
                               ↓
                               3. If matches found:
                                  - Compute similarity score
                                  - Apply threshold logic
                               ↓
                               4. Route based on score:
                                  ├─ ≥0.90: Upsert existing record
                                  ├─ 0.60–0.89: Hold for review
                                  └─ <0.60: Insert as new
                               ↓
                               5. Proceed to write (or hold)
```

### Blocking Key Strategy

The primary blocking key is **normalized domain**:

```typescript
function getBlockingKey(company: CanonicalCompany): string {
  // Domain is normalized by the company-domain Harmony
  return company.domain?.toLowerCase() || '';
}
```

Secondary blocking keys (for companies without domains):
- Normalized company name (exact match)
- Phone number (E.164 format)

### HubSpot Query for Existing Matches

```typescript
async function findExistingCompanies(
  domain: string,
  hubspotClient: HubSpotClient
): Promise<HubSpotCompany[]> {
  // Use search API with domain filter
  const response = await hubspotClient.crm.companies.searchApi.doSearch({
    filterGroups: [{
      filters: [{
        propertyName: 'domain',
        operator: 'EQ',
        value: domain,
      }],
    }],
    properties: ['name', 'domain', 'annualrevenue', 'numberofemployees'],
    limit: 10,
  });

  return response.results;
}
```

### Similarity Scoring

**The dedup gate calls the same dedup engine used by the standalone dedup feature.** Field weights and thresholds come from the org's `dedup_settings` table, not from HubSpot-specific configuration. One engine, one config.

```typescript
async function computeSimilarity(
  incoming: CanonicalCompany,
  existing: HubSpotCompany,
  orgId: string
): Promise<number> {
  // Load org's dedup settings — same config as standalone dedup feature
  const dedupSettings = await getDedupSettings(orgId);

  // Use the shared dedup engine with org's weights
  return dedupEngine.computeSimilarity(incoming, existing, dedupSettings);
}
```

The `dedup_settings` table stores per-org configuration:
- Field weights (domain, name, phone, address, etc.)
- Thresholds (auto-merge, review zone, no-match)
- Blocking key strategy

### Threshold Logic

| Score | Action | Notes |
|-------|--------|-------|
| ≥ 0.90 | **Upsert** | High confidence match; update existing record |
| 0.60–0.89 | **Review** | Hold write, add to review queue, notify user |
| < 0.60 | **Insert** | No confident match; create new record |

### Review Queue

Records in the review zone are stored:

```sql
CREATE TABLE dedup_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  incoming_record JSONB NOT NULL,
  matched_hubspot_id TEXT NOT NULL,
  similarity_score NUMERIC(3,2) NOT NULL,
  field_comparison JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);
```

UI surfaces:
- Side-by-side comparison of incoming vs existing
- Field-level diff
- Approve (merge into existing) / Reject (insert as new) / Skip

---

## 7. HubSpotRecordSource Implementation

### Interface Compliance

`HubSpotRecordSource` implements the `RecordSource` interface from Phase 9:

```typescript
interface RecordSourceResult {
  records: RawRecord[];
  sourceName: string;
  count: number;
  error?: string;
}

interface RecordSourceProps {
  onRecordsLoaded: (result: RecordSourceResult) => void;
  onClear: () => void;
  loadedRecords: RawRecord[] | null;
  sourceName: string | null;
  disabled?: boolean;
}
```

### Supported Object Types (v1)

| Object | Read | Write | Notes |
|--------|------|-------|-------|
| Companies | ✓ | ✓ | Primary focus |
| Contacts | ✗ | ✗ | v2 scope |
| Deals | ✗ | ✗ | v2 scope |

### List-Based Pull

Users select from their HubSpot company lists:

```typescript
interface HubSpotRecordSourceProps extends RecordSourceProps {
  /** Available lists to select from */
  lists: HubSpotList[];
  /** Currently selected list ID */
  selectedListId: string | null;
  onListSelect: (listId: string) => void;
}

interface HubSpotList {
  listId: string;
  name: string;
  objectTypeId: string; // '0-2' for companies
  memberCount: number;
}
```

### Fetching Lists

```typescript
async function fetchCompanyLists(
  hubspotClient: HubSpotClient
): Promise<HubSpotList[]> {
  const response = await hubspotClient.crm.lists.listsApi.getAll(
    undefined, // processingTypes
    '0-2',     // objectTypeId for companies
    undefined, // additional properties
    100        // limit
  );

  return response.lists.map(list => ({
    listId: list.listId,
    name: list.name,
    objectTypeId: list.objectTypeId,
    memberCount: list.membershipCount,
  }));
}
```

### Pagination Strategy

HubSpot lists paginate at 100 records per page:

```typescript
async function* fetchListMembers(
  hubspotClient: HubSpotClient,
  listId: string
): AsyncGenerator<RawRecord[]> {
  let after: string | undefined;

  do {
    const response = await hubspotClient.crm.lists.membershipsApi
      .getPageOrderedByAddedToListDate(
        listId,
        after,
        undefined, // before
        100,       // limit
        ['name', 'domain', 'industry', 'annualrevenue', 'numberofemployees',
         'phone', 'city', 'state', 'country', 'zip', 'address',
         'linkedin_company_page', 'description']
      );

    const records = response.results.map(member =>
      transformToRawRecord(member)
    );

    yield records;

    after = response.paging?.next?.after;
  } while (after);
}
```

### Transform to RawRecord

```typescript
function transformToRawRecord(hubspotCompany: any): RawRecord {
  return {
    _id: hubspotCompany.id,
    _label: hubspotCompany.properties.name || hubspotCompany.properties.domain,
    _hubspot_id: hubspotCompany.id,
    // Map all properties
    name: hubspotCompany.properties.name,
    domain: hubspotCompany.properties.domain,
    industry: hubspotCompany.properties.industry,
    revenue: hubspotCompany.properties.annualrevenue,
    employees: hubspotCompany.properties.numberofemployees,
    phone: hubspotCompany.properties.phone,
    city: hubspotCompany.properties.city,
    state: hubspotCompany.properties.state,
    country: hubspotCompany.properties.country,
    postal_code: hubspotCompany.properties.zip,
    street: hubspotCompany.properties.address,
    linkedin_url: hubspotCompany.properties.linkedin_company_page,
    description: hubspotCompany.properties.description,
  };
}
```

### UI Component

```typescript
export function HubSpotRecordSource({
  onRecordsLoaded,
  onClear,
  loadedRecords,
  sourceName,
  disabled,
}: RecordSourceProps) {
  const [lists, setLists] = useState<HubSpotList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch available lists on mount
  useEffect(() => {
    fetchLists();
  }, []);

  const handleLoadRecords = async () => {
    if (!selectedListId) return;
    setIsLoading(true);

    try {
      const response = await fetch(`/api/hubspot/lists/${selectedListId}/members`);
      const data = await response.json();

      onRecordsLoaded({
        records: data.records,
        sourceName: `HubSpot: ${lists.find(l => l.listId === selectedListId)?.name}`,
        count: data.records.length,
      });
    } catch (err) {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  };

  // Render list selector dropdown + load button
  // ...
}
```

---

## 8. Field Mapping Configuration

### Data Model

```sql
CREATE TABLE field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  canonical_field TEXT NOT NULL,
  hubspot_property TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'bidirectional', -- read, write, bidirectional
  write_policy TEXT NOT NULL DEFAULT 'overwrite_if_blank_or_ours',
  valid_values JSONB,              -- For enumeration properties: array of valid HubSpot values
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, canonical_field)
);
```

**Enumeration validation:** For HubSpot enumeration properties (e.g., `industry`), the `valid_values` column stores the allowed values fetched from HubSpot's property definition. When a Harmony outputs a value for an enumeration field:
1. Check if the output matches a value in `valid_values`
2. If match: proceed with write
3. If no match: apply `never_overwrite` policy (skip field, do not write invalid value)

This prevents API errors from invalid enumeration values.

```typescript
interface FieldMapping {
  id: string;
  canonicalField: string;
  hubspotProperty: string;
  direction: 'read' | 'write' | 'bidirectional';
  writePolicy: 'always_overwrite' | 'overwrite_if_blank_or_ours' | 'never_overwrite';
  validValues: string[] | null;  // For enumeration properties
  isActive: boolean;
}

-- Seed default mappings for new orgs
CREATE OR REPLACE FUNCTION seed_default_mappings(p_org_id TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO field_mappings (org_id, canonical_field, hubspot_property)
  VALUES
    (p_org_id, 'company.name', 'name'),
    (p_org_id, 'company.domain', 'domain'),
    (p_org_id, 'company.industry', 'industry'),
    (p_org_id, 'company.revenue', 'annualrevenue'),
    (p_org_id, 'company.employees', 'numberofemployees'),
    (p_org_id, 'company.phone', 'phone'),
    (p_org_id, 'company.address.country', 'country'),
    (p_org_id, 'company.address.state', 'state'),
    (p_org_id, 'company.address.city', 'city'),
    (p_org_id, 'company.address.street', 'address'),
    (p_org_id, 'company.address.postal_code', 'zip'),
    (p_org_id, 'company.linkedin_url', 'linkedin_company_page')
  ON CONFLICT (org_id, canonical_field) DO NOTHING;
END;
$$ LANGUAGE plpgsql;
```

### TypeScript Types

```typescript
interface FieldMappingConfig {
  orgId: string;
  mappings: FieldMapping[];
  unmappedCanonicalFields: string[];
  unmappedHubSpotProperties: string[];
}
```

### UI Surface

New settings tab: **Settings → HubSpot → Field Mapping**

```
┌─────────────────────────────────────────────────────────────────────┐
│ Field Mapping                                              [Reset]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Canonical Field      HubSpot Property    Direction    Write Policy │
│  ──────────────────   ────────────────    ─────────    ─────────── │
│  company.name         [name          ▼]   [Both    ▼]  [Default ▼] │
│  company.domain       [domain        ▼]   [Both    ▼]  [Default ▼] │
│  company.industry     [industry      ▼]   [Both    ▼]  [Default ▼] │
│  company.revenue      [annualrevenue ▼]   [Both    ▼]  [Default ▼] │
│  company.employees    [numberofemplo ▼]   [Both    ▼]  [Default ▼] │
│  ...                                                                │
│                                                                     │
│  ⚠️ Unmapped HubSpot properties: custom_field_1, custom_field_2     │
│                                                                     │
│                                          [Cancel]  [Save Mappings]  │
└─────────────────────────────────────────────────────────────────────┘
```

### Fetching HubSpot Properties

To populate the dropdown, fetch available properties:

```typescript
async function fetchCompanyProperties(
  hubspotClient: HubSpotClient
): Promise<HubSpotProperty[]> {
  const response = await hubspotClient.crm.properties.coreApi.getAll('companies');

  return response.results.map(prop => ({
    name: prop.name,
    label: prop.label,
    type: prop.type,
    fieldType: prop.fieldType,
    options: prop.options, // For enumeration types
  }));
}
```

---

## 9. HubSpot API Scopes Required

### Minimum Required Scopes (v1)

| Scope | Purpose |
|-------|---------|
| `crm.objects.companies.read` | Read company records and list memberships |
| `crm.objects.companies.write` | Create and update company records |
| `crm.schemas.companies.read` | Read company property definitions |
| `crm.lists.read` | Read list definitions and memberships |

### Optional Scopes (if contacts/deals in v1)

| Scope | Purpose |
|-------|---------|
| `crm.objects.contacts.read` | Read contact records |
| `crm.objects.contacts.write` | Create and update contact records |
| `crm.schemas.contacts.read` | Read contact property definitions |

**Recommendation:** Start with companies only. Add contacts in v2 after company flow is validated.

### Webhook Scopes (for real-time)

| Scope | Purpose |
|-------|---------|
| `crm.objects.companies.read` | Required for webhook subscriptions |

Webhooks are configured via the private app settings, not via scope. The app must have read access to the object type to receive webhook events.

### Scope Validation

On token save, validate scopes match requirements:

```typescript
async function validateTokenScopes(
  accessToken: string
): Promise<{ valid: boolean; missingScopes: string[] }> {
  const response = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + accessToken);
  const data = await response.json();

  const requiredScopes = [
    'crm.objects.companies.read',
    'crm.objects.companies.write',
    'crm.schemas.companies.read',
    'crm.lists.read',
  ];

  const grantedScopes = data.scopes || [];
  const missingScopes = requiredScopes.filter(s => !grantedScopes.includes(s));

  return {
    valid: missingScopes.length === 0,
    missingScopes,
  };
}
```

---

## 10. Webhook Trigger (Real-Time Mode)

### Webhook Endpoint

```
POST /api/webhooks/hubspot
```

### Payload Structure

HubSpot webhook payload for company create/update:

```json
[
  {
    "eventId": 123456789,
    "subscriptionId": 987654,
    "portalId": 12345678,
    "appId": 11111,
    "occurredAt": 1684000000000,
    "subscriptionType": "company.propertyChange",
    "attemptNumber": 0,
    "objectId": 123456,
    "propertyName": "name",
    "propertyValue": "Acme Corp"
  }
]
```

### Webhook Handler Implementation

```typescript
// app/api/webhooks/hubspot/route.ts

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('X-HubSpot-Signature-v3');
  const timestamp = request.headers.get('X-HubSpot-Request-Timestamp');

  // 1. Validate signature
  if (!validateSignature(body, signature, timestamp)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 2. Parse events
  const events = JSON.parse(body) as HubSpotWebhookEvent[];

  // 3. Group by object ID (may receive multiple property changes for same record)
  const objectIds = [...new Set(events.map(e => e.objectId))];

  // 4. For each unique object, fetch full record and process
  for (const objectId of objectIds) {
    await processWebhookRecord(objectId, events[0].portalId);
  }

  return NextResponse.json({ processed: objectIds.length });
}

async function validateSignature(
  body: string,
  signature: string | null,
  timestamp: string | null
): Promise<boolean> {
  if (!signature || !timestamp) return false;

  const clientSecret = await getOrgClientSecret(/* from portal ID lookup */);
  const sourceString = clientSecret + 'POST' +
    process.env.WEBHOOK_URL + body + timestamp;

  const hash = crypto.createHash('sha256').update(sourceString).digest('base64');
  return hash === signature;
}

async function processWebhookRecord(objectId: number, portalId: number) {
  // 1. Look up org by portal ID
  const org = await getOrgByHubSpotPortalId(portalId);
  if (!org) return;

  // 2. Check org's normalization mode
  const normSettings = await getNormalizationSettings(org.id);
  const isImplicitMode = normSettings.mode === 'implicit';

  // 3. Fetch full company record
  const hubspotClient = await getHubSpotClient(org.id);
  const company = await hubspotClient.crm.companies.basicApi.getById(
    objectId.toString(),
    ['name', 'domain', 'industry', /* all mapped properties */]
  );

  // 4. Transform to RawRecord
  const record = transformToRawRecord(company);

  // 5. Run through normalization pipeline
  const normalized = await executeHarmoniesApply({
    harmony_ids: org.defaultPipeline.harmony_ids,
    records: [record],
  });

  // 6. Dedup gate check
  const dedupResult = await checkDedupGate(normalized.records[0], hubspotClient);

  // 7. Mode-conditional write behavior
  if (isImplicitMode) {
    // Implicit mode: auto-apply on webhook trigger
    if (dedupResult.action === 'upsert') {
      await writeToHubSpot(dedupResult.targetId, normalized.records[0], hubspotClient);
    } else if (dedupResult.action === 'review') {
      await addToReviewQueue(normalized.records[0], dedupResult);
    } else {
      await writeToHubSpot(objectId.toString(), normalized.records[0], hubspotClient);
    }
  } else {
    // Explicit mode: queue for review UI, do not write silently
    await queueForReview({
      orgId: org.id,
      record: normalized.records[0],
      hubspotObjectId: objectId.toString(),
      dedupResult,
      source: 'webhook',
    });
  }

  // 8. Log the event
  await logWebhookProcessed(org.id, objectId, isImplicitMode ? dedupResult.action : 'queued');
}
```

### Webhook vs Batch Path Differences

| Aspect | Webhook (Real-Time) | Batch |
|--------|---------------------|-------|
| Trigger | HubSpot event | Scheduled or manual |
| Record count | 1 at a time | Up to full list |
| Preview | Mode-conditional (see below) | Yes (DiffTable) |
| Dedup | Still runs | Still runs |
| User approval | Mode-conditional | Required for explicit mode |
| Rate limiting | Per-event | Batched requests |

**Webhook behavior respects org normalization mode:**
- **Implicit mode:** Auto-apply normalized values on webhook trigger (no preview)
- **Explicit mode:** Queue record for review UI; do not write silently

### Webhook Subscription Setup

Webhooks are configured in the private app settings:

1. Navigate to private app → Webhooks
2. Add subscription for `company.creation` and `company.propertyChange`
3. Set target URL to `https://{app-domain}/api/webhooks/hubspot`

---

## 11. Batch Write Strategy

### Read Batching

HubSpot search and list APIs support up to 100 records per request.

```typescript
async function batchReadCompanies(
  hubspotClient: HubSpotClient,
  companyIds: string[]
): Promise<HubSpotCompany[]> {
  const results: HubSpotCompany[] = [];

  // Chunk into batches of 100
  for (let i = 0; i < companyIds.length; i += 100) {
    const batch = companyIds.slice(i, i + 100);

    const response = await hubspotClient.crm.companies.batchApi.read({
      inputs: batch.map(id => ({ id })),
      properties: ['name', 'domain', 'industry', /* ... */],
    });

    results.push(...response.results);

    // Respect rate limits
    await rateLimiter.acquire();
  }

  return results;
}
```

### Write Batching

**Critical:** Never make individual API calls per record in batch operations.

```typescript
async function batchWriteCompanies(
  hubspotClient: HubSpotClient,
  records: Array<{ id?: string; properties: Record<string, any> }>
): Promise<BatchWriteResult> {
  const results: BatchWriteResult = {
    created: [],
    updated: [],
    errors: [],
  };

  // Separate creates from updates
  const creates = records.filter(r => !r.id);
  const updates = records.filter(r => r.id);

  // Batch creates (100 per request)
  for (let i = 0; i < creates.length; i += 100) {
    const batch = creates.slice(i, i + 100);

    try {
      const response = await hubspotClient.crm.companies.batchApi.create({
        inputs: batch.map(r => ({ properties: r.properties })),
      });

      results.created.push(...response.results.map(r => r.id));
    } catch (err) {
      results.errors.push({ batch: i, error: err.message });
    }

    await rateLimiter.acquire();
  }

  // Batch updates (100 per request)
  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100);

    try {
      const response = await hubspotClient.crm.companies.batchApi.update({
        inputs: batch.map(r => ({ id: r.id!, properties: r.properties })),
      });

      results.updated.push(...response.results.map(r => r.id));
    } catch (err) {
      results.errors.push({ batch: i, error: err.message });
    }

    await rateLimiter.acquire();
  }

  return results;
}
```

### Upsert Strategy

HubSpot batch upsert uses a unique identifier (domain recommended):

```typescript
async function batchUpsertCompanies(
  hubspotClient: HubSpotClient,
  records: CanonicalCompany[]
): Promise<BatchWriteResult> {
  const results: BatchWriteResult = {
    created: [],
    updated: [],
    errors: [],
  };

  for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100);

    try {
      const response = await hubspotClient.crm.companies.batchApi.upsert({
        inputs: batch.map(record => ({
          idProperty: 'domain', // Use domain as unique identifier
          id: record.domain,
          properties: mapToHubSpotProperties(record),
        })),
      });

      // Parse results to determine created vs updated
      for (const result of response.results) {
        if (result.new) {
          results.created.push(result.id);
        } else {
          results.updated.push(result.id);
        }
      }
    } catch (err) {
      results.errors.push({ batch: i, error: err.message });
    }

    await rateLimiter.acquire();
  }

  return results;
}
```

---

## 12. Test Account Scope

### Frontera — Basic Normalize + Write Back

**Objective:** Validate the core read → normalize → write cycle.

| Test | Steps | Expected |
|------|-------|----------|
| Connect HubSpot | Add private app token | Token validates, shows "Connected" |
| Pull company list | Select a list, load records | Records appear in RecordSource |
| Run preview | Click "Run Preview" | DiffTable shows changes |
| Apply changes | Click "Apply" | Records written to HubSpot |
| Verify write | Check record in HubSpot | Fields match normalized values |
| Check provenance | Query field_provenance table | Records logged with source, harmony version |

**Test data:** Use existing Frontera companies. No seeding required.

### GrowthBook — Dedup Prevention

**Objective:** Validate the dedup gate blocks known duplicates.

| Test | Steps | Expected |
|------|-------|----------|
| Seed duplicate | Create company "Acme Corp" with domain "acme.com" | Record exists in HubSpot |
| Attempt duplicate insert | Submit "Acme Corporation" with domain "acme.com" | Dedup gate detects match |
| Check similarity score | Verify score computation | Should be ≥0.90 (domain + name similar) |
| Verify upsert | Confirm gate routes to upsert | Existing record updated, no new record created |
| Test review zone | Submit "Acme Inc" with domain "acme.io" (different) | If name similarity 0.60–0.89, lands in review queue |
| Approve from queue | Review and approve merge | Records merged, queue item resolved |

**Test data:** Seed one known company before test. Clean up after.

### GrowthX — Batch Monitoring

**Objective:** Validate scheduled batch processing on a real record set.

| Test | Steps | Expected |
|------|-------|----------|
| Configure batch job | Set up scheduled run (manual trigger for test) | Job configuration saved |
| Run batch on full list | Trigger batch on a 500+ record list | Job processes all records |
| Verify incremental | Run again with no changes | Skips unchanged records, completes fast |
| Modify 10 records | Change 10 companies in HubSpot | |
| Run incremental | Trigger batch again | Only 10 records processed |
| Check performance | Measure total duration | Should complete in < 30 seconds for 500 records |
| Verify rate limiting | Monitor API call count | Should stay under 100 calls / 10 sec |

**Test data:** Use existing GrowthX company list. Minimum 500 records.

---

## File Structure

```
lib/
├── hubspot/
│   ├── client.ts              # HubSpot API client wrapper
│   ├── rate-limiter.ts        # Sliding window rate limiter
│   ├── field-mapper.ts        # Canonical ↔ HubSpot mapping
│   ├── batch-writer.ts        # Batch read/write operations
│   ├── dedup-gate.ts          # Dedup check before write
│   ├── webhook-handler.ts     # Webhook signature validation + processing
│   └── types.ts               # HubSpot-specific types
├── db/
│   ├── migrations/
│   │   ├── 002_field_mappings.sql       # Includes valid_values column
│   │   ├── 003_field_provenance.sql
│   │   ├── 004_dedup_review_queue.sql
│   │   ├── 005_hubspot_connections.sql  # Portal ID → org mapping
│   │   └── 006_webhook_events.sql       # Webhook idempotency log
│   └── hubspot-repository.ts  # Field mapping + connection CRUD

components/
├── settings/
│   ├── hubspot/
│   │   ├── HubSpotConnection.tsx    # Token input + validation
│   │   ├── FieldMappingTable.tsx    # Field mapping UI
│   │   └── index.ts
│   └── normalization/
│       └── HubSpotRecordSource.tsx  # List selector + record loading

app/
├── api/
│   ├── hubspot/
│   │   ├── connect/route.ts         # Token validation
│   │   ├── lists/route.ts           # Fetch company lists
│   │   ├── lists/[listId]/
│   │   │   └── members/route.ts     # Fetch list members
│   │   ├── properties/route.ts      # Fetch company properties
│   │   └── write/route.ts           # Batch write endpoint
│   └── webhooks/
│       └── hubspot/route.ts         # Webhook handler
```

---

## Implementation Phases

### Phase H1: Connection + Read Path
- `hubspot_connections` table migration
- HubSpot client with rate limiting
- Token storage and validation (with portal ID extraction)
- List fetching
- HubSpotRecordSource component
- Basic field mapping (defaults only, with `valid_values` for enumerations)

### Phase H2: Write Path + Dedup Gate
- Dedup gate implementation
- Batch writer
- Field provenance tracking
- Review queue for dedup conflicts
- Write policy enforcement

### Phase H3: Field Mapping UI
- Database schema for custom mappings
- Settings UI for mapping configuration
- Property fetching from HubSpot
- Unmapped field warnings

### Phase H4: Webhook + Real-Time
- `webhook_events` table migration (idempotency log)
- Webhook endpoint
- Signature validation
- Mode-conditional behavior (implicit: auto-apply, explicit: queue for review)
- Single-record processing flow
- Webhook subscription documentation

### Phase H5: Test Account Validation
- Frontera: basic flow
- GrowthBook: dedup prevention
- GrowthX: batch monitoring

---

## Open Questions — RESOLVED

### 1. Portal ID → Org Mapping

**Decision:** Create a dedicated `hubspot_connections` table.

```sql
CREATE TABLE hubspot_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL UNIQUE,      -- One portal per org in v1
  portal_id TEXT NOT NULL UNIQUE,   -- HubSpot portal ID
  encrypted_token TEXT NOT NULL,    -- AES-256-GCM encrypted access token
  scopes TEXT[] NOT NULL,           -- Granted scopes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hubspot_connections_portal ON hubspot_connections(portal_id);
```

On token save, fetch the portal ID from the token validation endpoint and store it. Webhook handler uses `portal_id` to look up the org.

---

### 2. Multi-Portal Support

**Decision:** Out of scope for v1.

The `hubspot_connections` table enforces one portal per org via the `UNIQUE` constraint on `org_id`. Multi-portal support (agency use case) is a known gap to address in v2. The schema can be migrated by removing the unique constraint and adding a `is_primary` flag.

---

### 3. Webhook Retry Idempotency

**Decision:** Log event IDs in a `webhook_events` table.

```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  hubspot_event_id TEXT NOT NULL,    -- HubSpot's eventId from payload
  portal_id TEXT NOT NULL,
  object_id TEXT NOT NULL,
  event_type TEXT NOT NULL,          -- company.creation, company.propertyChange
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, hubspot_event_id)
);

CREATE INDEX idx_webhook_events_lookup ON webhook_events(org_id, hubspot_event_id);
```

On webhook receipt:
1. Check if `hubspot_event_id` exists in `webhook_events`
2. If exists: discard (duplicate delivery)
3. If new: insert row, then process

The normalization pipeline is already idempotent, so duplicate delivery is safe if logged. The table provides an audit trail.

---

### 4. HubSpot Enumeration Validation

**Decision:** Store valid values in `field_mappings`, validate before write.

The `field_mappings` table includes a `valid_values` column (see Section 8). When syncing field mappings:
1. Fetch HubSpot property definitions via `GET /crm/v3/properties/companies`
2. For enumeration properties, extract `options[].value` array
3. Store in `valid_values` column

On write:
1. If field has `valid_values` set, check if Harmony output matches
2. If match: proceed with write
3. If no match: apply `never_overwrite` policy (skip field to avoid API error)

This validation runs in the field mapping layer before the batch writer.

---

## Migration Files

Add to `lib/db/migrations/`:

```
005_hubspot_connections.sql
006_webhook_events.sql
```

Update existing:
```
002_field_mappings.sql  -- Add valid_values column
```

---

**Brief approved. H1 implementation may proceed.**
