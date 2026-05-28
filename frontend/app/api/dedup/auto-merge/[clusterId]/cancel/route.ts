import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * POST /api/dedup/auto-merge/[clusterId]/cancel
 *
 * Cancels a scheduled auto-merge for a cluster.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { clusterId: string } }
) {
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

    const { clusterId } = params;

    // Verify cluster exists and is pending auto-merge
    const { data: cluster, error: fetchError } = await supabase
      .from('dedup_clusters')
      .select('id, auto_merge_scheduled_at')
      .eq('id', clusterId)
      .eq('org_id', ctx.orgId)
      .eq('status', 'pending')
      .is('auto_merge_cancelled_at', null)
      .single();

    if (fetchError || !cluster) {
      return NextResponse.json({ error: 'Cluster not found or not scheduled for auto-merge' }, { status: 404 });
    }

    // Cancel the auto-merge
    const { error: updateError } = await supabase
      .from('dedup_clusters')
      .update({
        auto_merge_cancelled_at: new Date().toISOString(),
        auto_merge_cancelled_by: ctx.userId,
      })
      .eq('id', clusterId)
      .eq('org_id', ctx.orgId);

    if (updateError) {
      console.error('[Cancel Auto-merge] Failed to cancel:', updateError);
      return NextResponse.json({ error: 'Failed to cancel auto-merge' }, { status: 500 });
    }

    console.log(`[Cancel Auto-merge] Cancelled cluster ${clusterId} by user ${ctx.userId}`);

    return NextResponse.json({
      success: true,
      message: 'Auto-merge cancelled successfully',
    });
  } catch (error) {
    console.error('[Cancel Auto-merge] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to cancel auto-merge',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
