import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';

/**
 * GET /api/onboarding/status
 *
 * Returns onboarding progress with actual HubSpot connection check
 * Auth: Any authenticated user
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Fetch onboarding progress
    const { data: progress, error: progressError } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('org_id', ctx.orgId)
      .single();

    if (progressError && progressError.code !== 'PGRST116') {
      console.error('[Onboarding Status] Progress error:', progressError);
      return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 });
    }

    // Check actual HubSpot connection status
    const { data: connections, error: connError } = await supabase
      .from('hubspot_connections')
      .select('portal_id, connection_status')
      .eq('org_id', ctx.orgId)
      .eq('connection_status', 'connected');

    if (connError) {
      console.error('[Onboarding Status] Connection error:', connError);
    }

    const hasActiveConnection = connections && connections.length > 0;

    // Return combined status
    const result = progress || {
      org_id: ctx.orgId,
      connected_hubspot: false,
      calibration_completed: false,
      viewed_dedup: false,
      applied_harmony: false,
      ran_normalize: false,
      first_normalize_at: null,
      first_merge_at: null,
      completed_at: null,
      dismissed_at: null,
      created_at: new Date().toISOString(),
    };

    // Override connected_hubspot with actual connection check
    result.connected_hubspot = hasActiveConnection;

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Onboarding Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding status' },
      { status: 500 }
    );
  }
}
