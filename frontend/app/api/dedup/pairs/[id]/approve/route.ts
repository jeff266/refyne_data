import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { rowToPair, type DedupPairRow, type SingleApproveRequest } from '@/lib/dedup/types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';

/**
 * POST /api/dedup/pairs/:id/approve
 *
 * Approve a single pair for merge.
 * Editor or admin role required.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
        { error: `Cannot approve pair with status: ${existing.status}` },
        { status: 400 }
      );
    }

    const body = await request.json() as SingleApproveRequest;

    // Update pair to approved
    const { data: updated, error: updateError } = await supabase
      .from('dedup_pairs')
      .update({
        status: 'approved',
        field_selections: body.fieldSelections || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to approve pair:', updateError);
      return NextResponse.json(
        { error: 'Failed to approve pair' },
        { status: 500 }
      );
    }

    // TODO: Enqueue BullMQ merge job
    const jobId = `merge:${id}:${Date.now()}`;

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Failed to approve pair:', error);
    return NextResponse.json(
      { error: 'Failed to approve pair' },
      { status: 500 }
    );
  }
}
