/**
 * PATCH /api/taxonomy/suggestions/[suggestionId]/accept
 *
 * Accepts a suggestion and adds it to harmony_reference_data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/org-context';
import { acceptSuggestion } from '@/lib/harmonies/taxonomy-suggester';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { suggestionId: string } }
) {
  try {
    const { orgId, userId } = await getOrgContext(req);
    if (!orgId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { canonicalValue, harmonyId, rawValue } = body;

    if (!canonicalValue || !harmonyId || !rawValue) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await acceptSuggestion(
      params.suggestionId,
      orgId,
      harmonyId,
      rawValue,
      canonicalValue,
      userId
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[PATCH /api/taxonomy/suggestions/${params.suggestionId}/accept] Error:`, error);
    return NextResponse.json(
      { error: 'Failed to accept suggestion' },
      { status: 500 }
    );
  }
}
