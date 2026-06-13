# Upgrade CTAs Implementation Guide

**Rule:** Every time a feature is blocked due to plan/trial/credits, show a link to the upgrade page. Never show a dead end.

## Implementation Status

### ✅ Completed Locations

#### 1. Trial Expired Banner
**File:** `components/billing/TrialBanner.tsx`
**Status:** Already implemented
**Details:**
- Shows "Your trial has ended. Upgrade to restore access."
- Links to `/settings/billing` with "Upgrade now" button
- Automatically shown when trial expires

#### 2. Credit Exhaustion State
**File:** `components/refyne/CreditsWidget.tsx`
**Status:** ✅ Implemented (June 12, 2026)
**Details:**
- Shows percentage usage with color coding
- When `percentage >= 100%`, displays "Add credits →" link
- Links to `/settings/billing`
- **Exempt check:** Only shows for non-exempt/non-internal orgs using `shouldShowUpgradePrompts()`

#### 3. 402 Payment Required Responses
**Files:**
- `lib/billing/api-response-handler.ts` - Handler utility
- `tests/billing/402-response.test.ts` - Tests
- API routes (e.g., `app/api/dedup/clusters/[id]/merge/route.ts`)

**Status:** ✅ Implemented (June 12, 2026)
**Details:**
- API routes return 402 when `consumeUsage()` fails
- Frontend can use `handleApiResponse()` utility to automatically show upgrade toast
- Toast shows: "Upgrade required to [action]" with "View plans →" link
- Links to `/settings/billing`

**Example Usage:**
```typescript
import { handleApiResponse } from '@/lib/billing/api-response-handler';

async function handleMerge() {
  const response = await fetch('/api/dedup/clusters/123/merge', {
    method: 'POST',
    body: JSON.stringify({ masterId: 'abc' })
  });

  const ok = await handleApiResponse(response, 'merge records');
  if (!ok) return; // 402 toast shown automatically

  // Continue with success handling...
}
```

#### 4. Feature Flags / Beta Gates
**Files:**
- `lib/billing/api-response-handler.ts` - Handler utility
- `lib/features/flags.ts` - Feature flag system
- API routes (e.g., `app/api/import/execute/route.ts`)

**Status:** ✅ Implemented (June 12, 2026)
**Details:**
- API routes return 403 with `error: 'feature_not_enabled'` for beta-gated features
- `handleApiResponse()` detects this and shows: "This feature is in beta"
- Links to `mailto:jeff@refynedata.com?subject=Beta Feature Access Request`
- **Note:** Beta access is manual, not through billing page

**Example API Route:**
```typescript
const betaEnabled = await isBetaFeatureEnabled(ctx.orgId, FEATURE_FLAGS.EVENT_LIST_IMPORT);
if (!betaEnabled) {
  return NextResponse.json({ error: 'feature_not_enabled' }, { status: 403 });
}
```

## Components & Utilities

### `<UpgradeLink />` Component
**File:** `components/ui/UpgradeLink.tsx`
**Tests:** `tests/ui/upgrade-link.test.tsx` (8 tests passing)

**Props:**
```typescript
interface UpgradeLinkProps {
  reason: string;        // "merge records"
  targetPlan?: string;   // "Growth" (optional)
  href?: string;         // defaults to /settings/billing
}
```

**Example Usage:**
```tsx
import { UpgradeLink } from '@/components/ui/UpgradeLink';
import { useEntitlements, shouldShowUpgradePrompts } from '@/lib/billing/use-entitlements';

function MyFeature() {
  const { subscription_tier } = useEntitlements();
  const canUseFeature = subscription_tier === 'growth' || subscription_tier === 'scale';

  if (!canUseFeature) {
    return (
      <div>
        <button disabled>Merge Records</button>
        {shouldShowUpgradePrompts(subscription_tier) && (
          <UpgradeLink reason="merge records" targetPlan="Growth" />
        )}
      </div>
    );
  }

  return <button onClick={handleMerge}>Merge Records</button>;
}
```

### `useEntitlements()` Hook
**File:** `lib/billing/use-entitlements.ts`
**Usage:** Client-side access to billing tier and status

**Returns:**
```typescript
{
  subscription_tier: 'trial' | 'starter' | 'growth' | 'scale' | 'internal' | 'exempt';
  subscription_status: 'active' | 'past_due' | 'cancelled' | 'paused';
  trial_days_remaining: number | null;
  loading: boolean;
}
```

**Example:**
```tsx
const { subscription_tier, loading } = useEntitlements();

if (loading) return <Spinner />;

// Don't show upgrade prompts for exempt/internal orgs
if (subscription_tier === 'exempt' || subscription_tier === 'internal') {
  return <button onClick={handleAction}>Do Action</button>;
}

// Show upgrade prompt for trial
if (subscription_tier === 'trial') {
  return (
    <>
      <button disabled>Do Action</button>
      <UpgradeLink reason="perform action" />
    </>
  );
}
```

### `shouldShowUpgradePrompts()` Helper
**File:** `lib/billing/use-entitlements.ts`

**Usage:**
```typescript
import { shouldShowUpgradePrompts } from '@/lib/billing/use-entitlements';

if (shouldShowUpgradePrompts(tier)) {
  // Show upgrade link
}
```

**Logic:**
```typescript
return tier !== 'exempt' && tier !== 'internal';
```

### `handleApiResponse()` Utility
**File:** `lib/billing/api-response-handler.ts`
**Tests:** `tests/billing/402-response.test.ts` (6 tests passing)

**Parameters:**
```typescript
async function handleApiResponse(
  response: Response,
  action?: string  // Human-readable action name
): Promise<boolean>
```

**Returns:** `true` if response is ok, `false` if error

**Behavior:**
- **200-299:** Returns `true`, no toast
- **402:** Shows "Upgrade required to [action]" toast with billing link, returns `false`
- **403 + feature_not_enabled:** Shows beta access request toast, returns `false`
- **Other errors:** Returns `false`, no toast (caller should handle)

**Example:**
```tsx
const response = await fetch('/api/some-action', { method: 'POST' });
const ok = await handleApiResponse(response, 'perform action');

if (!ok) {
  // Error already handled with appropriate toast
  return;
}

// Success - continue
const data = await response.json();
```

## Exempt Organizations

**Orgs that should NEVER see upgrade prompts:**
- RevOps Impact
- Frontera
- GrowthBook

**Implementation:**
- All have `subscription_tier = 'exempt'` or `'internal'`
- `canPerformAction()` in `lib/billing/entitlements.ts` (lines 100-103) bypasses all limits
- `shouldShowUpgradePrompts()` returns `false` for these tiers
- All upgrade UI components should check tier before showing

**Example Check:**
```typescript
const { subscription_tier } = useEntitlements();

if (subscription_tier === 'exempt' || subscription_tier === 'internal') {
  return null; // No upgrade prompt
}
```

## Disabled Buttons Pattern

### ❌ Bad (dead end):
```tsx
<button disabled={!canPerformAction}>
  Merge Records
</button>
```

### ✅ Good (with upgrade CTA):
```tsx
import { useEntitlements, shouldShowUpgradePrompts } from '@/lib/billing/use-entitlements';
import { UpgradeLink } from '@/components/ui/UpgradeLink';

const { subscription_tier } = useEntitlements();
const canMerge = tier === 'growth' || tier === 'scale' || tier === 'exempt';

<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
  <button disabled={!canMerge}>
    Merge Records
  </button>
  {!canMerge && shouldShowUpgradePrompts(subscription_tier) && (
    <UpgradeLink reason="merge records" targetPlan="Growth" />
  )}
</div>
```

### With Tooltip:
```tsx
<div title={canMerge ? '' : 'Available on Growth plan and above'}>
  <button disabled={!canMerge}>
    Merge Records
  </button>
  {!canMerge && shouldShowUpgradePrompts(subscription_tier) && (
    <UpgradeLink reason="merge records" targetPlan="Growth" />
  )}
</div>
```

## Billing Page

**Location:** `/settings/billing`
**File:** `app/(dashboard)/settings/billing/page.tsx`

**Requirements:**
- ✅ Shows current plan clearly
- ✅ Shows what next plan unlocks
- ⚠️ Real Stripe checkout link (needs implementation)

**Current Status:**
- Upgrade links point to this page
- Page exists and shows plan status
- Stripe integration may need completion for self-serve upgrades

## Testing

**Test Coverage:** 14 new tests, all passing

**Files:**
- `tests/ui/upgrade-link.test.tsx` - 8 tests
  - Component rendering
  - Href validation
  - Target plan display
  - Entitlements integration
- `tests/billing/402-response.test.ts` - 6 tests
  - Success responses
  - 402 upgrade prompts
  - 403 beta gates
  - Other error handling

**Total Tests:** 1,762 passing (was 1,748 + 14 new)

**Run Tests:**
```bash
npm test -- tests/ui/upgrade-link.test.tsx tests/billing/402-response.test.ts --run
```

## Quick Reference

| Scenario | Solution | Link Target |
|----------|----------|-------------|
| Trial expired | TrialBanner (auto) | `/settings/billing` |
| Credits exhausted | "Add credits →" in CreditsWidget | `/settings/billing` |
| 402 API response | Toast with "View plans →" | `/settings/billing` |
| Beta feature | Toast with "Request access →" | `mailto:jeff@refynedata.com` |
| Disabled button | `<UpgradeLink>` component | `/settings/billing` |

## Next Steps

1. ✅ Create UpgradeLink component
2. ✅ Add 402 response handler
3. ✅ Update CreditsWidget with upgrade CTA
4. ✅ Add tests (14 passing)
5. ⚠️ Audit all disabled buttons and add upgrade links (ongoing)
6. ⚠️ Complete Stripe checkout integration on billing page
7. ⚠️ Add inline upgrade CTAs to specific feature pages (as needed)

## Maintenance

When adding new paid features:
1. Add entitlement check in API route (return 402 if blocked)
2. Use `handleApiResponse()` in frontend code
3. Add `<UpgradeLink>` near disabled UI elements
4. Always check `shouldShowUpgradePrompts(tier)` before showing upgrade UI
5. Test with exempt org to ensure no upgrade prompts shown
