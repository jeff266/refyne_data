import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * GET /api/user/notification-prefs
 * Returns current user's notification preferences
 */
export async function GET(request: NextRequest) {
  // Auth check - get org and user from Clerk context
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('user_notification_prefs')
    .select('*')
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }

  return NextResponse.json({ preferences: data || [] });
}

/**
 * PUT /api/user/notification-prefs
 * Updates current user's notification preferences
 */
export async function PUT(request: NextRequest) {
  // Auth check - get org and user from Clerk context
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { preferences } = await request.json();

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  // Upsert all preferences
  const rows = preferences.map((p: { event_key: string; email: boolean; in_app: boolean }) => ({
    org_id: ctx.orgId,
    user_id: ctx.userId,
    event_key: p.event_key,
    email: p.email,
    in_app: p.in_app,
  }));

  const { data, error } = await supabase
    .from('user_notification_prefs')
    .upsert(rows)
    .select();

  if (error) {
    console.error('Failed to save preferences:', error);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }

  return NextResponse.json({ preferences: data });
}
