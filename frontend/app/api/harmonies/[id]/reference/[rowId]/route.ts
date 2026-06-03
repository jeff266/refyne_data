import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * DELETE /api/harmonies/[id]/reference/[rowId]
 *
 * Deletes a reference data row.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; rowId: string } }
) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { rowId } = params;

    // Delete reference data row (only if org-owned)
    const { error: deleteError } = await supabase
      .from('harmony_reference_data')
      .delete()
      .eq('id', rowId)
      .eq('org_id', ctx.orgId);

    if (deleteError) {
      console.error('[Harmony Reference Delete] Failed:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete reference data' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Harmony Reference Delete] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete reference data' },
      { status: 500 }
    );
  }
}
