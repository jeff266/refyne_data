/**
 * GET /api/taxonomy/harmonies/[harmonyId]/suggestions
 * Fetches pending suggestions for a harmony, grouped by confidence level
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';

export async function GET(
  req: NextRequest,
  { params }: { params: { harmonyId: string } }
) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const orgId = ctx.orgId;

    // Verify harmony belongs to org
    const { data: harmony, error: harmonyError } = await supabaseAdmin
      .from('harmonies')
      .select('id')
      .eq('id', params.harmonyId)
      .eq('org_id', orgId)
      .single();

    if (harmonyError || !harmony) {
      return NextResponse.json({ error: 'Harmony not found' }, { status: 404 });
    }

    // Fetch pending suggestions
    const { data: suggestions, error: suggestionsError } = await supabaseAdmin
      .from('taxonomy_suggestions')
      .select('id, raw_value, suggested_canonical, confidence, created_at')
      .eq('org_id', orgId)
      .eq('harmony_id', params.harmonyId)
      .eq('status', 'pending')
      .order('confidence', { ascending: true }) // high, low, medium, unsure
      .order('created_at', { ascending: true });

    if (suggestionsError) {
      console.error('[GET /api/taxonomy/harmonies/suggestions] Error:', suggestionsError);
      return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
    }

    // Group by confidence level
    const grouped = {
      high: [] as any[],
      medium: [] as any[],
      low: [] as any[],
      unsure: [] as any[],
    };

    for (const s of suggestions || []) {
      const suggestion = {
        id: s.id,
        raw_value: s.raw_value,
        canonical_value: s.suggested_canonical,
        confidence: s.confidence as 'high' | 'medium' | 'low' | 'unsure',
        explanation: null, // Not stored in DB currently, could be added later
        created_at: s.created_at,
      };

      if (suggestion.confidence === 'high') grouped.high.push(suggestion);
      else if (suggestion.confidence === 'medium') grouped.medium.push(suggestion);
      else if (suggestion.confidence === 'low') grouped.low.push(suggestion);
      else grouped.unsure.push(suggestion);
    }

    return NextResponse.json({ suggestions: grouped });
  } catch (error) {
    console.error(`[GET /api/taxonomy/harmonies/${params.harmonyId}/suggestions] Error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}
