import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * POST /api/onboarding/step/:step
 *
 * Marks a specific onboarding step as complete.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { step: string } }
) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { step } = params;

  // Validate step name
  const validSteps = [
    'connected_hubspot',
    'viewed_dashboard',
    'viewed_dedup',
    'applied_harmony',
    'ran_normalize',
  ];

  if (!validSteps.includes(step)) {
    return NextResponse.json({ error: 'Invalid step' }, { status: 400 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Ensure progress row exists
    const { data: existing } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('org_id', ctx.orgId)
      .single();

    if (!existing) {
      // Create row
      await supabase
        .from('onboarding_progress')
        .insert({ org_id: ctx.orgId, [step]: true });
    } else if (!existing[step as keyof typeof existing]) {
      // Update step to true
      await supabase
        .from('onboarding_progress')
        .update({ [step]: true })
        .eq('org_id', ctx.orgId);
    }

    // Check if all steps are now complete
    const { data: progress } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('org_id', ctx.orgId)
      .single();

    if (progress) {
      const allComplete =
        progress.connected_hubspot &&
        progress.viewed_dashboard &&
        progress.viewed_dedup &&
        progress.applied_harmony &&
        progress.ran_normalize;

      // Mark as completed if all done
      if (allComplete && !progress.completed_at) {
        await supabase
          .from('onboarding_progress')
          .update({ completed_at: new Date().toISOString() })
          .eq('org_id', ctx.orgId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/onboarding/step', step });
    console.error('Failed to update onboarding step:', error);
    return NextResponse.json({ error: 'Failed to update step' }, { status: 500 });
  }
}
