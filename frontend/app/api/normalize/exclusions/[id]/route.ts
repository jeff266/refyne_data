import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * DELETE /api/normalize/exclusions/:id
 *
 * Delete a normalization exclusion.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Auth check
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

    const exclusionId = params.id;

    // Delete exclusion (RLS ensures org_id match)
    const { error } = await supabase
      .from('normalize_exclusions')
      .delete()
      .eq('id', exclusionId)
      .eq('org_id', ctx.orgId);

    if (error) {
      captureWithOrgContext(error, ctx.orgId, {
        route: '/api/normalize/exclusions/:id',
        exclusionId,
      });
      console.error('Failed to delete exclusion:', error);
      return NextResponse.json(
        { error: 'Failed to delete exclusion' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, {
      route: '/api/normalize/exclusions/:id',
      exclusionId: params.id,
    });
    console.error('Failed to delete exclusion:', error);
    return NextResponse.json(
      { error: 'Failed to delete exclusion' },
      { status: 500 }
    );
  }
}
