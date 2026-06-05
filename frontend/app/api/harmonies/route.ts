import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { seedHarmonyLibrary } from '@/lib/harmonies/seed-library';
import { track } from '@/lib/telemetry/track';

/**
 * GET /api/harmonies
 *
 * Returns all preset harmonies (org_id IS NULL) plus custom harmonies for this org.
 * Seeds the library on first request if no preset harmonies exist.
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

    const { searchParams } = new URL(request.url);
    const objectType = searchParams.get('objectType') ?? 'company';
    const orgId = ctx.orgId;

    // Check if preset harmonies exist, if not, seed them
    const { data: presetCheck, error: checkError } = await supabase
      .from('harmonies')
      .select('id')
      .is('org_id', null)
      .limit(1);

    if (!checkError && (!presetCheck || presetCheck.length === 0)) {
      console.log('[Harmonies API] No preset harmonies found, seeding library...');
      await seedHarmonyLibrary();
    }

    // Fetch all preset harmonies (org_id IS NULL) + org-specific harmonies for selected object type
    const { data: harmonies, error } = await supabase
      .from('harmonies')
      .select('*')
      .eq('object_type', objectType)
      .or(`org_id.is.null,org_id.eq.${orgId}`)
      .order('object_type', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      captureWithOrgContext(error, orgId, { route: '/api/harmonies' });
      console.error('Failed to fetch harmonies:', error);
      return NextResponse.json({ error: 'Failed to load harmonies' }, { status: 500 });
    }

    // Fetch org-specific settings for preset harmonies
    const presetHarmonyIds = (harmonies || []).filter((h: any) => h.is_preset).map((h: any) => h.id);
    const { data: orgSettings } = presetHarmonyIds.length > 0
      ? await supabase
          .from('harmony_org_settings')
          .select('harmony_id, output_format')
          .eq('org_id', orgId)
          .in('harmony_id', presetHarmonyIds)
      : { data: [] };

    const orgSettingsMap = new Map(
      (orgSettings || []).map((s: any) => [s.harmony_id, s])
    );

    // Format response for the Harmonies page
    const formattedHarmonies = (harmonies || []).map((h) => {
      const orgSetting = orgSettingsMap.get(h.id);
      const effectiveOutputFormat = h.is_preset && orgSetting?.output_format
        ? orgSetting.output_format
        : h.output_format || 'default';

      return {
        id: h.id,
        name: h.name,
        description: h.description,
        category: h.object_type, // Map object_type to category for backward compat
        fields: [h.field],
        version: undefined,
        isActive: h.is_active,
        isPreset: h.is_preset,
        ruleCount: h.rule_count,
        recordsAffected: undefined, // TODO: Join with compliance scan results
        examples: h.examples || [],
        outputFormat: effectiveOutputFormat,
        outputFormatsAvailable: h.output_formats_available || [],
        transformType: h.transform_type || 'lookup',
        referenceTable: h.reference_table,
        conditionGroups: h.condition_groups || null, // NEW: For displaying condition badge
      };
    });

    return NextResponse.json({
      harmonies: formattedHarmonies,
      total: formattedHarmonies.length,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/harmonies' });
    console.error('Failed to get harmonies:', error);
    return NextResponse.json({ error: 'Failed to load harmonies' }, { status: 500 });
  }
}

/**
 * POST /api/harmonies
 *
 * Create a new custom harmony
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!isSupabaseConfigured() || !supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const {
      name,
      description,
      category,
      field,
      approach,
      object_type,
      transform_type,
      transform_function,
      write_policy,
    } = body;

    // Validate required fields
    const objectTypeValue = object_type || category;
    if (!name || !field || !objectTypeValue) {
      return NextResponse.json(
        { error: 'Missing required fields: name, field, object_type' },
        { status: 400 }
      );
    }

    // Validate transform type specific requirements
    if (transform_type === 'format' && !transform_function) {
      return NextResponse.json(
        { error: 'transform_function is required when transform_type is "format"' },
        { status: 400 }
      );
    }

    // Generate harmony ID (slug from field + timestamp for uniqueness)
    const harmonyId = `${field
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')}-${Date.now()}`;

    // Create harmony record
    const { data, error } = await supabase
      .from('harmonies')
      .insert({
        id: harmonyId,
        org_id: ctx.orgId,
        name,
        description,
        field,
        object_type: objectTypeValue,
        transform_type: transform_type || 'lookup',
        transform_function: transform_type === 'format' ? transform_function : null,
        write_policy: write_policy || 'fill_empty',
        is_preset: false,
        is_active: false,
        created_by: ctx.userId,
        // Legacy fields for backward compatibility
        category: objectTypeValue,
        approach: approach || 'reference_list',
      })
      .select()
      .single();

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/harmonies POST' });
      console.error('[Create Harmony] Failed:', error);
      return NextResponse.json({ error: 'Failed to create harmony' }, { status: 500 });
    }

    // Track harmony_created event
    track({
      event: 'harmony_created',
      orgId: ctx.orgId,
      userId: ctx.userId,
      metadata: {
        harmony_id: data.id,
        field,
        object_type: objectTypeValue,
        transform_type: transform_type || 'lookup',
      },
    });

    return NextResponse.json({ id: data.id, success: true });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/harmonies POST' });
    console.error('[Create Harmony] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to create harmony' }, { status: 500 });
  }
}
