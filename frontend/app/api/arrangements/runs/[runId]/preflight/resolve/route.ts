import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * POST /api/arrangements/runs/:runId/preflight/resolve
 *
 * Marks preflight issues as resolved.
 * Auth: org:operator or above
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
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

    const body = await request.json();

    if (!body.issueIds || !Array.isArray(body.issueIds)) {
      return NextResponse.json(
        { error: 'Missing issueIds array' },
        { status: 400 }
      );
    }

    // Resolve preflight issues
    const { error } = await supabase
      .from('arrangement_preflight')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: ctx.userId,
        resolution_note: body.note || null,
      })
      .in('id', body.issueIds)
      .eq('org_id', ctx.orgId);

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/runs/:runId/preflight/resolve' });
      return NextResponse.json(
        { error: 'Failed to resolve issues' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/runs/:runId/preflight/resolve' });
    console.error('Failed to resolve preflight issues:', error);
    return NextResponse.json(
      { error: 'Failed to resolve issues' },
      { status: 500 }
    );
  }
}
