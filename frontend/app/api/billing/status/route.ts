import { NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getBillingContext } from '@/lib/billing/check-feature';
import { getPlanFeatures } from '@/lib/billing/plan-features';

/**
 * GET /api/billing/status
 *
 * Get billing context and feature entitlements for current org.
 *
 * Auth: any role
 */
export async function GET() {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const billing = await getBillingContext(ctx.orgId);
    const features = getPlanFeatures(billing.plan, billing.alwaysOnAddon);

    return NextResponse.json({
      plan: billing.plan,
      status: billing.status,
      alwaysOnAddon: billing.alwaysOnAddon,
      creditsUsed: billing.creditsUsed,
      creditsLimit: billing.creditsLimit,
      creditsRemaining: Math.max(0, billing.creditsLimit - billing.creditsUsed),
      trialEndsAt: billing.trialEndsAt?.toISOString() ?? null,
      daysRemaining: billing.daysRemaining,
      features,
    });
  } catch (error) {
    console.error('[GET /api/billing/status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing status' },
      { status: 500 }
    );
  }
}
