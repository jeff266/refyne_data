import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/db/supabase';

/**
 * PUT /api/profile/notifications/[type]
 *
 * Update user's subscription to a specific notification type.
 * Cannot update mandatory notifications.
 * Auth: any authenticated user
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { subscribed } = body;
    const notificationType = params.type;

    if (typeof subscribed !== 'boolean') {
      return NextResponse.json(
        { error: 'subscribed must be a boolean' },
        { status: 400 }
      );
    }

    // Check if this notification is mandatory
    const { data: existing } = await supabase
      .from('notification_subscriptions')
      .select('mandatory')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .eq('notification_type', notificationType)
      .single();

    if (existing?.mandatory) {
      return NextResponse.json(
        { error: 'Cannot modify mandatory notification' },
        { status: 403 }
      );
    }

    // Upsert subscription
    const { error } = await supabase
      .from('notification_subscriptions')
      .upsert(
        {
          org_id: orgId,
          user_id: userId,
          notification_type: notificationType,
          subscribed,
          mandatory: false,
        },
        {
          onConflict: 'org_id,user_id,notification_type',
        }
      );

    if (error) {
      console.error('Failed to update notification subscription:', error);
      return NextResponse.json(
        { error: 'Failed to update notification preference' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update notification preference:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preference' },
      { status: 500 }
    );
  }
}
