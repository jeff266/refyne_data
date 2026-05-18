import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * GET /api/notifications/subscriptions
 *
 * Returns all notification subscriptions for the current user.
 * Auth: any role
 */
export async function GET() {
  let ctx;
  try {
    ctx = getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { data: subscriptions, error } = await supabase
      .from('notification_subscriptions')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('user_id', ctx.userId)
      .order('notification_type', { ascending: true });

    if (error) {
      console.error('Failed to fetch subscriptions:', error);
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }

    return NextResponse.json({ subscriptions: subscriptions || [] });
  } catch (error) {
    console.error('Failed to get subscriptions:', error);
    return NextResponse.json({ error: 'Failed to get subscriptions' }, { status: 500 });
  }
}
