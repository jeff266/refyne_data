/**
 * Saved Search by ID API
 *
 * DELETE /api/prospect/saved-searches/[id] - Delete a saved search
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { id } = params;

    // Delete saved search (only if user owns it or it's workspace-scoped)
    const { error } = await supabase
      .from('prospect_saved_searches')
      .delete()
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .or(`created_by.eq.${ctx.userId},scope.eq.workspace`);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[Saved Searches] DELETE error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete saved search',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
