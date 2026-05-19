import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * POST /api/onboarding/dismiss
 *
 * Dismisses the onboarding checklist permanently.
 */
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
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Set dismissed_at
    const { error } = await supabase
      .from('onboarding_progress')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('org_id', ctx.orgId);

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/onboarding/dismiss' });
      console.error('Failed to dismiss onboarding:', error);
      return NextResponse.json({ error: 'Failed to dismiss' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/onboarding/dismiss' });
    console.error('Failed to dismiss onboarding:', error);
    return NextResponse.json({ error: 'Failed to dismiss' }, { status: 500 });
  }
}
