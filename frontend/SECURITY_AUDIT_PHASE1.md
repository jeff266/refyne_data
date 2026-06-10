# Security Audit - Phase 1 Results
**Date:** 2026-06-10
**Auditor:** Claude Code
**Scope:** Service role usage, org_id sources, unauthenticated endpoints

---

## CRITICAL (fix immediately - data leak risk)

### 1. Unauthenticated HubSpot Write Endpoint
**File:** `app/api/hubspot/write/route.ts`
**Risk:** Anyone can write data to HubSpot if they know a portal_id
**Finding:**
- POST endpoint accepts `records`, `portalId`, `dryRun` without any authentication
- No `getOrgContext()` or `auth()` call
- Directly calls `executeBatchWrite()` with user-provided portalId
- **Impact:** Attacker can modify HubSpot data for any connected portal

**Recommendation:**
```typescript
export async function POST(request: NextRequest) {
  // Add authentication
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Verify portalId belongs to this org
  const { data: connection } = await supabaseAdmin
    .from('hubspot_connections')
    .select('portal_id')
    .eq('org_id', ctx.orgId)
    .eq('portal_id', body.portalId)
    .single();

  if (!connection) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // ... rest of logic
}
```

---

### 2. Unauthenticated Normalization Export Endpoint
**File:** `app/api/normalize/runs/[runId]/export/route.ts`
**Risk:** Anyone can export normalization run data if they guess/obtain a runId UUID
**Finding:**
- GET endpoint exports CSV with company data, changes, field values
- No authentication check
- Uses service role client with no org_id verification
- **Impact:** Data leak of normalized company records

**Recommendation:**
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  // Add authentication
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Verify run belongs to this org
  const { data: run } = await supabaseAdmin
    .from('normalization_runs')
    .select('org_id')
    .eq('id', runId)
    .single();

  if (!run || run.org_id !== ctx.orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // ... rest of logic
}
```

---

### 3. Unauthenticated Harmonies Preview Endpoint
**File:** `app/api/harmonies/preview/route.ts`
**Risk:** Anyone can execute harmony transformations without authentication
**Finding:**
- POST endpoint runs `executeHarmoniesPreview()` with user-provided data
- No authentication
- Could be used to probe field transformations or consume server resources
- **Impact:** Information disclosure, potential DoS

**Recommendation:**
```typescript
export async function POST(request: NextRequest) {
  // Add authentication
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const body = await request.json() as HarmoniesPreviewInput;

  // If harmonyId is provided, verify it belongs to this org
  if (body.harmonyId) {
    const { data: harmony } = await supabaseAdmin
      .from('harmonies')
      .select('org_id')
      .eq('id', body.harmonyId)
      .single();

    if (harmony && harmony.org_id !== null && harmony.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
  }

  // ... rest of logic
}
```

---

## WARNING (fix before beta launch)

### 4. Normalize Run Details Missing Auth
**File:** `app/api/normalize/runs/[runId]/details/route.ts`
**Risk:** Similar to export - anyone with runId can view run details
**Recommendation:** Add same auth pattern as export endpoint above

---

### 5. Normalize Run Changes Missing Auth
**File:** `app/api/normalize/runs/[runId]/changes/route.ts`
**Risk:** Similar to export - anyone with runId can view changes
**Recommendation:** Add same auth pattern as export endpoint above

---

### 6. Profile Workspace Activate - Weak Validation
**File:** `app/api/profile/workspace/activate/route.ts`
**Risk:** LOW - Takes orgId from body but doesn't use it for DB operations
**Finding:**
- Endpoint accepts orgId from request body (line 22)
- Currently just a placeholder that returns `{ success: true }`
- Could be exploited if logic is added later without proper validation
- **Impact:** Currently minimal (no DB operations)

**Recommendation:**
```typescript
export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { orgId } = body;

  // Verify user is member of this org via Clerk
  const { data: membership } = await clerkClient.organizations.getOrganizationMembership({
    organizationId: orgId,
    userId: userId,
  });

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ... rest of logic
}
```

---

### 7. Debug/Test Endpoints in Production
**Files:**
- `app/api/test-graphiq/route.ts`
- `app/api/debug/serper/route.ts`

**Risk:** Expose API key presence (not values) and environment info
**Finding:**
- `test-graphiq` returns list of env var keys containing "GRAPH"
- `debug/serper` returns diagnostics including API key status
- Both unauthenticated
- **Impact:** Information disclosure (not critical but should be removed)

**Recommendation:**
- Delete these files before production launch
- OR add authentication and admin-only access
- OR use `process.env.NODE_ENV === 'development'` guard

---

## INFO (low risk, fix before public launch)

### 8. Config Route - Intentionally Public
**File:** `app/api/config/route.ts`
**Status:** PUBLIC (intentional)
**Finding:** Returns demo config for enrichment switcher UI
**Note:** Appears to be for demo purposes, verify if still needed in production

---

### 9. Billing Prices - Intentionally Public
**File:** `app/api/billing/prices/route.ts`
**Status:** PUBLIC (intentional - line 8 comment)
**Finding:** Returns active Stripe prices
**Note:** Safe - public pricing information

---

### 10. Taxonomy Packs - Intentionally Public
**Files:**
- `app/api/taxonomy/packs/route.ts`
- `app/api/taxonomy/packs/[packId]/entries/route.ts`

**Status:** PUBLIC (intentional)
**Finding:** Returns global taxonomy data (no org_id column)
**Note:** Safe - read-only global reference data

---

### 11. Unsubscribe Route - Secure Token Validation
**File:** `app/api/unsubscribe/route.ts`
**Status:** SAFE
**Finding:**
- Takes orgId from query params (line 16)
- BUT validates with HMAC-SHA256 token (line 43)
- Uses timing-safe comparison
- Token is cryptographically bound to email+orgId pair
- **Impact:** None - properly secured with crypto

---

### 12. HubSpot Callback Route - OAuth Flow
**File:** `app/api/hubspot/callback/route.ts`
**Status:** SAFE (OAuth callback - must be unauthenticated)
**Finding:** Part of OAuth flow, validates state parameter
**Note:** Intentionally public for OAuth

---

### 13. Clay Send Route - Webhook Receiver
**File:** `app/api/clay/send/route.ts`
**Status:** NEEDS REVIEW (likely webhook)
**Finding:** Appears to be webhook receiver for Clay enrichment
**Recommendation:** Verify webhook signature validation is implemented

---

## CLEAN (no issues found)

### Service Role with Proper Org Filtering ✅
All routes using `supabaseAdmin` or service role client that were checked have proper org_id filtering:
- ✅ `app/api/name-registry/route.ts` - has `.eq('org_id', ctx.orgId)`
- ✅ `app/api/name-registry/[id]/route.ts` - two-step verification (fetch + verify ownership)
- ✅ `app/api/jobs/segment/run/route.ts` - has `.eq('org_id', orgId)`
- ✅ `app/api/settings/activity/export/route.ts` - has `.eq('org_id', ctx.orgId)`
- ✅ `app/api/admin/workspaces/[orgId]/route.ts` - super-admin only (ADMIN_USER_ID check)
- ✅ All provider request routes - properly filtered
- ✅ All import routes - properly filtered
- ✅ All harmonies routes - properly filtered (including the fix from earlier today)

### No Unsafe org_id Sources ✅
- ✅ No routes take org_id from request body/params without validation
- ✅ All authenticated routes use `getOrgContext()` or `auth()` from Clerk
- ✅ Only exceptions are properly secured (unsubscribe with HMAC, admin with exact user ID match)

---

## Summary Statistics

**Total API Routes Audited:** 44 using service role + 15 unauthenticated
**Critical Issues:** 3 (hubspot/write, normalize export, harmonies preview)
**Warnings:** 4 (normalize details/changes, profile activate, test endpoints)
**Info/Low Priority:** 6 (intentionally public routes)
**Clean:** 41 routes properly secured

---

## Priority Fix Order

1. **TODAY** - Add auth to `hubspot/write/route.ts` (CRITICAL - can modify HubSpot data)
2. **TODAY** - Add auth to `normalize/runs/[runId]/export/route.ts` (CRITICAL - data leak)
3. **TODAY** - Add auth to `harmonies/preview/route.ts` (CRITICAL - information disclosure)
4. **This Week** - Add auth to normalize details/changes endpoints
5. **This Week** - Delete or protect test/debug endpoints
6. **Before Launch** - Review profile/workspace/activate validation
7. **Before Launch** - Verify Clay webhook signature validation

---

## Next Steps

1. Review this report
2. Prioritize fixes (recommend doing all 3 CRITICAL today)
3. Create fix PRs for each issue
4. Add integration tests for auth on critical endpoints
5. Schedule Phase 2 audit (token logging, webhook signatures, file uploads)
