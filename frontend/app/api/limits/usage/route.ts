import { NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { checkProspectingCredits, getUsageSummary } from '@/lib/auth/check-credits';

/**
 * GET /api/limits/usage
 *
 * Returns current user's prospecting usage and limits.
 */
export async function GET(request: Request) {
  let ctx;
  try {
    ctx = getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || 'month') as 'day' | 'week' | 'month';

    if (!['day', 'week', 'month'].includes(period)) {
      return NextResponse.json(
        { error: 'period must be day, week, or month' },
        { status: 400 }
      );
    }

    // Get credit check (includes limit and usage)
    const creditCheck = await checkProspectingCredits(ctx.orgId, ctx.userId, ctx.orgRole);

    // Get detailed usage breakdown
    const usage = await getUsageSummary(ctx.orgId, ctx.userId, period);

    return NextResponse.json({
      unlimited: creditCheck.unlimited,
      limit: creditCheck.limit,
      used: creditCheck.used,
      remaining: creditCheck.unlimited
        ? null
        : (creditCheck.limit || 0) - (creditCheck.used || 0),
      resetAt: creditCheck.resetAt,
      period,
      breakdown: usage.byAction,
    });
  } catch (error) {
    console.error('Failed to get usage:', error);
    return NextResponse.json({ error: 'Failed to get usage' }, { status: 500 });
  }
}
