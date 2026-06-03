/**
 * GET /api/taxonomy/suggestions/[harmonyId]
 *
 * Returns taxonomy_suggestions for this harmony, grouped by confidence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/org-context';
import { supabaseAdmin } from '@/lib/db/admin-client';

export async function GET(
  req: NextRequest,
  { params }: { params: { harmonyId: string } }
) {
  try {
    const { orgId } = await getOrgContext(req);
    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending';

    const { data: suggestions, error } = await supabaseAdmin
      .from('taxonomy_suggestions')
      .select('*')
      .eq('org_id', orgId)
      .eq('harmony_id', params.harmonyId)
      .eq('status', status)
      .order('confidence', { ascending: false })
      .order('raw_value');

    if (error) throw error;

    // Group by confidence
    const grouped = {
      high: suggestions?.filter((s) => s.confidence === 'high') || [],
      medium: suggestions?.filter((s) => s.confidence === 'medium') || [],
      low: suggestions?.filter((s) => s.confidence === 'low') || [],
      unsure: suggestions?.filter((s) => s.confidence === 'unsure') || [],
    };

    return NextResponse.json({ suggestions: grouped });
  } catch (error) {
    console.error(`[GET /api/taxonomy/suggestions/${params.harmonyId}] Error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}
