import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { enqueuePreflightJob } from '@/lib/queue/arrangement-queue';

/**
 * POST /api/arrangements/:id/preflight
 *
 * Runs preflight checks for an arrangement.
 * Auth: org:operator or above
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Get arrangement
    const { data: arrangement, error } = await supabase
      .from('arrangements')
      .select('*')
      .eq('id', params.id)
      .eq('org_id', ctx.orgId)
      .single();

    if (error || !arrangement) {
      return NextResponse.json(
        { error: 'Arrangement not found' },
        { status: 404 }
      );
    }

    // Enqueue preflight job
    const result = await enqueuePreflightJob({
      arrangementId: arrangement.id,
      orgId: ctx.orgId,
      config: arrangement,
    });

    if (!result.queued) {
      return NextResponse.json(
        { error: result.reason || 'Failed to queue preflight check' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      message: 'Preflight check queued',
    });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/:id/preflight' });
    console.error('Failed to run preflight:', error);
    return NextResponse.json(
      { error: 'Failed to run preflight' },
      { status: 500 }
    );
  }
}
