import { NextRequest, NextResponse } from 'next/server';
import { getScore, getPreviousScore } from '@/lib/compliance';

/**
 * GET /api/compliance/score
 *
 * Returns overall compliance score, counts, and trend delta.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Missing orgId parameter' },
        { status: 400 }
      );
    }

    const score = await getScore(orgId);
    const previousScore = await getPreviousScore(orgId);

    const trendDelta = previousScore !== null
      ? Math.round((score.score - previousScore) * 100) / 100
      : null;

    return NextResponse.json({
      score: score.score,
      compliant: score.compliant,
      stale: score.stale,
      unprocessed: score.unprocessed,
      total: score.total,
      lastComputedAt: score.lastComputedAt,
      trendDelta,
    });
  } catch (error) {
    console.error('Failed to get compliance score:', error);
    return NextResponse.json(
      { error: 'Failed to get compliance score' },
      { status: 500 }
    );
  }
}
