import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError, requireAdmin } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/arrangements/settings
 *
 * Returns arrangement settings for the org (numeric defaults, etc.)
 * Auth: org:admin only
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
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

    const { data: settings, error } = await supabase
      .from('arrangement_settings')
      .select('*')
      .eq('org_id', ctx.orgId)
      .single();

    // If no settings exist yet, return defaults
    if (error && error.code === 'PGRST116') {
      return NextResponse.json({
        settings: {
          org_id: ctx.orgId,
          numeric_default_strategy: 'waterfall',
          field_numeric_strategies: {},
          calibration_auto_suggest: true,
        }
      });
    }

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/settings' });
      console.error('Failed to get arrangement settings:', error);
      return NextResponse.json(
        { error: 'Failed to get settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({ settings });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/settings' });
    console.error('Failed to get arrangement settings:', error);
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/arrangements/settings
 *
 * Updates arrangement settings for the org
 * Auth: org:admin only
 */
export async function PUT(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
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

    // Upsert settings
    const { data: settings, error } = await supabase
      .from('arrangement_settings')
      .upsert({
        org_id: ctx.orgId,
        numeric_default_strategy: body.numeric_default_strategy || 'waterfall',
        field_numeric_strategies: body.field_numeric_strategies || {},
        calibration_auto_suggest: body.calibration_auto_suggest ?? true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'org_id'
      })
      .select()
      .single();

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/settings', action: 'update' });
      console.error('Failed to update arrangement settings:', error);
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({ settings });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/settings', action: 'update' });
    console.error('Failed to update arrangement settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
