import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/connections
 *
 * Returns list of all HubSpot connections with stats.
 */
export async function GET() {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({ connections: [] });
    }

    // Get all connections
    const { data: connections, error } = await supabase
      .from('hubspot_connections')
      .select('org_id, portal_id, portal_name, created_at, updated_at');

    if (error) {
      console.error('Failed to fetch connections:', error);
      return NextResponse.json({ connections: [] });
    }

    // For each connection, get record count from normalized_records
    const connectionsWithStats = await Promise.all(
      (connections || []).map(async (conn) => {
        // Get company count from normalized_records
        const { count } = await supabase!
          .from('normalized_records')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', conn.org_id)
          .eq('record_type', 'company');

        // Calculate time since last update
        const lastSync = conn.updated_at
          ? formatTimeSince(new Date(conn.updated_at))
          : 'never';

        return {
          orgId: conn.org_id,
          portalId: conn.portal_id,
          name: conn.portal_name || `Portal ${conn.portal_id}`,
          companyCount: count || 0,
          lastSync,
        };
      })
    );

    return NextResponse.json({ connections: connectionsWithStats });
  } catch (error) {
    console.error('Failed to get connections:', error);
    return NextResponse.json(
      { error: 'Failed to get connections' },
      { status: 500 }
    );
  }
}

/**
 * Format time since a date as human-readable string.
 */
function formatTimeSince(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
