import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/supabase';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { currentUser } from '@clerk/nextjs/server';

/**
 * GET /api/admin/provider-requests
 *
 * Returns all provider requests (Refyne staff only)
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Check if user is Refyne staff
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  const isRefyneStaff = email?.endsWith('@refynedata.com') || email?.endsWith('@refyne.com');

  if (!isRefyneStaff) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { data: requests, error } = await supabaseAdmin
      .from('provider_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Admin Provider Requests] Query failed:', error);
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }

    return NextResponse.json({ requests: requests || [] });

  } catch (error) {
    console.error('[Admin Provider Requests] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}
