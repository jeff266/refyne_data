/**
 * Industry Reference API
 *
 * GET /api/harmonies/industry/reference
 *
 * Returns industry list from harmony reference data for filter dropdowns.
 */

import { NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

export async function GET() {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Find industry harmony
    const { data: harmonies } = await supabase
      .from('harmonies')
      .select('id')
      .eq('field', 'industry')
      .eq('is_active', true)
      .limit(1);

    if (!harmonies || harmonies.length === 0) {
      // Return fallback industry list
      return NextResponse.json({
        industries: [
          'Healthcare',
          'Software',
          'Education',
          'Manufacturing',
          'Retail',
          'Financial Services',
          'Professional Services',
          'Technology',
          'Non-Profit',
          'Other',
        ],
      });
    }

    const harmonyId = harmonies[0].id;

    // Fetch normalized values from reference data
    const { data: referenceData } = await supabase
      .from('harmony_reference_data')
      .select('normalized_value')
      .eq('harmony_id', harmonyId)
      .order('normalized_value');

    // Extract unique normalized values
    const industries = Array.from(
      new Set((referenceData || []).map((ref: any) => ref.normalized_value))
    ).filter(Boolean);

    return NextResponse.json({
      industries: industries.length > 0
        ? industries
        : [
            'Healthcare',
            'Software',
            'Education',
            'Manufacturing',
            'Retail',
            'Financial Services',
            'Professional Services',
            'Technology',
            'Non-Profit',
            'Other',
          ],
    });
  } catch (error) {
    console.error('[Industry Reference] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch industries',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
