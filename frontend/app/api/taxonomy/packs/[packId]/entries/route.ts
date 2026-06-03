/**
 * GET /api/taxonomy/packs/[packId]/entries
 *
 * Returns all entries for a specific pack.
 * Used in taxonomy wizard review screen.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: { packId: string } }
) {
  try {
    const { packId } = params;

    // Get all entries for this pack
    const { data: entries, error } = await supabase
      .from('sub_industry_pack_entries')
      .select('*')
      .eq('pack_id', packId)
      .order('canonical_value')
      .order('input_value');

    if (error) throw error;

    return NextResponse.json({ entries: entries || [] });
  } catch (error) {
    console.error(`[GET /api/taxonomy/packs/${params.packId}/entries] Error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch pack entries' },
      { status: 500 }
    );
  }
}
