import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

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
 * PUT /api/notifications/subscriptions/:type
 *
 * Updates subscription preference for current user.
 * Cannot toggle mandatory subscriptions.
 * Auth: any role
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { type } = params;

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

    // Check if subscription is mandatory
    const { data: existing } = await supabase
      .from('notification_subscriptions')
      .select('mandatory')
      .eq('org_id', ctx.orgId)
      .eq('user_id', ctx.userId)
      .eq('notification_type', type)
      .single();

    if (existing?.mandatory) {
      return NextResponse.json(
        { error: 'Cannot modify mandatory subscription' },
        { status: 403 }
      );
    }

    // Upsert subscription
    const { data: subscription, error } = await supabase
      .from('notification_subscriptions')
      .upsert(
        {
          org_id: ctx.orgId,
          user_id: ctx.userId,
          user_email: ctx.userEmail || '',
          notification_type: type,
          subscribed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,user_id,notification_type' }
      )
      .select()
      .single();

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/notifications/subscriptions/[type]' });
      console.error('Failed to update subscription:', error);
      return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
    }

    return NextResponse.json({ subscription });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/notifications/subscriptions/[type]' });
    console.error('Failed to update subscription:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}
