import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError, requireOperatorOrAbove } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/arrangements/onboarding
 *
 * Returns onboarding status for the org
 * Auth: org:operator or above
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
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

    const { data: progress, error } = await supabase
      .from('onboarding_progress')
      .select('arrangements_onboarding_complete, arrangements_onboarding_skipped')
      .eq('org_id', ctx.orgId)
      .single();

    // If no record exists, return defaults
    if (error && error.code === 'PGRST116') {
      return NextResponse.json({
        arrangements_onboarding_complete: false,
        arrangements_onboarding_skipped: false,
      });
    }

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/onboarding' });
      console.error('Failed to get onboarding status:', error);
      return NextResponse.json(
        { error: 'Failed to get onboarding status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      arrangements_onboarding_complete: progress?.arrangements_onboarding_complete ?? false,
      arrangements_onboarding_skipped: progress?.arrangements_onboarding_skipped ?? false,
    });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/onboarding' });
    console.error('Failed to get onboarding status:', error);
    return NextResponse.json(
      { error: 'Failed to get onboarding status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/arrangements/onboarding
 *
 * Completes onboarding and optionally saves numeric preferences
 * Auth: org:operator or above
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
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

    const body = await request.json();

    // Handle reset (for testing)
    if (body.reset === true) {
      const { error: resetError } = await supabase
        .from('onboarding_progress')
        .upsert({
          org_id: ctx.orgId,
          arrangements_onboarding_complete: false,
          arrangements_onboarding_skipped: false,
        }, {
          onConflict: 'org_id'
        });

      if (resetError) {
        console.error('Failed to reset onboarding:', resetError);
        return NextResponse.json(
          { error: 'Failed to reset onboarding' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, reset: true });
    }

    // Update onboarding_progress
    const { error: progressError } = await supabase
      .from('onboarding_progress')
      .upsert({
        org_id: ctx.orgId,
        arrangements_onboarding_complete: true,
        arrangements_onboarding_skipped: body.skipped ?? false,
      }, {
        onConflict: 'org_id'
      });

    if (progressError) {
      captureWithOrgContext(progressError, ctx.orgId, { route: '/api/arrangements/onboarding', action: 'update_progress' });
      console.error('Failed to update onboarding progress:', progressError);
      return NextResponse.json(
        { error: 'Failed to update onboarding progress' },
        { status: 500 }
      );
    }

    // If numeric_default_strategy provided, save to arrangement_settings
    if (body.numeric_default_strategy) {
      const { error: settingsError } = await supabase
        .from('arrangement_settings')
        .upsert({
          org_id: ctx.orgId,
          numeric_default_strategy: body.numeric_default_strategy,
          field_numeric_strategies: {},
          calibration_auto_suggest: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'org_id'
        });

      if (settingsError) {
        captureWithOrgContext(settingsError, ctx.orgId, { route: '/api/arrangements/onboarding', action: 'save_settings' });
        console.error('Failed to save arrangement settings:', settingsError);
        // Don't fail the whole request - onboarding is still complete
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/onboarding', action: 'complete' });
    console.error('Failed to complete onboarding:', error);
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}
