import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import type { BulkRejectRequest, BulkRejectResponse } from '@/lib/dedup/types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * POST /api/dedup/pairs/bulk-reject
 *
 * Reject multiple pairs (mark as not duplicates).
 * Editor or admin role required.
 */
export async function POST(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

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
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const orgId = ctx.orgId;

    const body = await request.json() as BulkRejectRequest;

    // Validate request
    if (!Array.isArray(body.pairIds) || body.pairIds.length === 0) {
      return NextResponse.json(
        { error: 'pairIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (body.pairIds.length > 200) {
      return NextResponse.json(
        { error: 'Maximum 200 pairs per request' },
        { status: 400 }
      );
    }

    // Verify all pairs exist, belong to org, and are pending
    const { data: pairs, error: selectError } = await supabase
      .from('dedup_pairs')
      .select('id, status')
      .eq('org_id', orgId)
      .in('id', body.pairIds);

    if (selectError) {
      captureWithOrgContext(selectError, ctx.orgId, { route: '/api/dedup/pairs/bulk-reject' });
      console.error('Failed to validate pairs:', selectError);
      return NextResponse.json(
        { error: 'Failed to validate pairs' },
        { status: 500 }
      );
    }

    // Check for invalid IDs
    const foundIds = new Set(pairs?.map((p) => p.id) || []);
    const invalidIds = body.pairIds.filter((id) => !foundIds.has(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: 'Some pair IDs not found', invalidIds },
        { status: 400 }
      );
    }

    // Check for non-pending pairs
    const nonPendingIds = pairs?.filter((p) => p.status !== 'pending').map((p) => p.id) || [];
    if (nonPendingIds.length > 0) {
      return NextResponse.json(
        { error: 'Some pairs are not pending', invalidIds: nonPendingIds },
        { status: 400 }
      );
    }

    // Update all pairs to rejected
    const { error: updateError } = await supabase
      .from('dedup_pairs')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .in('id', body.pairIds);

    if (updateError) {
      captureWithOrgContext(updateError, ctx.orgId, { route: '/api/dedup/pairs/bulk-reject' });
      console.error('Failed to reject pairs:', updateError);
      return NextResponse.json(
        { error: 'Failed to reject pairs' },
        { status: 500 }
      );
    }

    const response: BulkRejectResponse = {
      rejected: body.pairIds.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/dedup/pairs/bulk-reject' });
    console.error('Failed to bulk reject pairs:', error);
    return NextResponse.json(
      { error: 'Failed to bulk reject pairs' },
      { status: 500 }
    );
  }
}
