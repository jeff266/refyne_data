import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError, requireAdmin } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/arrangements/calibration/scores
 *
 * Returns provider calibration scores for the org
 * Auth: org:admin only
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
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

    const { searchParams } = new URL(request.url);
    const fieldKey = searchParams.get('field_key');

    let query = supabase
      .from('provider_calibration_scores')
      .select('*')
      .eq('org_id', ctx.orgId)
      .order('score', { ascending: false, nullsFirst: false });

    if (fieldKey) {
      query = query.eq('field_key', fieldKey);
    }

    const { data: scores, error } = await query;

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/calibration/scores' });
      console.error('Failed to get calibration scores:', error);
      return NextResponse.json(
        { error: 'Failed to get calibration scores' },
        { status: 500 }
      );
    }

    return NextResponse.json({ scores: scores || [] });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/calibration/scores' });
    console.error('Failed to get calibration scores:', error);
    return NextResponse.json(
      { error: 'Failed to get calibration scores' },
      { status: 500 }
    );
  }
}
