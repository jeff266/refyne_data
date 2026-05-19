import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { clerkClient } from '@clerk/nextjs/server';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * GET /api/onboarding/welcome-data
 *
 * Returns inviter name, workspace name, user role,
 * current compliance score for invited user welcome screen
 * Auth: any role
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Get onboarding progress to find inviter
    const { data: progress, error: progressError } = await supabase
      .from('onboarding_progress')
      .select('invited_by, workspace_name')
      .eq('clerk_org_id', ctx.orgId)
      .single();

    if (progressError) {
      console.error('Failed to fetch onboarding progress:', progressError);
    }

    let inviterName = 'Your teammate';

    if (progress?.invited_by) {
      try {
        const client = await clerkClient();
        const inviter = await client.users.getUser(progress.invited_by);
        inviterName = inviter.firstName || inviter.emailAddresses[0]?.emailAddress || 'Your teammate';
      } catch (error) {
        console.error('Failed to fetch inviter:', error);
      }
    }

    // Get workspace name from entitlements
    const { data: entitlements, error: entitlementsError } = await supabase
      .from('workspace_entitlements')
      .select('org_name')
      .eq('clerk_org_id', ctx.orgId)
      .single();

    if (entitlementsError) {
      console.error('Failed to fetch workspace entitlements:', entitlementsError);
    }

    const workspaceName = entitlements?.org_name || progress?.workspace_name || 'the workspace';

    // TODO: Get current compliance score from latest scan
    // For now, return null
    const score = null;

    // TODO: Get duplicates pending review count
    const duplicatesPending = 0;

    return NextResponse.json({
      inviterName,
      workspaceName,
      role: ctx.orgRole,
      score,
      duplicatesPending,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/onboarding/welcome-data' });
    console.error('Failed to fetch welcome data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch welcome data' },
      { status: 500 }
    );
  }
}
