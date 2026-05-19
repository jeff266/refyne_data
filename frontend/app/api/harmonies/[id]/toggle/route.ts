import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * POST /api/harmonies/:id/toggle
 *
 * Toggles a harmony on/off for the organization.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Add auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  try {
    const harmonyId = params.id;

    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Check if harmony is currently enabled
    const { data: existing } = await supabase
      .from('pipelines')
      .select('harmony_ids')
      .eq('org_id', ctx.orgId)
      .eq('is_default', true)
      .single();

    const currentIds = existing?.harmony_ids || [];
    const isEnabled = currentIds.includes(harmonyId);

    // Toggle: add if not present, remove if present
    const newIds = isEnabled
      ? currentIds.filter((id: string) => id !== harmonyId)
      : [...currentIds, harmonyId];

    // Upsert the default pipeline
    const { error } = await supabase
      .from('pipelines')
      .upsert({
        org_id: ctx.orgId,
        name: 'Default Pipeline',
        harmony_ids: newIds,
        is_default: true,
      }, {
        onConflict: 'org_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('Failed to toggle harmony:', error);
      return NextResponse.json(
        { error: 'Failed to toggle harmony' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      harmonyId,
      enabled: !isEnabled,
      harmonies: newIds,
    });
  } catch (error) {
    console.error('Failed to toggle harmony:', error);
    return NextResponse.json(
      { error: 'Failed to toggle harmony' },
      { status: 500 }
    );
  }
}
