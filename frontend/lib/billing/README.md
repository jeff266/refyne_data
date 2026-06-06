# Billing System - Phase 1: Foundation

**Status:** Implementation complete ✅
**Migration:** 081_billing_foundation.sql
**Date:** June 5, 2026

## Overview

Phase 1 implements the core billing infrastructure with atomic counters, weekly partitioned usage tracking, and Stripe webhook idempotency. This foundation prevents race conditions, enables accurate trial enforcement, and provides single-query entitlement checks.

## Architecture Decisions (from Review)

### ✅ Implemented
1. **Weekly Partitions** - `org_usage` uses weekly partitions (not monthly) for better 14-day trial analysis
2. **Atomic Counters** - Trial usage incremented via `increment_trial_counter()` RPC to prevent race conditions
3. **No Redis Caching** - Direct PostgreSQL reads are fast enough (<5ms via VIEW)
4. **Single-Query Entitlements** - `org_entitlements` VIEW combines billing + usage aggregation
5. **Stripe Idempotency** - `stripe_webhook_events` table prevents duplicate processing
6. **Price Storage** - Stripe price IDs stored in database (not env vars)

## Database Schema

### Tables

**org_billing** - Subscription state + atomic trial counters
```sql
CREATE TABLE org_billing (
  org_id TEXT PRIMARY KEY,
  subscription_tier TEXT NOT NULL DEFAULT 'trial', -- trial | pro | enterprise | internal
  subscription_status TEXT NOT NULL DEFAULT 'active',
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,

  -- Trial tracking
  trial_start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_end_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),

  -- Atomic counters (prevents race conditions)
  trial_merges_used INTEGER NOT NULL DEFAULT 0,
  trial_normalize_writes_used INTEGER NOT NULL DEFAULT 0,
  trial_enrich_credits_used INTEGER NOT NULL DEFAULT 0,

  -- Paid plan credits
  pro_monthly_enrich_credits INTEGER,
  enterprise_monthly_enrich_credits INTEGER
);
```

**org_usage** - Weekly partitioned usage tracking
```sql
CREATE TABLE org_usage (
  org_id TEXT NOT NULL,
  week_start DATE NOT NULL, -- Monday of the week (partition key)
  date DATE NOT NULL,

  -- Daily counters
  merges_executed INTEGER DEFAULT 0,
  normalize_writes INTEGER DEFAULT 0,
  enrich_credits_consumed INTEGER DEFAULT 0,

  PRIMARY KEY (org_id, week_start, date)
) PARTITION BY RANGE (week_start);
```

**stripe_webhook_events** - Idempotency tracking
```sql
CREATE TABLE stripe_webhook_events (
  id TEXT PRIMARY KEY, -- Stripe event ID (evt_xxx)
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  org_id TEXT,
  metadata JSONB
);
```

**stripe_prices** - Price ID storage
```sql
CREATE TABLE stripe_prices (
  id SERIAL PRIMARY KEY,
  tier TEXT NOT NULL, -- pro | enterprise
  billing_period TEXT NOT NULL, -- monthly | annual
  stripe_price_id TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);
```

**org_billing_events** - Audit trail for billing changes
```sql
CREATE TABLE org_billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB
);
```

### Views

**org_entitlements** - Single-query performance
```sql
CREATE VIEW org_entitlements AS
SELECT
  ob.org_id,
  ob.subscription_tier,

  -- Trial limits
  CASE WHEN ob.subscription_tier = 'trial' THEN 25 ELSE NULL END AS trial_merge_limit,
  CASE WHEN ob.subscription_tier = 'trial' THEN 100 ELSE NULL END AS trial_normalize_limit,
  CASE WHEN ob.subscription_tier = 'trial' THEN 50 ELSE NULL END AS trial_enrich_limit,

  -- Trial usage
  ob.trial_merges_used,
  ob.trial_normalize_writes_used,
  ob.trial_enrich_credits_used,

  -- Trial remaining
  CASE WHEN ob.subscription_tier = 'trial' THEN 25 - ob.trial_merges_used ELSE NULL END AS trial_merges_remaining,
  -- ... (normalize, enrich)

  -- Current period usage (last 30 days)
  COALESCE(SUM(ou.merges_executed) FILTER (WHERE ou.date >= CURRENT_DATE - 30), 0) AS merges_last_30d,
  -- ... (normalize, enrich)

FROM org_billing ob
LEFT JOIN org_usage ou ON ob.org_id = ou.org_id
GROUP BY ob.org_id, ...
```

### RPC Functions

**increment_trial_counter()** - Atomic counter increment
```sql
CREATE FUNCTION increment_trial_counter(
  p_org_id TEXT,
  p_counter_name TEXT, -- 'merges' | 'normalize_writes' | 'enrich_credits'
  p_increment INTEGER DEFAULT 1
) RETURNS BOOLEAN
```

Returns `TRUE` if increment succeeded, `FALSE` if limit exceeded.

**upsert_daily_usage()** - Concurrent-safe usage recording
```sql
CREATE FUNCTION upsert_daily_usage(
  p_org_id TEXT,
  p_date DATE,
  p_week_start DATE,
  p_column_name TEXT,
  p_increment INTEGER
) RETURNS VOID
```

## Library Usage

### Check Entitlements

```typescript
import { getEntitlements } from '@/lib/billing/entitlements';

const entitlements = await getEntitlements(orgId);

console.log(entitlements.subscription_tier); // 'trial' | 'pro' | 'enterprise' | 'internal'
console.log(entitlements.trial_merges_remaining); // 25 - used
console.log(entitlements.trial_days_remaining); // Days until trial expires
```

### Consume Usage

```typescript
import { consumeUsage } from '@/lib/billing/enforce';

// Before executing a merge
const result = await consumeUsage(orgId, 'merge', 1);

if (!result.allowed) {
  console.error('Merge blocked:', result.reason);
  console.log('Remaining:', result.remaining);
  // Show upgrade prompt
  return;
}

// Proceed with merge
executeMerge();
```

### Check Limits (Non-Consuming)

```typescript
import { checkBillingLimit } from '@/lib/billing/enforce';

// For UI state (e.g., disable merge button)
const canMerge = await checkBillingLimit(orgId, 'merge', 1);

return (
  <button disabled={!canMerge}>
    Merge Companies
  </button>
);
```

### Get Usage Summary

```typescript
import { getUsageSummary } from '@/lib/billing/enforce';

const summary = await getUsageSummary(orgId);

console.log(summary.tier); // 'trial'
console.log(summary.merges.used); // 10
console.log(summary.merges.limit); // 25
console.log(summary.merges.remaining); // 15
console.log(summary.trial_days_remaining); // 7
```

### Get Limit Status Message

```typescript
import { getLimitStatus } from '@/lib/billing/entitlements';

const status = await getLimitStatus(orgId, 'merge');

console.log(status);
// "15 trial merges remaining (10/25 used)"
// "Trial merge limit reached (25). Upgrade to continue."
// null (no limits for paid/internal)
```

## Trial Limits

| Action | Trial Limit |
|--------|-------------|
| Merges | 25 |
| Normalize Writes | 100 |
| Enrich Credits | 50 |

**Trial Period:** 14 days from signup

## Paid Tier Limits

| Action | Pro | Enterprise |
|--------|-----|-----------|
| Merges | ∞ | ∞ |
| Normalize Writes | ∞ | ∞ |
| Enrich Credits | Configurable per org | Configurable per org |

Set via `org_billing.pro_monthly_enrich_credits` or `org_billing.enterprise_monthly_enrich_credits`.

## Internal Tier

Internal orgs (`subscription_tier='internal'`) bypass all limits and enforcement.

### Mark Orgs as Internal

```bash
npx tsx scripts/mark-internal-orgs.ts
```

Edit `scripts/mark-internal-orgs.ts` to add org IDs to the `INTERNAL_ORG_IDS` array.

## Migration Deployment

1. **Apply migration 081**
   ```sql
   -- Via Supabase dashboard or CLI
   psql -f lib/db/migrations/081_billing_foundation.sql
   ```

2. **Verify partition creation**
   ```sql
   SELECT tablename FROM pg_tables
   WHERE schemaname = 'public'
   AND tablename LIKE 'org_usage_%'
   ORDER BY tablename;

   -- Should show 12 weekly partitions
   -- org_usage_2026_23, org_usage_2026_24, etc.
   ```

3. **Mark internal orgs**
   ```bash
   npx tsx scripts/mark-internal-orgs.ts
   ```

4. **Update Stripe price IDs** (before production)
   ```sql
   UPDATE stripe_prices
   SET stripe_price_id = 'price_real_from_stripe'
   WHERE tier = 'pro' AND billing_period = 'monthly';
   ```

## Partition Maintenance

Weekly partitions are created 12 weeks ahead. Add new partitions monthly:

```sql
-- Create partition for week starting 2026-07-06 (week 28)
CREATE TABLE org_usage_2026_28 PARTITION OF org_usage
FOR VALUES FROM ('2026-07-06') TO ('2026-07-13');
```

Or run automated partition creation:

```bash
npx tsx scripts/create-usage-partitions.ts --weeks 12
```

## Cleanup (90-day retention)

Delete old webhook events and usage data:

```sql
-- Delete webhook events older than 90 days
DELETE FROM stripe_webhook_events
WHERE created_at < NOW() - INTERVAL '90 days';

-- Drop old usage partitions (after 90 days)
DROP TABLE IF EXISTS org_usage_2026_15; -- Week 15 if > 90 days old
```

## Next Phases

**Phase 2: Stripe Integration** (migration 082)
- Stripe webhook handler (`/api/webhooks/stripe`)
- Checkout session creation
- Subscription lifecycle management
- Customer portal integration

**Phase 3: Usage UI** (migration 083)
- `/settings/usage` page
- Trial progress indicators
- Upgrade prompts
- Usage charts

## Files Created

```
lib/billing/
  README.md                  # This file
  entitlements.ts            # Entitlement queries
  enforce.ts                 # Usage consumption + enforcement

lib/db/migrations/
  081_billing_foundation.sql # Phase 1 schema

scripts/
  mark-internal-orgs.ts      # Mark internal orgs script
```

## Security

All billing tables have Row Level Security (RLS) enabled:

- `org_billing` - Org isolation via `org_id = auth.jwt() ->> 'org_id'`
- `org_usage` - Org isolation via `org_id = auth.jwt() ->> 'org_id'`
- `org_billing_events` - Read-only org isolation
- `stripe_webhook_events` - Global read-only (processed by service role)
- `stripe_prices` - Global read-only

Application code uses `supabaseAdmin` (service role) which bypasses RLS.

## Testing

```typescript
// Integration test example
import { consumeUsage, getUsageSummary } from '@/lib/billing/enforce';

test('trial limit enforcement', async () => {
  // Create trial org
  await supabaseAdmin.from('org_billing').insert({
    org_id: 'test-org-123',
    subscription_tier: 'trial',
    trial_merges_used: 24, // 1 away from limit
  });

  // First merge should succeed
  const result1 = await consumeUsage('test-org-123', 'merge', 1);
  expect(result1.allowed).toBe(true);
  expect(result1.remaining).toBe(0);

  // Second merge should fail
  const result2 = await consumeUsage('test-org-123', 'merge', 1);
  expect(result2.allowed).toBe(false);
  expect(result2.reason).toBe('Trial limit exceeded');
});
```

## Support

For questions or issues:
- Architecture review: See revised spec from June 5, 2026
- Database issues: Check RLS policies and partition ranges
- Enforcement bugs: Verify `increment_trial_counter()` return value
