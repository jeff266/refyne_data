import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { checkFieldConflicts } from '@/lib/harmonies/conflict-detection';

/**
 * GET /api/harmonies/:id/check-conflicts
 *
 * Check if activating this harmony would conflict with other active harmonies
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const harmonyId = params.id;
    const conflicts = await checkFieldConflicts(harmonyId, ctx.orgId);

    return NextResponse.json({ conflicts });
  } catch (error) {
    console.error('[Check Conflicts API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check conflicts' },
      { status: 500 }
    );
  }
}
