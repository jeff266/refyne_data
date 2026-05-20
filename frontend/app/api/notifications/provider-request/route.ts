import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * POST /api/notifications/provider-request
 *
 * Operator requests admin to connect a provider.
 * Notifies all org admins.
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!isSupabaseConfigured() || !supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { provider } = body;

    if (!provider) {
      return NextResponse.json({ error: 'Provider name required' }, { status: 400 });
    }

    // Get all admin members of the org from Clerk
    const client = await clerkClient();
    const orgMembershipList = await client.organizations.getOrganizationMembershipList({
      organizationId: ctx.orgId,
    });

    const adminMembers = orgMembershipList.data.filter(
      (membership) => membership.role === 'org:admin'
    );

    if (adminMembers.length === 0) {
      console.warn(`[Provider Request] No admins found for org ${ctx.orgId}`);
      return NextResponse.json({
        success: true,
        message: 'Request received but no admins to notify',
      });
    }

    // Insert notification for each admin
    const notifications = adminMembers.map((admin) => ({
      org_id: ctx.orgId,
      user_id: admin.publicUserData?.userId || '',
      event_key: 'provider_connection_requested',
      metadata: {
        provider,
        requested_by: ctx.userId,
        requested_at: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('org_events')
      .insert(notifications);

    if (insertError) {
      captureWithOrgContext(insertError, ctx.orgId, {
        route: '/api/notifications/provider-request',
        provider,
      });
      console.error('[Provider Request] Failed to insert notifications:', insertError);
      return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 });
    }

    console.log(`[Provider Request] Notified ${adminMembers.length} admins about ${provider} request`);

    return NextResponse.json({
      success: true,
      admins_notified: adminMembers.length,
    });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, {
      route: '/api/notifications/provider-request',
    });
    console.error('[Provider Request] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
