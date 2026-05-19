import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { rowToPair, type DedupPairRow } from '@/lib/dedup/types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

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
      captureWithOrgContext(updateError, ctx.orgId, { route: '/api/dedup/pairs/[id]/skip' });
      console.error('Failed to skip pair:', updateError);
      return NextResponse.json(
        { error: 'Failed to skip pair' },
        { status: 500 }
      );
    }

    return NextResponse.json({ pair: rowToPair(updated as DedupPairRow) });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/dedup/pairs/[id]/skip' });
    console.error('Failed to skip pair:', error);
    return NextResponse.json(
      { error: 'Failed to skip pair' },
      { status: 500 }
    );
  }
}
