import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { seedHarmonyLibrary } from '@/lib/harmonies/seed-library';

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

    // Fetch all preset harmonies (org_id IS NULL) + org-specific harmonies
    const { data: harmonies, error } = await supabase
      .from('harmonies')
      .select('*')
      .or(`org_id.is.null,org_id.eq.${orgId}`)
      .order('object_type', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      captureWithOrgContext(error, orgId, { route: '/api/harmonies' });
      console.error('Failed to fetch harmonies:', error);
      return NextResponse.json({ error: 'Failed to load harmonies' }, { status: 500 });
    }

    // Format response for the Harmonies page
    const formattedHarmonies = (harmonies || []).map((h) => ({
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
    }));

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
    const { name, description, category, field, approach } = body;

    // Validate required fields
    if (!name || !field || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: name, field, category' },
        { status: 400 }
      );
    }

    // Generate harmony ID (slug from name + timestamp for uniqueness)
    const harmonyId = `${name
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
        category,
        field,
        object_type: category,
        approach: approach || 'reference_list',
        is_preset: false,
        is_active: false,
        created_by: ctx.userId,
      })
      .select()
      .single();

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/harmonies POST' });
      console.error('[Create Harmony] Failed:', error);
      return NextResponse.json({ error: 'Failed to create harmony' }, { status: 500 });
    }

    return NextResponse.json({ id: data.id, success: true });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/harmonies POST' });
    console.error('[Create Harmony] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to create harmony' }, { status: 500 });
  }
}
