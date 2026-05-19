import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * POST /api/onboarding/complete
 *
 * Marks score_revealed_at = now()
 * Triggers Email 1 via Resend
 * Auth: any role
 */
export async function POST(request: NextRequest) {
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

    // Mark score revealed
    const { error: updateError } = await supabase
      .from('onboarding_progress')
      .update({ score_revealed_at: new Date().toISOString() })
      .eq('clerk_org_id', ctx.orgId);

    if (updateError) {
      captureWithOrgContext(updateError, ctx.orgId, { route: '/api/onboarding/complete' });
      console.error('Failed to mark score revealed:', updateError);
      return NextResponse.json(
        { error: 'Failed to complete onboarding' },
        { status: 500 }
      );
    }

    // TODO: Trigger Email 1 via Resend
    // Subject: "Your HubSpot health score: [N]/100"
    // This will be implemented in Step 13

    return NextResponse.json({ success: true });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/onboarding/complete' });
    console.error('Failed to complete onboarding:', error);
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}
