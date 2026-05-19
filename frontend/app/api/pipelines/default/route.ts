import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * GET /api/pipelines/default
 *
 * Returns the default pipeline for the organization.
 */
export async function GET(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({ harmony_ids: [] });
    }

    const { data: pipeline } = await supabase
      .from('pipelines')
      .select('harmony_ids')
      .eq('org_id', ctx.orgId)
      .eq('is_default', true)
      .single();

    return NextResponse.json({
      harmony_ids: pipeline?.harmony_ids || [],
    });
  } catch (error) {
    console.error('Failed to get default pipeline:', error);
    return NextResponse.json({ harmony_ids: [] });
  }
}
