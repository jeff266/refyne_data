import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/db/supabase';

/**
 * GET /api/profile/notifications
 *
 * Get current user's notification preferences.
 * Auth: any authenticated user
 */
export async function GET(request: NextRequest) {
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

    // Get user's notification subscriptions
    const { data: subscriptions, error } = await supabase
      .from('notification_subscriptions')
      .select('notification_type, subscribed, mandatory')
      .eq('org_id', orgId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to fetch notification subscriptions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch notification preferences' },
        { status: 500 }
      );
    }

    // Convert array to object keyed by notification_type
    const preferences = (subscriptions || []).reduce((acc, sub) => {
      acc[sub.notification_type] = {
        subscribed: sub.subscribed,
        mandatory: sub.mandatory,
      };
      return acc;
    }, {} as Record<string, { subscribed: boolean; mandatory: boolean }>);

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Failed to fetch notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    );
  }
}
