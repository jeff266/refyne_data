import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * POST /api/dedup/clusters/[id]/exclude-record
 *
 * Exclude a record from a cluster merge:
 * - Mark all pairs involving this record (within cluster) as rejected
 * - Remove record from cluster's record_ids array
 * - If only 1 record remains, auto-reject the entire cluster
 *
 * Body: { recordId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!isSupabaseConfigured() || !supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { recordId } = body;

    if (!recordId) {
      return NextResponse.json({ error: 'recordId is required' }, { status: 400 });
    }

    const clusterId = params.id;

    // Get cluster
    const { data: cluster, error: clusterError } = await supabase
      .from('dedup_clusters')
      .select('*')
      .eq('id', clusterId)
      .eq('org_id', ctx.orgId)
      .single();

    if (clusterError || !cluster) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
    }

    // Check if record is in cluster
    if (!cluster.record_ids.includes(recordId)) {
      return NextResponse.json({ error: 'Record not in cluster' }, { status: 400 });
    }

    // Remove record from cluster
    const newRecordIds = cluster.record_ids.filter((id: string) => id !== recordId);

    // If only 1 record remains, reject the entire cluster
    if (newRecordIds.length === 1) {
      const { error: rejectError } = await supabase
        .from('dedup_clusters')
        .update({
          status: 'rejected',
          record_ids: newRecordIds,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clusterId);

      if (rejectError) {
        throw new Error(`Failed to reject cluster: ${rejectError.message}`);
      }

      // Mark all pairs in cluster as rejected
      const { error: pairsError } = await supabase
        .from('dedup_pairs')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('cluster_id', clusterId);

      if (pairsError) {
        console.error('[exclude-record] Failed to reject pairs:', pairsError);
      }

      return NextResponse.json({
        success: true,
        clusterRejected: true,
        message: 'Cluster auto-rejected (only 1 record remaining)',
      });
    }

    // Update cluster to remove excluded record
    const { error: updateError } = await supabase
      .from('dedup_clusters')
      .update({
        record_ids: newRecordIds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clusterId);

    if (updateError) {
      throw new Error(`Failed to update cluster: ${updateError.message}`);
    }

    // Mark pairs involving excluded record as rejected
    // Get all pair IDs for this cluster
    const { data: pairs, error: pairsError } = await supabase
      .from('dedup_pairs')
      .select('id, record_a_id, record_b_id')
      .eq('cluster_id', clusterId);

    if (pairsError) {
      console.error('[exclude-record] Failed to fetch pairs:', pairsError);
    } else if (pairs) {
      // Find pairs involving the excluded record
      const pairIdsToReject = pairs
        .filter((p) => p.record_a_id === recordId || p.record_b_id === recordId)
        .map((p) => p.id);

      if (pairIdsToReject.length > 0) {
        const { error: rejectPairsError } = await supabase
          .from('dedup_pairs')
          .update({
            status: 'rejected',
            updated_at: new Date().toISOString(),
          })
          .in('id', pairIdsToReject);

        if (rejectPairsError) {
          console.error('[exclude-record] Failed to reject pairs:', rejectPairsError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      clusterRejected: false,
      remainingRecords: newRecordIds.length,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, {
      route: `/api/dedup/clusters/${params.id}/exclude-record`,
    });
    console.error('[exclude-record] Error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to exclude record' },
      { status: 500 }
    );
  }
}
