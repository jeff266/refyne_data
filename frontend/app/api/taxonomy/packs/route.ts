/**
 * GET /api/taxonomy/packs
 *
 * Returns all active sub_industry_packs with entry counts.
 * Used in taxonomy wizard pack selection screen.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';

export async function GET(req: NextRequest) {
  try {
    // Get all active packs
    const { data: packs, error: packsError } = await supabase
      .from('sub_industry_packs')
      .select('id, name, description, industry_scope, is_active')
      .eq('is_active', true)
      .order('name');

    if (packsError) throw packsError;

    // Get entry counts for each pack
    const packsWithCounts = await Promise.all(
      (packs || []).map(async (pack) => {
        const { count } = await supabase
          .from('sub_industry_pack_entries')
          .select('*', { count: 'exact', head: true })
          .eq('pack_id', pack.id);

        return {
          ...pack,
          entryCount: count || 0,
        };
      })
    );

    return NextResponse.json({ packs: packsWithCounts });
  } catch (error) {
    console.error('[GET /api/taxonomy/packs] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch taxonomy packs' },
      { status: 500 }
    );
  }
}
