import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';

/**
 * GET /api/dedup/auto-merge/settings
 *
 * Get auto-merge settings for the current organization.
 */
export async function GET(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { data: settings, error: fetchError } = await supabase
      .from('dedup_auto_merge_settings')
      .select('*')
      .eq('org_id', ctx.orgId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = not found, which is expected for orgs without settings
      console.error('[Auto-merge Settings] Fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    // Return default settings if none exist
    if (!settings) {
      return NextResponse.json({
        enabled: false,
        confidence_threshold: 0.97,
        waiting_period_hours: 24,
        notify_email: null,
        notify_slack_webhook: null,
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('[Auto-merge Settings] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch auto-merge settings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/dedup/auto-merge/settings
 *
 * Update auto-merge settings for the current organization.
 */
export async function PATCH(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  requireAdmin(ctx.orgRole);

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = await request.json();

    // Validate threshold
    if (
      body.confidence_threshold !== undefined &&
      (body.confidence_threshold < 0 || body.confidence_threshold > 1)
    ) {
      return NextResponse.json(
        { error: 'Confidence threshold must be between 0 and 1' },
        { status: 400 }
      );
    }

    // Validate waiting period
    if (
      body.waiting_period_hours !== undefined &&
      (body.waiting_period_hours < 1 || body.waiting_period_hours > 168) // max 7 days
    ) {
      return NextResponse.json(
        { error: 'Waiting period must be between 1 and 168 hours' },
        { status: 400 }
      );
    }

    // Upsert settings
    const { data: settings, error: upsertError } = await supabase
      .from('dedup_auto_merge_settings')
      .upsert(
        {
          org_id: ctx.orgId,
          enabled: body.enabled,
          confidence_threshold: body.confidence_threshold,
          waiting_period_hours: body.waiting_period_hours,
          notify_email: body.notify_email,
          notify_slack_webhook: body.notify_slack_webhook,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'org_id',
        }
      )
      .select()
      .single();

    if (upsertError) {
      console.error('[Auto-merge Settings] Update error:', upsertError);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    console.log(`[Auto-merge Settings] Updated for org ${ctx.orgId}:`, settings);

    return NextResponse.json(settings);
  } catch (error) {
    console.error('[Auto-merge Settings] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update auto-merge settings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
