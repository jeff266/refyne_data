import { NextRequest, NextResponse } from 'next/server';
import { getActiveInsights, dismissInsight } from '@/lib/compliance';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';


/**
 * GET /api/compliance/insights
 *
 * Returns active (non-dismissed) insight cards for the organization.
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
    const orgId = ctx.orgId;

    const insights = await getActiveInsights(orgId);

    return NextResponse.json({ insights });
  } catch (error) {
    console.error('Failed to get compliance insights:', error);
    return NextResponse.json(
      { error: 'Failed to get compliance insights' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/compliance/insights
 *
 * Dismiss an insight.
 * Body: { insightId: string }
 */
export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const { insightId, action } = body;

    if (!insightId) {
      return NextResponse.json(
        { error: 'Missing insightId in request body' },
        { status: 400 }
      );
    }

    if (action !== 'dismiss') {
      return NextResponse.json(
        { error: 'Invalid action. Only "dismiss" is supported.' },
        { status: 400 }
      );
    }

    await dismissInsight(insightId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to dismiss insight:', error);
    return NextResponse.json(
      { error: 'Failed to dismiss insight' },
      { status: 500 }
    );
  }
}
