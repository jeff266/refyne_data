import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * GET /api/contact-normalize/settings
 *
 * Get contact normalization settings for the organization.
 */
export async function GET(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  // Feature gate: normalize
  try {
    await requireFeature(ctx.orgId, 'normalize');
  } catch (error) {
    const gateError = parseFeatureGateError(error);
    if (gateError) {
      return NextResponse.json(
        { error: 'feature_gated', feature: gateError.feature, currentPlan: gateError.currentPlan },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const orgId = ctx.orgId;

    const { data, error } = await supabase
      .from('contact_normalization_settings')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error && error.code !== 'PGRST116') { // Not "no rows returned"
      captureWithOrgContext(error, ctx.orgId, { route: '/api/contact-normalize/settings' });
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }

    // Return default settings if none exist
    if (!data) {
      return NextResponse.json({
        enabled_harmonies: ['contact-email-lower', 'contact-phone-e164', 'contact-name-case'],
        scope_type: 'all',
        scope_list_id: null,
        scope_filters: null,
        preview_limit: 100,
      });
    }

    return NextResponse.json({
      enabled_harmonies: data.enabled_harmonies,
      scope_type: data.scope_type,
      scope_list_id: data.scope_list_id,
      scope_filters: data.scope_filters,
      preview_limit: data.preview_limit,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/contact-normalize/settings' });
    console.error('Failed to get contact normalize settings:', error);
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/contact-normalize/settings
 *
 * Update contact normalization settings.
 */
export async function PUT(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  // Feature gate: normalize
  try {
    await requireFeature(ctx.orgId, 'normalize');
  } catch (error) {
    const gateError = parseFeatureGateError(error);
    if (gateError) {
      return NextResponse.json(
        { error: 'feature_gated', feature: gateError.feature, currentPlan: gateError.currentPlan },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const orgId = ctx.orgId;
    const body = await request.json();

    const { data, error } = await supabase
      .from('contact_normalization_settings')
      .upsert({
        org_id: orgId,
        enabled_harmonies: body.enabled_harmonies || [],
        scope_type: body.scope_type || 'all',
        scope_list_id: body.scope_list_id || null,
        scope_filters: body.scope_filters || null,
        preview_limit: body.preview_limit || 100,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'org_id' })
      .select()
      .single();

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/contact-normalize/settings' });
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      enabled_harmonies: data.enabled_harmonies,
      scope_type: data.scope_type,
      scope_list_id: data.scope_list_id,
      scope_filters: data.scope_filters,
      preview_limit: data.preview_limit,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/contact-normalize/settings' });
    console.error('Failed to update contact normalize settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
