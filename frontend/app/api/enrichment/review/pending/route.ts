import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/enrichment/review/pending
 *
 * Returns any pending review sessions for this org.
 * Used by Enrich page on mount to check for pending reviews.
 */
export async function GET(request: NextRequest) {
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

    const { data: sessions, error } = await supabase
      .from('enrichment_review_sessions')
      .select('*, arrangement_runs!inner(arrangement_id, config)')
      .eq('org_id', ctx.orgId)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[PendingReview API] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch pending reviews' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessions: sessions || [],
    });
  } catch (error) {
    console.error('[PendingReview API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending reviews' },
      { status: 500 }
    );
  }
}
