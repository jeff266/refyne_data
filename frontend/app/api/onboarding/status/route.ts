import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * GET /api/onboarding/status
 *
 * Returns current onboarding progress for the org.
 * Auto-creates row if missing.
 */
export async function GET() {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Return graceful default if database not configured
  if (!isSupabaseConfigured() || !supabase) {
    return NextResponse.json({
      org_id: ctx.orgId,
      connected_hubspot: false,
      viewed_dashboard: false,
      viewed_dedup: false,
      applied_harmony: false,
      ran_normalize: false,
      completed_at: null,
      dismissed: false,
    });
  }

  try {
    // Try to get existing progress
    let { data: progress, error } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('org_id', ctx.orgId)
      .single();

    // If not found, create it
    if (error && error.code === 'PGRST116') {
      const { data: newProgress, error: insertError } = await supabase
        .from('onboarding_progress')
        .insert({ org_id: ctx.orgId })
        .select()
        .single();

      if (insertError) {
        captureWithOrgContext(insertError, ctx.orgId, { route: '/api/onboarding/status' });
        console.error('Failed to create onboarding progress:', insertError);
        // Return default instead of 500
        return NextResponse.json({
          org_id: ctx.orgId,
          connected_hubspot: false,
          viewed_dashboard: false,
          viewed_dedup: false,
          applied_harmony: false,
          ran_normalize: false,
          completed_at: null,
          dismissed: false,
        });
      }

      progress = newProgress;
    } else if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/onboarding/status' });
      console.error('Failed to fetch onboarding progress:', error);
      // Return default instead of 500
      return NextResponse.json({
        org_id: ctx.orgId,
        connected_hubspot: false,
        viewed_dashboard: false,
        viewed_dedup: false,
        applied_harmony: false,
        ran_normalize: false,
        completed_at: null,
        dismissed: false,
      });
    }

    // Check actual data to determine step completion
    // Step 1: Connect HubSpot
    const { data: connections } = await supabase
      .from('hubspot_connections')
      .select('id')
      .eq('org_id', ctx.orgId)
      .limit(1);

    const connectedHubspot = (connections?.length || 0) > 0;

    // Step 4: Apply your first Harmony
    const { data: harmonies } = await supabase
      .from('normalization_settings')
      .select('org_id')
      .eq('org_id', ctx.orgId)
      .limit(1);

    const appliedHarmony = (harmonies?.length || 0) > 0;

    // Step 5: Run your first normalize
    const { data: runs } = await supabase
      .from('normalization_runs')
      .select('id')
      .eq('org_id', ctx.orgId)
      .eq('status', 'completed')
      .limit(1);

    const ranNormalize = (runs?.length || 0) > 0;

    // Update progress if needed
    const needsUpdate =
      progress!.connected_hubspot !== connectedHubspot ||
      progress!.applied_harmony !== appliedHarmony ||
      progress!.ran_normalize !== ranNormalize;

    if (needsUpdate) {
      const { data: updated } = await supabase
        .from('onboarding_progress')
        .update({
          connected_hubspot: connectedHubspot,
          applied_harmony: appliedHarmony,
          ran_normalize: ranNormalize,
        })
        .eq('org_id', ctx.orgId)
        .select()
        .single();

      if (updated) {
        progress = updated;
      }
    }

    // Calculate if all steps are complete
    const allComplete =
      progress!.connected_hubspot &&
      progress!.viewed_dashboard &&
      progress!.viewed_dedup &&
      progress!.applied_harmony &&
      progress!.ran_normalize;

    // Auto-complete if all steps done and not already marked
    if (allComplete && !progress!.completed_at) {
      const { data: updated } = await supabase
        .from('onboarding_progress')
        .update({ completed_at: new Date().toISOString() })
        .eq('org_id', ctx.orgId)
        .select()
        .single();

      if (updated) {
        progress = updated;
      }
    }

    return NextResponse.json(progress);
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/onboarding/status' });
    console.error('Failed to get onboarding status:', error);
    // Return graceful default instead of 500
    return NextResponse.json({
      org_id: ctx.orgId,
      connected_hubspot: false,
      viewed_dashboard: false,
      viewed_dedup: false,
      applied_harmony: false,
      ran_normalize: false,
      completed_at: null,
      dismissed: false,
    });
  }
}
