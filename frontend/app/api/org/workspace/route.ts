import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';
import { clerkClient } from '@clerk/nextjs/server';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getStripeClient } from '@/lib/billing/stripe-client';
import Stripe from 'stripe';

function getStripeClientSafe(): Stripe | null {
  try {
    return getStripeClient();
  } catch {
    return null;
  }
}

/**
 * DELETE /api/org/workspace
 *
 * Delete workspace and all associated data.
 * Requires confirmation by typing workspace name.
 * Only allowed if user is sole admin or sole member.
 *
 * Steps:
 * 1. Validate user is only admin or sole member
 * 2. Cancel Stripe subscription if active
 * 3. Delete all Supabase data for org_id
 * 4. Delete Clerk organization
 *
 * Auth: admin only
 */
export async function DELETE(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { confirmName } = body;

    if (!confirmName || typeof confirmName !== 'string') {
      return NextResponse.json(
        { error: 'confirmName is required' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Get workspace name to verify confirmation
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspace_entitlements')
      .select('org_name, display_name')
      .eq('org_id', ctx.orgId)
      .single();

    if (workspaceError || !workspace) {
      captureWithOrgContext(workspaceError, ctx.orgId, { route: '/api/org/workspace DELETE' });
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const workspaceName = workspace.display_name || workspace.org_name;

    // Verify confirmation name matches
    if (confirmName.trim() !== workspaceName) {
      return NextResponse.json(
        { error: 'Workspace name does not match' },
        { status: 400 }
      );
    }

    // Check if user is only admin or sole member
    const org = await clerkClient().organizations.getOrganization({ organizationId: ctx.orgId });
    const memberCount = org.membersCount || 0;

    // Get admin count
    const memberships = await clerkClient().organizations.getOrganizationMembershipList({
      organizationId: ctx.orgId,
    });
    const adminCount = memberships.data.filter(m => m.role === 'org:admin').length;

    if (adminCount > 1) {
      return NextResponse.json(
        { error: 'Cannot delete workspace with multiple admins. Transfer ownership first.' },
        { status: 403 }
      );
    }

    // Step 1: Cancel Stripe subscription if exists
    const stripeClient = getStripeClientSafe();
    if (stripeClient) {
      try {
        const { data: subscriptions } = await stripeClient.subscriptions.list({
          limit: 100,
        });

        const orgSubscriptions = subscriptions.filter(sub =>
          sub.metadata?.org_id === ctx.orgId
        );

        for (const subscription of orgSubscriptions) {
          await stripeClient.subscriptions.cancel(subscription.id);
          console.log(`Cancelled Stripe subscription: ${subscription.id}`);
        }
      } catch (stripeError) {
        console.error('Failed to cancel Stripe subscriptions:', stripeError);
        // Non-fatal - continue with deletion
      }
    }

    // Step 2: Delete all Supabase data for this org
    const tables = [
      'hubspot_connections',
      'workspace_entitlements',
      'always_on_config',
      'normalized_records',
      'normalization_runs',
      'normalization_changes',
      'normalization_settings',
      'dedup_pairs',
      'dedup_suppression_rules',
      'field_mappings',
      'compliance_score_history',
      'compliance_alerts',
      'quarantine_records',
      'notification_subscriptions',
      'digest_runs',
      'onboarding_progress',
      'contact_dedup_pairs',
      'arrangement_runs',
      'hubspot_oauth_states',
      'org_events',
    ];

    for (const table of tables) {
      try {
        await supabase.from(table).delete().eq('org_id', ctx.orgId);
      } catch (deleteError) {
        console.error(`Failed to delete from ${table}:`, deleteError);
        // Continue with other tables
      }
    }

    // Step 3: Delete Clerk organization
    try {
      await clerkClient().organizations.deleteOrganization(ctx.orgId);
      console.log(`Deleted Clerk organization: ${ctx.orgId}`);
    } catch (clerkError) {
      console.error('Failed to delete Clerk organization:', clerkError);
      // Non-fatal if already deleted
    }

    return NextResponse.json({
      success: true,
      redirectTo: '/onboarding',
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/org/workspace DELETE' });
    console.error('Failed to delete workspace:', error);
    return NextResponse.json(
      { error: 'Failed to delete workspace' },
      { status: 500 }
    );
  }
}
