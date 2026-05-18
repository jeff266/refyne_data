import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { rowToPair, type DedupPairRow } from '@/lib/dedup/types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * POST /api/dedup/pairs/:id/reject
 *
 * Reject a pair (mark as not a duplicate).
 * Editor or admin role required.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Add auth check
  let ctx;
  try { ctx = getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { id } = params;
    const orgId = ctx.orgId;

    // Verify pair exists and is pending
    const { data: existing, error: selectError } = await supabase
      .from('dedup_pairs')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (selectError || !existing) {
      return NextResponse.json(
        { error: 'Pair not found' },
        { status: 404 }
      );
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot reject pair with status: ${existing.status}` },
        { status: 400 }
      );
    }

    // Update pair to rejected
    const { data: updated, error: updateError } = await supabase
      .from('dedup_pairs')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to reject pair:', updateError);
      return NextResponse.json(
        { error: 'Failed to reject pair' },
        { status: 500 }
      );
    }

    return NextResponse.json({ pair: rowToPair(updated as DedupPairRow) });
  } catch (error) {
    console.error('Failed to reject pair:', error);
    return NextResponse.json(
      { error: 'Failed to reject pair' },
      { status: 500 }
    );
  }
}
