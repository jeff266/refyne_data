import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';

/**
 * GET /api/user/notification-prefs
 * Returns current user's notification preferences
 */
export async function GET(request: NextRequest) {
  const orgId = request.headers.get('x-org-id') || 'demo-org';
  const userId = request.headers.get('x-user-id') || 'demo-user';

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('user_notification_prefs')
    .select('*')
    .eq('org_id', orgId)
    .eq('user_id', userId);

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
  const orgId = request.headers.get('x-org-id') || 'demo-org';
  const userId = request.headers.get('x-user-id') || 'demo-user';
  const { preferences } = await request.json();

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  // Upsert all preferences
  const rows = preferences.map((p: { event_key: string; email: boolean; in_app: boolean }) => ({
    org_id: orgId,
    user_id: userId,
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
