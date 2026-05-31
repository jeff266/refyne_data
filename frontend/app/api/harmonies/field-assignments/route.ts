/**
 * GET /api/harmonies/field-assignments
 *
 * Returns field assignments for the current org, merging global defaults
 * with org-specific overrides.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getFieldAssignments } from '@/lib/harmonies/field-assignments';

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
    const objectType = searchParams.get('objectType') || 'company';

    if (!['company', 'contact', 'deal'].includes(objectType)) {
      return NextResponse.json(
        { error: 'Invalid objectType. Must be company, contact, or deal' },
        { status: 400 }
      );
    }

    const assignments = await getFieldAssignments(
      ctx.orgId,
      objectType as 'company' | 'contact' | 'deal'
    );

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error('[Field Assignments API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch field assignments' },
      { status: 500 }
    );
  }
}
