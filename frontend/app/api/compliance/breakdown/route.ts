import { NextRequest, NextResponse } from 'next/server';
import { getBreakdownByHarmony, getBreakdownByField } from '@/lib/compliance';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';


/**
 * GET /api/compliance/breakdown
 *
 * Returns per-Harmony or per-field breakdown table data.
 * Query params:
 *   - by: 'harmony' | 'field' (default: 'harmony')
 */
export async function GET(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }
  // Feature gate: compliance
  try {
    await requireFeature(ctx.orgId, 'compliance');
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
    const { searchParams } = new URL(request.url);
    const orgId = ctx.orgId;
    const by = searchParams.get('by') || 'harmony';

    if (by !== 'harmony' && by !== 'field') {
      return NextResponse.json(
        { error: 'Invalid "by" parameter. Must be "harmony" or "field"' },
        { status: 400 }
      );
    }

    const items = by === 'harmony'
      ? await getBreakdownByHarmony(orgId)
      : await getBreakdownByField(orgId);

    return NextResponse.json({
      by,
      items,
    });
  } catch (error) {
    console.error('Failed to get compliance breakdown:', error);
    return NextResponse.json(
      { error: 'Failed to get compliance breakdown' },
      { status: 500 }
    );
  }
}
