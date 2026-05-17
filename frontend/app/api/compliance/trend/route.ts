import { NextRequest, NextResponse } from 'next/server';
import { getTrend } from '@/lib/compliance';

/**
 * GET /api/compliance/trend
 *
 * Returns score history for the trend line.
 * Query params:
 *   - orgId: Organization ID (required)
 *   - days: Number of days to look back (default: 30)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const days = parseInt(searchParams.get('days') || '30', 10);

    if (!orgId) {
      return NextResponse.json(
        { error: 'Missing orgId parameter' },
        { status: 400 }
      );
    }

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
