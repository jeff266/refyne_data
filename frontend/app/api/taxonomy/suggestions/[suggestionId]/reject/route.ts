/**
 * PATCH /api/taxonomy/suggestions/[suggestionId]/reject
 *
 * Rejects a suggestion.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/org-context';
import { rejectSuggestion } from '@/lib/harmonies/taxonomy-suggester';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { suggestionId: string } }
) {
  try {
    const { userId } = await getOrgContext(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
