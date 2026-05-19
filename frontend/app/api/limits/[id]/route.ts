import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { getOrgContext, requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * DELETE /api/limits/[id]
 *
 * Deletes a prospecting limit (admin only).
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('prospecting_limits')
      .delete()
      .eq('id', id)
      .eq('org_id', ctx.orgId);

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/limits/[id]' });
      console.error('Failed to delete limit:', error);
      return NextResponse.json({ error: 'Failed to delete limit' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Limit deleted successfully' });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/limits/[id]' });
    console.error('Failed to delete limit:', error);
    return NextResponse.json({ error: 'Failed to delete limit' }, { status: 500 });
  }
}
