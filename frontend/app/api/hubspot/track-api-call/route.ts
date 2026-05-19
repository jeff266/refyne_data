import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';

/**
 * POST /api/hubspot/track-api-call
 *
 * Internal endpoint for tracking HubSpot API call usage.
 * Increments api_calls_today and api_calls_month counters.
 *
 * This is a fire-and-forget endpoint - failures are silently ignored.
 */
export async function POST(request: NextRequest) {
  try {
    const { connectionId } = await request.json();

    if (!connectionId || !supabase) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    // Use PostgreSQL's SQL to increment atomically
    const { error } = await supabase.rpc('increment_api_calls', {
      connection_id: connectionId,
    });

    if (error) {
      console.error('[API Tracking] Failed to increment counters:', error);
      return NextResponse.json({ success: false }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Tracking] Unexpected error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
