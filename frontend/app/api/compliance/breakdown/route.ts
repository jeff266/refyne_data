import { NextRequest, NextResponse } from 'next/server';
import { getBreakdownByHarmony, getBreakdownByField } from '@/lib/compliance';

/**
 * GET /api/compliance/breakdown
 *
 * Returns per-Harmony or per-field breakdown table data.
 * Query params:
 *   - orgId: Organization ID (required)
 *   - by: 'harmony' | 'field' (default: 'harmony')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const by = searchParams.get('by') || 'harmony';

    if (!orgId) {
      return NextResponse.json(
        { error: 'Missing orgId parameter' },
        { status: 400 }
      );
    }

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
