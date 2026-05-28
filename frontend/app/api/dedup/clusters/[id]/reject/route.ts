import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { rowToCluster, type DedupClusterRow } from '@/lib/dedup/cluster-types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { revalidatePath } from 'next/cache';

/**
 * POST /api/dedup/clusters/:id/reject
 *
 * Reject a cluster (mark as not duplicates).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Feature gate: dedup
  try {
    await requireFeature(ctx.orgId, 'dedup');
  } catch (error) {
    const gateError = parseFeatureGateError(error);
    if (gateError) {
      return NextResponse.json(
        { error: 'feature_gated', feature: gateError.feature, currentPlan: gateError.currentPlan },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { id } = params;
    const orgId = ctx.orgId;

    // Get cluster
    const { data: cluster, error: clusterError } = await supabase
      .from('dedup_clusters')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (clusterError || !cluster) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
    }

    const clusterData = rowToCluster(cluster as DedupClusterRow);

    // Fetch signals for decision logging
    const { data: topPair } = await supabase
      .from('dedup_pairs')
      .select('signals_fired')
      .eq('cluster_id', id)
      .order('confidence', { ascending: false })
      .limit(1)
      .single();

    // Update cluster status
    const { error: updateError } = await supabase
      .from('dedup_clusters')
      .update({
        status: 'rejected',
        resolved_by: ctx.userId,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      captureWithOrgContext(updateError, ctx.orgId, {
        route: '/api/dedup/clusters/[id]/reject',
      });
      return NextResponse.json({ error: 'Failed to update cluster' }, { status: 500 });
    }

    // Update all pairs in cluster
    const { error: pairsError } = await supabase
      .from('dedup_pairs')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .in('id', clusterData.pairIds);

    if (pairsError) {
      console.error('[Reject Cluster] Failed to update pairs:', pairsError);
    }

    // Log decision for learning
    try {
      await supabase.from('dedup_decisions').insert({
        org_id: orgId,
        cluster_id: id,
        decision: 'rejected',
        signal_scores: topPair?.signals_fired || {},
        cluster_grade: clusterData.grade,
        decided_by: ctx.userId,
      });
    } catch (decErr) {
      console.error('[Reject Cluster] Failed to log decision:', decErr);
      // Don't fail rejection if decision logging fails
    }

    // Invalidate cache
    revalidatePath('/dedup');

    return NextResponse.json({ success: true });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/dedup/clusters/[id]/reject' });
    console.error('Failed to reject cluster:', error);
    return NextResponse.json({ error: 'Failed to reject cluster' }, { status: 500 });
  }
}
