# Security Audit - Phase 3 Results
**Date:** 2026-06-10
**Auditor:** Claude Code
**Scope:** Rate limiting, Zod validation coverage, Sentry data scrubbing, security headers

---

## CRITICAL (data/system at risk)

**None found.** ✅

---

## WARNING (security best practice violation)

### 1. Missing Rate Limiting on High-Priority API Routes

**Severity:** WARNING
**Risk:** DoS attacks, resource exhaustion, abuse of expensive operations

**Infrastructure Exists:**
- ✅ `lib/hubspot/org-rate-limiter.ts` - Upstash-based rate limiting with sliding window (100 req/10s)
- ✅ Already used in some routes (e.g., `/api/contact-dedup/scan`)

**Missing on High-Priority Routes (6 routes):**

1. **Team Invite** - `app/api/team/invite/route.ts`
   - Risk: Spam invites, exhaust email quota
   - Recommended limit: 10 invites/10s per org

2. **Provider Requests** - `app/api/admin/provider-requests/route.ts`
   - Risk: Flood admin queue with fake requests
   - Recommended limit: 20 requests/10s per org

3. **Onboarding Invite** - `app/api/onboarding/invite/route.ts`
   - Risk: Spam invites during onboarding
   - Recommended limit: 5 invites/10s per org

4. **CSV Import Parse** - `app/api/import/parse/route.ts`
   - Risk: CPU exhaustion from large CSV parsing
   - Recommended limit: 5 uploads/10s per org

5. **Normalize Apply** - `app/api/normalize/apply/route.ts`
   - Risk: Flood HubSpot API, exhaust job queue
   - Recommended limit: 10 runs/10s per org

6. **Dedup Scanner** - `app/api/contact-dedup/scanner/route.ts`
   - Status: HAS rate limiting already ✅
   - Note: This is the only high-priority route with protection

**Recommendation:**
```typescript
// Add to each route after auth check:
import { checkOrgRateLimit } from '@/lib/hubspot/org-rate-limiter';

const rateLimitResult = await checkOrgRateLimit(ctx.orgId);
if (!rateLimitResult.success) {
  return NextResponse.json(
    { error: 'Rate limit exceeded', retryAfter: rateLimitResult.reset },
    { status: 429 }
  );
}
```

---

### 2. Missing Zod Validation on 130 API Routes

**Severity:** WARNING
**Risk:** Type confusion, SQL injection (low risk with Supabase), data integrity issues

**Current State:**
- **1 route** has Zod validation: `app/api/profile/workspace/activate/route.ts` (added in Phase 1 fix)
- **130 routes** accept JSON POST/PUT/PATCH without schema validation

**High-Priority Routes Without Validation (10 examples):**

1. **app/api/hubspot/write/route.ts**
   - Accepts: `{ records, portalId, fieldMappings }`
   - Risk: Malformed records crash batch writer

2. **app/api/normalize/apply/route.ts**
   - Accepts: `{ harmonyIds, preview }`
   - Risk: Invalid harmonyIds cause database errors

3. **app/api/harmonies/route.ts** (POST)
   - Accepts: `{ name, description, fieldKey, ... }`
   - Risk: Missing required fields stored as NULL

4. **app/api/import/parse/route.ts**
   - Accepts: multipart/form-data
   - Risk: Missing filename crashes parser

5. **app/api/team/invite/route.ts**
   - Accepts: `{ email, role }`
   - Risk: Invalid email format bypasses Clerk validation

6. **app/api/settings/normalization/route.ts** (PUT)
   - Accepts: `{ mode, auto_apply_threshold }`
   - Risk: Invalid mode ('implicit'/'explicit') breaks webhook handler

7. **app/api/contact-dedup/scanner/route.ts** (POST)
   - Accepts: `{ scanType, filters, ... }`
   - Risk: Invalid scanType crashes worker

8. **app/api/admin/provider-requests/route.ts** (POST)
   - Accepts: `{ provider, reason, description }`
   - Risk: Missing provider field crashes database insert

9. **app/api/harmonies/[id]/route.ts** (PUT)
   - Accepts: `{ referenceData, fieldAssignments, ... }`
   - Risk: Invalid referenceData format breaks enum validation

10. **app/api/blog/posts/route.ts** (POST)
    - Accepts: `{ title, content, slug, ... }`
    - Risk: Missing slug causes duplicate key violations

**Pattern for Adding Validation:**
```typescript
import { z } from 'zod';

const requestSchema = z.object({
  fieldName: z.string().min(1, 'Field is required'),
  optionalField: z.string().optional(),
  enumField: z.enum(['value1', 'value2']),
});

const body = await request.json();
const validation = requestSchema.safeParse(body);

if (!validation.success) {
  return NextResponse.json(
    {
      error: 'Invalid request',
      details: validation.error.flatten().fieldErrors
    },
    { status: 400 }
  );
}

const { fieldName, optionalField, enumField } = validation.data;
```

**Why This Matters:**
- TypeScript only validates at compile time, not runtime
- JSON.parse() accepts any valid JSON structure
- Database errors are harder to debug than validation errors
- Prevents type confusion attacks

---

### 3. No Sentry Data Scrubbing Configuration

**Severity:** WARNING
**Risk:** Sensitive data (tokens, emails, PII) leaked to Sentry logs

**Current State:**

**sentry.server.config.ts** - No beforeSend hook:
```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
  // Missing: beforeSend hook for scrubbing
});
```

**sentry.client.config.ts** - Partial scrubbing:
```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,        // ✅ Masks text in replays
      blockAllMedia: true,      // ✅ Blocks media in replays
    }),
  ],
  // Missing: beforeSend hook for error scrubbing
});
```

**sentry.edge.config.ts** - No beforeSend hook:
```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Missing: beforeSend hook for scrubbing
});
```

**lib/monitoring/sentry.ts** - Sets context but doesn't scrub:
```typescript
export function captureWithOrgContext(
  error: unknown,
  orgId: string,
  context?: Record<string, unknown>
) {
  Sentry.withScope(scope => {
    scope.setTag('org_id', orgId);
    scope.setContext('org', { orgId, ...context }); // ⚠️ Context not scrubbed
    Sentry.captureException(error);
  });
}
```

**Risk Examples:**
- Error with token in message: `Failed to refresh token: abc123xyz...`
- Error with email in context: `{ userEmail: 'user@example.com' }`
- Error with API response: `{ response: { data: { access_token: '...' } } }`

**Recommendation - Add beforeSend hooks:**

**sentry.server.config.ts:**
```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
  beforeSend(event) {
    // Scrub sensitive fields from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
        if (breadcrumb.data) {
          const scrubbed = { ...breadcrumb.data };
          ['token', 'access_token', 'refresh_token', 'api_key', 'password', 'secret'].forEach(key => {
            if (scrubbed[key]) scrubbed[key] = '[REDACTED]';
          });
          breadcrumb.data = scrubbed;
        }
        return breadcrumb;
      });
    }

    // Scrub sensitive fields from extra context
    if (event.extra) {
      const scrubbed = { ...event.extra };
      ['token', 'access_token', 'refresh_token', 'api_key', 'password', 'secret'].forEach(key => {
        if (scrubbed[key]) scrubbed[key] = '[REDACTED]';
      });
      event.extra = scrubbed;
    }

    // Scrub tokens from error messages
    if (event.message) {
      event.message = event.message.replace(/(tok|key|secret)_[a-zA-Z0-9]{20,}/g, '[REDACTED_TOKEN]');
    }

    return event;
  },
});
```

**sentry.client.config.ts / sentry.edge.config.ts:** Same pattern as above.

**lib/monitoring/sentry.ts:**
```typescript
export function captureWithOrgContext(
  error: unknown,
  orgId: string,
  context?: Record<string, unknown>
) {
  Sentry.withScope(scope => {
    scope.setTag('org_id', orgId);

    // Scrub context before setting
    const scrubbedContext = context ? scrubSensitiveFields(context) : undefined;
    scope.setContext('org', { orgId, ...scrubbedContext });

    Sentry.captureException(error);
  });
}

function scrubSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
  const scrubbed = { ...obj };
  ['token', 'access_token', 'refresh_token', 'api_key', 'password', 'secret'].forEach(key => {
    if (scrubbed[key]) scrubbed[key] = '[REDACTED]';
  });
  return scrubbed;
}
```

---

### 4. Missing Security Headers

**Severity:** WARNING
**Risk:** XSS, clickjacking, MIME sniffing, mixed content, referrer leaks

**Current State:**

**middleware.ts** - No headers added:
```typescript
export default clerkMiddleware(async (auth, request) => {
  // ... auth logic ...
  return NextResponse.next(); // ⚠️ No security headers
});
```

**next.config.js** - No headers configuration:
```javascript
const nextConfig = {
  reactStrictMode: true,
  // Missing: headers() function
}
```

**Missing Headers:**

1. **Content-Security-Policy (CSP)** - Prevents XSS attacks
   - Current: None
   - Recommended: Strict policy with nonces for inline scripts

2. **X-Frame-Options** - Prevents clickjacking
   - Current: None
   - Recommended: `DENY` or `SAMEORIGIN`

3. **X-Content-Type-Options** - Prevents MIME sniffing
   - Current: None
   - Recommended: `nosniff`

4. **Strict-Transport-Security (HSTS)** - Enforces HTTPS
   - Current: None
   - Recommended: `max-age=31536000; includeSubDomains`

5. **Referrer-Policy** - Controls referrer information
   - Current: None
   - Recommended: `strict-origin-when-cross-origin`

6. **Permissions-Policy** - Restricts browser features
   - Current: None
   - Recommended: Disable unused features (camera, microphone, geolocation)

**Cookie Security:**
- ✅ Cookies managed by Clerk (auth provider)
- ✅ Clerk sets `Secure` and `HttpOnly` flags by default
- ✅ No custom cookies set by application

**CORS:**
- ✅ No CORS headers configured (defaults to same-origin)
- ✅ All API routes enforce same-origin by default
- ℹ️ If cross-origin needed in future, use explicit allowlist

**Recommendation - Add headers to next.config.js:**

```javascript
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // HSTS - only enable after confirming HTTPS everywhere
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // CSP - start with report-only mode to avoid breaking changes
          {
            key: 'Content-Security-Policy-Report-Only',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.clerk.com https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.clerk.com https://api.stripe.com;",
          },
        ],
      },
    ];
  },
}
```

**CSP Strategy:**
1. Start with `Content-Security-Policy-Report-Only` to test without breaking app
2. Monitor violations in browser console
3. Refine policy to allow legitimate sources
4. Switch to enforcing mode: `Content-Security-Policy`
5. Add nonce-based inline script protection (requires Next.js middleware integration)

**Vercel Deployment:**
- Vercel automatically adds `X-Powered-By: Next.js` (can be disabled in next.config.js)
- HSTS is enforced by Vercel platform for all `.vercel.app` domains
- Custom domains require manual HSTS header

---

## INFO (low risk, hardening recommendation)

**None.** All findings classified as WARNING due to production risk.

---

## CLEAN (no issues found)

### ✅ Cookie Security - CLEAN

**Status:** Cookies managed by Clerk auth provider

**Analysis:**
- ✅ No custom `Set-Cookie` headers in application code
- ✅ Clerk sets secure cookies with `Secure`, `HttpOnly`, `SameSite=Lax` flags by default
- ✅ Session cookies encrypted by Clerk
- ✅ No hardcoded secrets in cookie values

**Middleware cookie usage:**
```typescript
// middleware.ts:58 - Reading cookie (safe)
const onboardingCookie = request.cookies.get('refyne_onboarding_complete');
```

**Verdict:** Cookie security delegated to Clerk (industry best practice). No vulnerabilities found.

---

### ✅ CORS Configuration - CLEAN

**Status:** No CORS headers configured, defaults to same-origin

**Analysis:**
- ✅ No `Access-Control-Allow-Origin` headers found in application
- ✅ All API routes enforce same-origin policy by default
- ✅ No wildcard (`*`) CORS allowed

**Future Consideration:**
If cross-origin access needed (e.g., for public API), use explicit allowlist:
```typescript
// DO NOT USE WILDCARD
headers: {
  'Access-Control-Allow-Origin': 'https://trusted-domain.com', // ✅ Explicit
  // 'Access-Control-Allow-Origin': '*', // ❌ Never use wildcard
}
```

**Verdict:** CORS is secure by default (same-origin). No changes needed unless cross-origin required.

---

## Summary Statistics

**Total Areas Audited:** 4 (Rate Limiting, Zod Validation, Sentry Scrubbing, Security Headers)
**Critical Issues:** 0
**Warnings:** 4
  - Missing rate limiting on 6 high-priority routes
  - Missing Zod validation on 130 routes (99% of routes)
  - No Sentry data scrubbing (3 config files + 1 utility)
  - Missing security headers (6 headers)
**Info/Low Priority:** 0
**Clean:** 2 (Cookie security, CORS)

---

## Priority Fix Order

### High Priority (This Sprint)
1. **Security Headers** - Add X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS
   - Impact: Immediate XSS/clickjacking protection
   - Effort: 10 minutes (add headers to next.config.js)

2. **Sentry Data Scrubbing** - Add beforeSend hooks to all 3 Sentry configs
   - Impact: Prevent token leaks in error logs
   - Effort: 30 minutes (3 config files + 1 utility function)

### Medium Priority (Next Sprint)
3. **Rate Limiting** - Add to 6 high-priority routes
   - Impact: DoS protection, abuse prevention
   - Effort: 2 hours (add rate limit checks + test each route)

### Low Priority (Future Backlog)
4. **Zod Validation** - Add to top 20 most-used routes first
   - Impact: Type safety, better error messages
   - Effort: 4-6 hours (20 routes × 15 min each)
   - Note: 130 routes is too many to fix in one sprint
   - Strategy: Add to new routes going forward + backfill top 20 over time

---

## Recommendations for Phase 4

Phase 3 revealed missing hardening layers but no critical vulnerabilities. Suggested Phase 4 topics:

1. **Dependency Audit** (high priority)
   - Run `npm audit` and check for known vulnerabilities
   - Review outdated packages with security implications
   - Check for unused dependencies (attack surface reduction)

2. **Environment Variable Audit** (medium priority)
   - Verify all secrets use encrypted storage (Railway/Vercel)
   - Check for secrets in git history (use `git-secrets` or similar)
   - Validate `.env.example` doesn't contain real secrets

3. **Database Query Audit** (low priority)
   - Review all raw SQL queries for injection risks (low risk with Supabase)
   - Check for missing indexes on filtered columns (performance)
   - Verify all user input is parameterized

4. **Third-Party Script Audit** (low priority)
   - Review all external scripts loaded (Clerk, Stripe, Sentry)
   - Verify Subresource Integrity (SRI) for CDN scripts
   - Check for deprecated/unused analytics scripts

---

## Conclusion

**Phase 3 audit reveals mature security foundation with missing hardening layers:**

✅ Cookie security delegated to Clerk (secure by default)
✅ CORS defaults to same-origin (no wildcards)
⚠️ Rate limiting infrastructure exists but not deployed to high-priority routes
⚠️ Zod validation almost non-existent (1/131 routes)
⚠️ Sentry data scrubbing not configured (risk of token leaks)
⚠️ Security headers missing (6 headers: CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)

**All findings are WARNING-level** - no critical vulnerabilities that allow data breaches or unauthorized access.

**Recommendation:** Implement high-priority fixes (security headers + Sentry scrubbing) this week. Medium/low priority fixes can be staged over next 2-3 sprints.

**Comparison to Phase 1/2:**
- Phase 1: 3 CRITICAL vulnerabilities (unauthenticated data leaks) - **all fixed** ✅
- Phase 2: 1 WARNING (API key logging) - **not yet fixed**
- Phase 3: 4 WARNING (hardening gaps) - **awaiting fix approval**

**Overall Security Posture:** Strong authentication and authorization (Phase 1 fixes), good secret management (Phase 2 audit), missing defense-in-depth layers (Phase 3 findings).
