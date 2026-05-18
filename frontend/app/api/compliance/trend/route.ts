import { NextRequest, NextResponse } from 'next/server';
import { getTrend } from '@/lib/compliance';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * GET /api/compliance/trend
 *
 * Returns score history for the trend line.
 * Query params:
 *   - days: Number of days to look back (default: 30)
 */
export async function GET(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  try {
    const { searchParams } = new URL(request.url);
    const orgId = ctx.orgId;
    const days = parseInt(searchParams.get('days') || '30', 10);

    if (days < 1 || days > 365) {
      return NextResponse.json(
        { error: 'Days must be between 1 and 365' },
        { status: 400 }
      );
    }

    const trend = await getTrend(orgId, days);

    return NextResponse.json({ trend });
  } catch (error) {
    console.error('Failed to get compliance trend:', error);
    return NextResponse.json(
      { error: 'Failed to get compliance trend' },
      { status: 500 }
    );
  }
}
