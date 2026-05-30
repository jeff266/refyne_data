/**
 * POST /api/normalize/clear-cache
 *
 * Clears the Redis cache for normalize issue counts.
 * Used after fixing bugs or when counts need to be recalculated.
 */

import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { createRedisConnection, isRedisConfigured } from '@/lib/queue/redis';

export async function POST() {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    if (!isRedisConfigured()) {
      return NextResponse.json(
        { message: 'Redis not configured - no cache to clear' },
        { status: 200 }
      );
    }

    // Get HubSpot connection to build cache key
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', ctx.orgId)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      return NextResponse.json(
        { message: 'No active HubSpot connection found' },
        { status: 404 }
      );
    }

    const cacheKey = `normalize:counts:${ctx.orgId}:${connection.portal_id}`;

    // Delete cache key
    const redis = createRedisConnection();
    const result = await redis.del(cacheKey);

    console.log(`[Clear Cache] Deleted cache key: ${cacheKey}, result: ${result}`);

    return NextResponse.json({
      message: 'Cache cleared successfully',
      cacheKey,
      deleted: result === 1,
    });
  } catch (error) {
    console.error('[Clear Cache] Error:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
