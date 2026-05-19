import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { revalidatePath } from 'next/cache';

/**
 * POST /api/dedup/clusters/:id/skip
 *
 * Skip a cluster (leave for later review).
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
      .select('id')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (clusterError || !cluster) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
    }

    // Update cluster status
    const { error: updateError } = await supabase
      .from('dedup_clusters')
      .update({
        status: 'skipped',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      captureWithOrgContext(updateError, ctx.orgId, {
        route: '/api/dedup/clusters/[id]/skip',
      });
      return NextResponse.json({ error: 'Failed to update cluster' }, { status: 500 });
    }

    // Invalidate cache
    revalidatePath('/dedup');

    return NextResponse.json({ success: true });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/dedup/clusters/[id]/skip' });
    console.error('Failed to skip cluster:', error);
    return NextResponse.json({ error: 'Failed to skip cluster' }, { status: 500 });
  }
}
