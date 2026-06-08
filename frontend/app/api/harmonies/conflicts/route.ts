import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getAllFieldConflicts } from '@/lib/harmonies/conflict-detection';

/**
 * GET /api/harmonies/conflicts
 *
 * Get all field conflicts for the current org
 * Returns a map of harmonyId -> array of conflicts
 */
export async function GET(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const conflictsMap = await getAllFieldConflicts(ctx.orgId);

    // Convert Map to plain object for JSON serialization
    const conflicts: Record<string, any[]> = {};
    conflictsMap.forEach((value, key) => {
      conflicts[key] = value;
    });

    return NextResponse.json({ conflicts });
  } catch (error) {
    console.error('[Conflicts API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conflicts' },
      { status: 500 }
    );
  }
}
