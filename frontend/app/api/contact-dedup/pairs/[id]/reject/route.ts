import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * POST /api/contact-dedup/pairs/:id/reject
 *
 * Reject a contact pair (mark as not a duplicate).
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

    // Verify pair exists
    const { data: existing, error: selectError } = await supabase
      .from('contact_dedup_pairs')
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
        { error: `Cannot reject pair with status: ${existing.status}` },
        { status: 400 }
      );
    }

    // Update pair to rejected
    await supabase
      .from('contact_dedup_pairs')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/contact-dedup/pairs/[id]/reject' });
    console.error('Failed to reject contact pair:', error);
    return NextResponse.json(
      { error: 'Failed to reject pair' },
      { status: 500 }
    );
  }
}
