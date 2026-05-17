import { NextRequest, NextResponse } from 'next/server';
import { getActiveInsights, dismissInsight } from '@/lib/compliance';

/**
 * GET /api/compliance/insights
 *
 * Returns active (non-dismissed) insight cards for the organization.
 * Query params:
 *   - orgId: Organization ID (required)
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
