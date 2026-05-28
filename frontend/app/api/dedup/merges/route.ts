import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * GET /api/dedup/merges
 *
 * List recent merge operations for the org.
 * Used for the merge history tab to show audit trail and enable rollback.
 */
export async function GET(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    const page = parseInt(searchParams.get('page') ?? '1');
    const offset = (page - 1) * limit;

    const { data, count } = await supabase
      .from('dedup_merge_history')
      .select('*', { count: 'exact' })
      .eq('org_id', ctx.orgId)
      .order('merged_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return NextResponse.json({
      merges: data ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('[Merge History] Error fetching merges:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch merge history',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
