import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getFieldAssignments } from '@/lib/harmonies/field-assignments';

/**
 * GET /api/normalize/field-assignments
 *
 * Returns field assignments for the current org and object type.
 * Used to display "writes to: [field]" labels under harmony toggles.
 *
 * Query params:
 *   - objectType: 'company' | 'contact' (default: 'company')
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
    const { searchParams } = new URL(request.url);
    const objectType = (searchParams.get('objectType') ?? 'company') as 'company' | 'contact' | 'deal';

    // Fetch field assignments
    const assignments = await getFieldAssignments(ctx.orgId, objectType);

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error('[Field Assignments API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch field assignments',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
