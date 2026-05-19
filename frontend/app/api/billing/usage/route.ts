import { NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';
import { getBillingContext } from '@/lib/billing/check-feature';
import { getPlanFeatures } from '@/lib/billing/plan-features';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * GET /api/billing/usage
 *
 * Get current usage metrics for billing display.
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

  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    );
  }

  try {
    const billing = await getBillingContext(ctx.orgId);
    const features = getPlanFeatures(billing.plan, billing.alwaysOnAddon);

    // Get connected portals count
    const { count: portalsConnected } = await supabase
      .from('hubspot_connections')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', ctx.orgId)
      .neq('connection_status', 'disconnected');

    // Get dedup pairs reviewed (for trial limit of 500)
    const { count: dedupPairsReviewed } = await supabase
      .from('dedup_pairs')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', ctx.orgId)
      .in('status', ['approved', 'rejected']);

    // Get org members from Clerk
    const memberships = await clerkClient().organizations.getOrganizationMembershipList({
      organizationId: ctx.orgId,
    });

    const operatorCount = memberships.data.filter(
      m => m.role === 'org:admin' || m.role === 'org:operator'
    ).length;

    const adminCount = memberships.data.filter(m => m.role === 'org:admin').length;

    return NextResponse.json({
      credits: {
        used: billing.creditsUsed,
        limit: billing.creditsLimit,
        remaining: Math.max(0, billing.creditsLimit - billing.creditsUsed),
        resetAt: null, // TODO: get from workspace_entitlements.credits_reset_at
      },
      dedup: {
        pairsReviewed: dedupPairsReviewed ?? 0,
        limit: billing.plan === 'trialing' ? 500 : null,
      },
      portals: {
        connected: portalsConnected ?? 0,
        limit: features.max_portals,
      },
      seats: {
        operators: operatorCount,
        admins: adminCount,
        limits: {
          operators: features.max_operators,
          admins: features.max_admins,
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/billing/usage] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage' },
      { status: 500 }
    );
  }
}
