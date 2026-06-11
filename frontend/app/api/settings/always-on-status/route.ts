import { NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';

/**
 * GET /api/settings/always-on-status
 *
 * Returns Always On digest status for the current org.
 * Used by Sidebar to show status indicator.
 */
export async function GET() {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { data } = await supabaseAdmin
      .from('always_on_config')
      .select('digest_enabled')
      .eq('org_id', ctx.orgId)
      .single();

    // If no config row exists, Always On is disabled
    const enabled = data?.digest_enabled || false;

    return NextResponse.json({ enabled });
  } catch (error) {
    console.error('Failed to get Always On status:', error);
    // Default to disabled on error
    return NextResponse.json({ enabled: false });
  }
}
