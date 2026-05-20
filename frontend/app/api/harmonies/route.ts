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
