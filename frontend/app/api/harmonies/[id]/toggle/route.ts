import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * POST /api/harmonies/:id/toggle
 *
 * Toggles the is_active state of a harmony in the harmonies table.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const harmonyId = params.id;

    // Fetch the harmony (preset or org-specific)
    const { data: harmonies, error: fetchError } = await supabase
      .from('harmonies')
      .select('*')
      .eq('id', harmonyId)
      .or(`org_id.is.null,org_id.eq.${orgId}`);

    if (fetchError || !harmonies || harmonies.length === 0) {
      return NextResponse.json({ error: 'Harmony not found' }, { status: 404 });
    }

    const harmony = harmonies[0];

    // Toggle the is_active field
    const { error: updateError } = await supabase
      .from('harmonies')
      .update({
        is_active: !harmony.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', harmonyId)
      .or(`org_id.is.null,org_id.eq.${orgId}`);

    if (updateError) {
      captureWithOrgContext(updateError, orgId, {
        route: '/api/harmonies/[id]/toggle',
        harmonyId,
      });
      return NextResponse.json({ error: 'Failed to toggle harmony' }, { status: 500 });
    }

    // Return updated list of all active harmony IDs for this org
    const { data: allHarmonies } = await supabase
      .from('harmonies')
      .select('id, is_active')
      .or(`org_id.is.null,org_id.eq.${orgId}`)
      .eq('is_active', true);

    const activeIds = (allHarmonies || []).map((h) => h.id);

    return NextResponse.json({
      success: true,
      harmonies: activeIds,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, {
      route: '/api/harmonies/[id]/toggle',
      harmonyId: params.id,
    });
    console.error('Failed to toggle harmony:', error);
    return NextResponse.json({ error: 'Failed to toggle harmony' }, { status: 500 });
  }
}
