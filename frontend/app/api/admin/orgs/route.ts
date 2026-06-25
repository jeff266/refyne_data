import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * GET /api/admin/orgs
 *
 * Returns all orgs with billing status, usage, and connection info.
 *
 * Auth: Requires super admin
 */
export async function GET() {
  try {
    await requireSuperAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  try {
    // Get all org_billing records
    const { data: orgBillingRecords, error: billingError } = await supabaseAdmin
      .from('org_billing')
      .select(`
        org_id,
        subscription_tier,
        subscription_status,
        plan_override,
        plan_override_reason,
        plan_override_set_at,
        trial_ends_at,
        trial_extended_by_days,
        stripe_customer_id,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (billingError) {
      console.error('[GET /api/admin/orgs] Billing error:', billingError);
      return NextResponse.json(
        { error: 'Failed to fetch org billing records' },
        { status: 500 }
      );
    }

    // Get HubSpot connections
    const { data: connections } = await supabaseAdmin
      .from('hubspot_connections')
      .select('org_id, connection_status')
      .in('connection_status', ['active', 'connected']);

    const connectedOrgIds = new Set(
      connections?.map((c) => c.org_id) || []
    );

    // Get credit grants
    const { data: creditGrants } = await supabaseAdmin
      .from('admin_credit_grants')
      .select('org_id, credits');

    const creditsByOrg = new Map<string, number>();
    creditGrants?.forEach((grant) => {
      const current = creditsByOrg.get(grant.org_id) || 0;
      creditsByOrg.set(grant.org_id, current + grant.credits);
    });

    // Get org names from Clerk
    const client = await clerkClient();
    const orgs = await Promise.all(
      (orgBillingRecords || []).map(async (billing) => {
        let orgName = billing.org_id; // fallback
        let memberCount = 0;

        try {
          const org = await client.organizations.getOrganization({
            organizationId: billing.org_id,
          });
          orgName = org.name;
          memberCount = org.membersCount || 0;
        } catch (err) {
          console.warn(`Failed to fetch org ${billing.org_id} from Clerk:`, err);
        }

        // Determine effective plan
        const effectivePlan = billing.plan_override || billing.subscription_tier || 'trial';

        // Calculate trial status
        const now = new Date();
        const trialEndsAt = billing.trial_ends_at ? new Date(billing.trial_ends_at) : null;
        const isTrialExpired = trialEndsAt ? trialEndsAt < now : false;
        const daysRemaining = trialEndsAt
          ? Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        // Get trial status display
        let trialStatus = 'Paid';
        if (billing.subscription_tier === 'trial' && !billing.plan_override) {
          if (isTrialExpired) {
            trialStatus = 'Expired';
          } else if (daysRemaining !== null) {
            trialStatus = `${daysRemaining} days`;
          }
        }

        // Calculate credits (base trial credits + admin grants)
        const baseCredits = 50; // TODO: Make this configurable
        const grantedCredits = creditsByOrg.get(billing.org_id) || 0;
        const totalCredits = baseCredits + grantedCredits;

        return {
          org_id: billing.org_id,
          name: orgName,
          plan: effectivePlan,
          plan_override: billing.plan_override,
          plan_override_reason: billing.plan_override_reason,
          trial_status: trialStatus,
          trial_ends_at: billing.trial_ends_at,
          trial_extended_by_days: billing.trial_extended_by_days || 0,
          is_trial_expired: isTrialExpired,
          credits_used: 0, // TODO: Calculate from usage
          credits_total: totalCredits,
          hubspot_connected: connectedOrgIds.has(billing.org_id),
          member_count: memberCount,
          created_at: billing.created_at,
        };
      })
    );

    return NextResponse.json({ orgs });
  } catch (error) {
    console.error('[GET /api/admin/orgs] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
