# Audit Log Verification

## Migration 080 Applied ✅

**Table:** `audit_log`
**RLS:** Enabled (SELECT-only)
**Indexes:** 4 (org_created, actor, resource, action)
**IP Type:** INET (native PostgreSQL)

## Verification Queries

After triggering any of the 5 audit-logged actions, run these queries to verify:

### 1. Check recent audit events
```sql
SELECT
  action,
  object_type,
  object_label,
  actor_email,
  created_at
FROM audit_log
WHERE org_id = 'your-org-id'
ORDER BY created_at DESC
LIMIT 10;
```

### 2. Verify IP address capture (INET type)
```sql
SELECT
  action,
  ip_address,
  host(ip_address) as ip_string,
  user_agent
FROM audit_log
WHERE org_id = 'your-org-id'
AND ip_address IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

### 3. Check before/after state tracking
```sql
SELECT
  action,
  object_label,
  before_state,
  after_state,
  created_at
FROM audit_log
WHERE org_id = 'your-org-id'
AND action = 'harmony.updated'
ORDER BY created_at DESC
LIMIT 3;
```

### 4. Verify all 5 actions are logging
```sql
SELECT
  action,
  COUNT(*) as event_count,
  MAX(created_at) as last_triggered
FROM audit_log
WHERE org_id = 'your-org-id'
GROUP BY action
ORDER BY action;
```

Expected actions:
- `dedup.merge_executed`
- `harmony.created`
- `harmony.updated`
- `normalize.applied`
- `dedup_policy.updated`

## Test Each Route

Trigger each action in the UI and verify audit event is created:

1. **Dedup merge**: Go to `/dedup`, merge a cluster
2. **Harmony create**: Go to `/harmonies`, create new custom harmony
3. **Harmony update**: Go to `/harmonies/[id]`, toggle active or update description
4. **Normalize apply**: Go to `/normalize`, apply changes
5. **Dedup policy**: Go to `/settings/policies/dedup`, update policy

After each action, run Query #1 to see the new audit event.

## Fire-and-Forget Verification

Audit logging should NEVER block or fail the main operation:

```bash
# Check application logs - should see NO errors like:
# "[Audit] Failed to log event:"
# "[Audit] Exception during logging:"

# If these appear, it means audit logging failed but didn't crash the app ✅
```

## RLS Verification

Confirm users can only read their own org's audit events:

```sql
-- This should return true
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'audit_log';

-- This should show SELECT-only policy
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'audit_log';
```

## Index Performance Check

```sql
-- Verify indexes are being used
EXPLAIN ANALYZE
SELECT *
FROM audit_log
WHERE org_id = 'your-org-id'
AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 100;

-- Should show "Index Scan using idx_audit_log_org_created"
```
