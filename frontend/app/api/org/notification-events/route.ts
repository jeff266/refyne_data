import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';

const DEFAULT_EVENTS = [
  { key: 'nightly_digest', enabled: true },
  { key: 'compliance_score_drop', enabled: true },
  { key: 'dedup_cluster_ready', enabled: true },
  { key: 'arrangement_complete', enabled: true },
  { key: 'arrangement_failed', enabled: true },
  { key: 'quarantine_record_added', enabled: false },
  { key: 'team_member_joined', enabled: true },
];

/**
 * GET /api/org/notification-events
 * Returns org-wide notification event settings (admin only)
 */
export async function GET(request: NextRequest) {
  const orgId = request.headers.get('x-org-id') || 'demo-org';

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('org_notification_events')
    .select('*')
    .eq('org_id', orgId);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }

  // If no events exist, return defaults
  const events = data?.length > 0 ? data : DEFAULT_EVENTS.map(e => ({
    org_id: orgId,
    event_key: e.key,
    enabled: e.enabled,
  }));

  return NextResponse.json({ events });
}

/**
 * PUT /api/org/notification-events
 * Updates org-wide notification event settings (admin only)
 */
export async function PUT(request: NextRequest) {
  const orgId = request.headers.get('x-org-id') || 'demo-org';
  const { events } = await request.json();

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  // Upsert all events
  const rows = events.map((e: { event_key: string; enabled: boolean }) => ({
    org_id: orgId,
    event_key: e.event_key,
    enabled: e.enabled,
  }));

  const { data, error } = await supabase
    .from('org_notification_events')
    .upsert(rows)
    .select();

  if (error) {
    console.error('Failed to save events:', error);
    return NextResponse.json({ error: 'Failed to save events' }, { status: 500 });
  }

  return NextResponse.json({ events: data });
}
