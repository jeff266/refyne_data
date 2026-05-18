import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/pipelines/default
 *
 * Returns the default pipeline for the organization.
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = request.headers.get('x-org-id') || 'default';

    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({ harmony_ids: [] });
    }

    const { data: pipeline } = await supabase
      .from('pipelines')
      .select('harmony_ids')
      .eq('org_id', orgId)
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
