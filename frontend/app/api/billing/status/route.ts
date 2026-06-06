import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getEntitlements } from '@/lib/billing/entitlements';

/**
 * GET /api/billing/status
 *
 * Returns billing status for the current organization.
 * Used by UpgradeBanner to determine if upgrade prompt should show.
 *
 * Auth: Requires authenticated user
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const entitlements = await getEntitlements(ctx.orgId);

    if (!entitlements) {
      return NextResponse.json(
        { error: 'Billing status not found' },
        { status: 404 }
      );
    }

    // Return simplified billing status for UI
    return NextResponse.json({
      subscription_tier: entitlements.subscription_tier,
      subscription_status: entitlements.subscription_status,
      trial_days_remaining: entitlements.trial_days_remaining,
      trial_merges_remaining: entitlements.trial_merges_remaining,
      trial_normalize_remaining: entitlements.trial_normalize_remaining,
      trial_enrich_remaining: entitlements.trial_enrich_remaining,
      current_period_end: entitlements.current_period_end,
    });
  } catch (error) {
    console.error('[Billing Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing status' },
      { status: 500 }
    );
  }
}
