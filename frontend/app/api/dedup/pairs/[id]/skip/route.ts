import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { rowToPair, type DedupPairRow } from '@/lib/dedup/types';

/**
 * POST /api/dedup/pairs/:id/skip
 *
 * Skip a pair (keep pending but move to bottom of queue).
 * Editor or admin role required.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { id } = params;
    const orgId = request.headers.get('x-org-id') || 'default';
    // TODO: Check editor or admin role

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

    // Skip doesn't change status, just updates detected_at to now
    // This moves it to the bottom of the queue when sorted by detected_at
    const { data: updated, error: updateError } = await supabase
      .from('dedup_pairs')
      .update({
        detected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to skip pair:', updateError);
      return NextResponse.json(
        { error: 'Failed to skip pair' },
        { status: 500 }
      );
    }

    return NextResponse.json({ pair: rowToPair(updated as DedupPairRow) });
  } catch (error) {
    console.error('Failed to skip pair:', error);
    return NextResponse.json(
      { error: 'Failed to skip pair' },
      { status: 500 }
    );
  }
}
