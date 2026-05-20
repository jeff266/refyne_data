import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

interface RouteContext {
  params: { id: string };
}

/**
 * PATCH /api/harmonies/[id]
 *
 * Update harmony (approach, rules, activation status)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!isSupabaseConfigured() || !supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const harmonyId = context.params.id;

  try {
    const body = await request.json();
    const { approach, rules, is_active } = body;

    // Update harmony
    const updates: any = {};
    if (approach) updates.approach = approach;
    if (typeof is_active === 'boolean') updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();

    const { error: harmonyError } = await supabase
      .from('harmonies')
      .update(updates)
      .eq('id', harmonyId)
      .eq('org_id', ctx.orgId);

    if (harmonyError) {
      captureWithOrgContext(harmonyError, ctx.orgId, { route: `/api/harmonies/${harmonyId} PATCH` });
      console.error('[Update Harmony] Failed:', harmonyError);
      return NextResponse.json({ error: 'Failed to update harmony' }, { status: 500 });
    }

    // If rules provided, replace all rules
    if (rules && Array.isArray(rules)) {
      // Delete existing rules
      await supabase
        .from('harmony_rules')
        .delete()
        .eq('harmony_id', harmonyId);

      // Insert new rules
      if (rules.length > 0) {
        const { error: rulesError } = await supabase
          .from('harmony_rules')
          .insert(
            rules.map((rule: any) => ({
              harmony_id: harmonyId,
              input_pattern: rule.input_pattern,
              normalized_value: rule.normalized_value,
              match_type: rule.match_type || 'exact',
              sort_order: rule.sort_order || 0,
            }))
          );

        if (rulesError) {
          captureWithOrgContext(rulesError, ctx.orgId, { route: `/api/harmonies/${harmonyId} rules` });
          console.error('[Update Harmony Rules] Failed:', rulesError);
          return NextResponse.json({ error: 'Failed to update rules' }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: `/api/harmonies/${harmonyId} PATCH` });
    console.error('[Update Harmony] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to update harmony' }, { status: 500 });
  }
}
