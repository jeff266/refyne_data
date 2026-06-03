/**
 * PATCH /api/taxonomy/suggestions/[suggestionId]/reject
 *
 * Rejects a suggestion.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { rejectSuggestion } from '@/lib/harmonies/taxonomy-suggester';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { suggestionId: string } }
) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const userId = ctx.userId;

    await rejectSuggestion(params.suggestionId, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[PATCH /api/taxonomy/suggestions/${params.suggestionId}/reject] Error:`, error);
    return NextResponse.json(
      { error: 'Failed to reject suggestion' },
      { status: 500 }
    );
  }
}
