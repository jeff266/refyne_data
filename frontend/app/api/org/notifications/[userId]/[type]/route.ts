import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { supabase } from '@/lib/db/supabase';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';

const VALID_TYPES = [
  'always_on_digest',
  'compliance_threshold_alert',
  'dedup_pairs_detected',
  'quarantine_submitted',
  'quarantine_decided',
  'credit_limit_warning',
  'member_joined',
];

/**
 * PUT /api/org/notifications/:userId/:type
 *
 * Updates subscription preference for a specific user.
 * Cannot toggle mandatory subscriptions.
 * Auth: org:admin
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string; type: string } }
) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { userId, type } = params;

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { subscribed } = body;

    if (typeof subscribed !== 'boolean') {
      return NextResponse.json({ error: 'subscribed must be a boolean' }, { status: 400 });
    }

    // Verify user is in org
    const client = await clerkClient();
    const membershipList = await client.organizations.getOrganizationMembershipList({
      organizationId: ctx.orgId,
    });

    const member = membershipList.data.find((m) => m.publicUserData?.userId === userId);
    if (!member) {
      return NextResponse.json({ error: 'User not found in organization' }, { status: 404 });
    }

    // Check if subscription is mandatory
    const { data: existing } = await supabase
      .from('notification_subscriptions')
      .select('mandatory')
      .eq('org_id', ctx.orgId)
      .eq('user_id', userId)
      .eq('notification_type', type)
      .single();

    if (existing?.mandatory) {
      return NextResponse.json(
        { error: 'Cannot modify mandatory subscription' },
        { status: 403 }
      );
    }

    // Upsert subscription
    const userEmail = member.publicUserData?.identifier || '';
    const { data: subscription, error } = await supabase
      .from('notification_subscriptions')
      .upsert(
        {
          org_id: ctx.orgId,
          user_id: userId,
          user_email: userEmail,
          notification_type: type,
          subscribed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,user_id,notification_type' }
      )
      .select()
      .single();

    if (error) {
      console.error('Failed to update subscription:', error);
      return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
    }

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error('Failed to update subscription:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}
