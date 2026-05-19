import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import {
  rowToCluster,
  type DedupClusterRow,
  type ClustersListResponse,
  type ClustersCounts,
} from '@/lib/dedup/cluster-types';
import type { PairGrade } from '@/lib/dedup/types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * GET /api/dedup/clusters
 *
 * Returns list of dedup clusters with filtering and pagination.
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const orgId = ctx.orgId;

    // Parse query params
    const grade = searchParams.get('grade') || 'all';
    const status = searchParams.get('status') || 'pending';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(200, Math.max(1, parseInt(searchParams.get('per_page') || '50', 10)));

    // Build base query
    let query = supabase
      .from('dedup_clusters')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId);

    // Apply grade filter
    if (grade !== 'all') {
      query = query.eq('grade', grade);
    }

    // Apply status filter
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    // Order by grade (A first), then created_at
    query = query.order('grade', { ascending: true }).order('created_at', { ascending: false });

    // Apply pagination
    const offset = (page - 1) * perPage;
    query = query.range(offset, offset + perPage - 1);

    const { data: clusters, count, error } = await query;

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/dedup/clusters' });
      console.error('Failed to get dedup clusters:', error);
      return NextResponse.json({ error: 'Failed to get clusters' }, { status: 500 });
    }

    // Get counts for sidebar
    const [gradeCountsResult, statusCountsResult] = await Promise.all([
      supabase.from('dedup_clusters').select('grade').eq('org_id', orgId),
      supabase.from('dedup_clusters').select('status').eq('org_id', orgId),
    ]);

    // Aggregate counts
    const byGrade: Record<PairGrade, number> = { A: 0, B: 0, C: 0, D: 0 };
    const byStatus = { pending: 0, merged: 0, rejected: 0, skipped: 0 };

    if (gradeCountsResult.data) {
      for (const row of gradeCountsResult.data) {
        if (row.grade in byGrade) {
          byGrade[row.grade as PairGrade]++;
        }
      }
    }

    if (statusCountsResult.data) {
      for (const row of statusCountsResult.data) {
        if (row.status in byStatus) {
          byStatus[row.status as keyof typeof byStatus]++;
        }
      }
    }

    const response: ClustersListResponse = {
      clusters: (clusters as DedupClusterRow[]).map(rowToCluster),
      total: count || 0,
      counts: { byGrade, byStatus } as ClustersCounts,
    };

    return NextResponse.json(response);
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/dedup/clusters' });
    console.error('Failed to get dedup clusters:', error);
    return NextResponse.json({ error: 'Failed to get clusters' }, { status: 500 });
  }
}
