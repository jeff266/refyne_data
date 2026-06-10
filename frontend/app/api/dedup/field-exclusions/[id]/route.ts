import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import { supabase } from '@/lib/db/supabase';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/dedup/field-exclusions/[id]
 *
 * Delete a field exclusion.
 * Auth: requireAdmin()
 * Validates belongs to org.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let ctx;
  try {
    ctx = await getOrgContext();
    requireAdmin(ctx.orgRole);
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { id } = params;

  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('dedup_field_exclusions')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Field exclusion not found' }, { status: 404 });
    }

    // Delete
    const { error: deleteError } = await supabase
      .from('dedup_field_exclusions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[Field Exclusions] Error deleting:', deleteError);
      return NextResponse.json({ error: 'Failed to delete field exclusion' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Field Exclusions] Error:', error);
    return NextResponse.json({ error: 'Failed to delete field exclusion' }, { status: 500 });
  }
}
