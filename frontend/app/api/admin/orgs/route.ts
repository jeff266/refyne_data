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

    // Get latest record counts for all orgs
    const { data: recordCounts } = await supabaseAdmin
      .from('hubspot_record_counts')
      .select('org_id, total_records, is_near_limit, is_over_limit, grace_period_expired')
      .order('fetched_at', { ascending: false });

    // Map org_id to latest record count
    const recordCountsByOrg = new Map<string, {
      totalRecords: number;
      isNearLimit: boolean;
      isOverLimit: boolean;
      gracePeriodExpired: boolean;
    }>();

    recordCounts?.forEach((rc) => {
      if (!recordCountsByOrg.has(rc.org_id)) {
        recordCountsByOrg.set(rc.org_id, {
          totalRecords: rc.total_records,
          isNearLimit: rc.is_near_limit || false,
          isOverLimit: rc.is_over_limit || false,
          gracePeriodExpired: rc.grace_period_expired || false,
        });
      }
    });

    // Fix 1: Fetch all Clerk orgs upfront
    const client = await clerkClient();
    const { data: clerkOrgs } = await client.organizations.getOrganizationList({
      limit: 100,
    });

    const orgNameMap = new Map<string, string>();
    clerkOrgs.forEach((org) => {
      orgNameMap.set(org.id, org.name);
    });

    // Fix 2: Fetch member counts in parallel with Promise.allSettled
    const memberCountPromises = (orgBillingRecords || []).map(async (billing) => {
      try {
        const { data: memberships } = await client.organizations.getOrganizationMembershipList({
          organizationId: billing.org_id,
          limit: 100,
        });
        return { org_id: billing.org_id, count: memberships?.length || 0 };
      } catch (err) {
        return { org_id: billing.org_id, count: null };
      }
    });

    const memberCountResults = await Promise.allSettled(memberCountPromises);
    const memberCountMap = new Map<string, number | null>();
    memberCountResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        memberCountMap.set(result.value.org_id, result.value.count);
      }
    });

    // Fix 3: Separate plan and trial status
    const orgs = (orgBillingRecords || []).map((billing) => {
      const orgName = orgNameMap.get(billing.org_id) || 'Unknown org';
      const memberCount = memberCountMap.get(billing.org_id);

      // Determine effective plan
      const effectivePlan = billing.plan_override || billing.subscription_tier || 'trial';

      // Calculate trial state (separate from plan)
      const now = new Date();
      const trialEndsAt = billing.trial_ends_at ? new Date(billing.trial_ends_at) : null;
      const isTrialExpired = trialEndsAt ? trialEndsAt < now : false;
      const daysRemaining = trialEndsAt
        ? Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Trial state: only show if not on paid plan and no override
      let trialState = 'N/A';
      if (billing.subscription_status !== 'active' && !billing.plan_override) {
        if (billing.trial_ends_at) {
          if (isTrialExpired) {
            trialState = 'Expired';
          } else if (daysRemaining !== null && daysRemaining > 0) {
            trialState = `${daysRemaining} days left`;
          }
        }
      }

      // Calculate credits (base trial credits + admin grants)
      const baseCredits = 50;
      const grantedCredits = creditsByOrg.get(billing.org_id) || 0;
      const totalCredits = baseCredits + grantedCredits;

      // Get record count data
      const recordCountData = recordCountsByOrg.get(billing.org_id);

      return {
        org_id: billing.org_id,
        name: orgName,
        plan: effectivePlan,
        plan_override: billing.plan_override,
        plan_override_reason: billing.plan_override_reason,
        trial_state: trialState,
        trial_ends_at: billing.trial_ends_at,
        trial_extended_by_days: billing.trial_extended_by_days || 0,
        is_trial_expired: isTrialExpired,
        credits_used: 0, // TODO: Calculate from usage
        credits_total: totalCredits,
        hubspot_connected: connectedOrgIds.has(billing.org_id),
        member_count: memberCount,
        created_at: billing.created_at,
        total_records: recordCountData?.totalRecords || null,
        is_near_limit: recordCountData?.isNearLimit || false,
        is_over_limit: recordCountData?.isOverLimit || false,
        grace_period_expired: recordCountData?.gracePeriodExpired || false,
      };
    });

    return NextResponse.json({ orgs });
  } catch (error) {
    console.error('[GET /api/admin/orgs] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
