import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/harmonies/[id]/scan/status?jobId=xxx
 *
 * Get scan job status
 */
export async function GET(request: NextRequest, context: RouteContext) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!isSupabaseConfigured() || !supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
  }

  try {
    const { data: job, error } = await supabase
      .from('harmony_scan_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('org_id', ctx.orgId)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Scan job not found' }, { status: 404 });
    }

    return NextResponse.json({
      status: job.status,
      progress: job.progress || 0,
      totalRecords: job.total_records,
      distinctValues: job.distinct_values || [],
      errorMessage: job.error_message,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: `/api/harmonies/scan/status` });
    console.error('[Scan Status] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to get scan status' }, { status: 500 });
  }
}
