import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/harmonies/[id]/scan/status
 *
 * Poll scan job status with inline timeout check
 */
export async function GET(request: NextRequest, context: RouteContext) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  try {
    // Fetch scan job
    const { data: job, error: jobError } = await supabase
      .from('harmony_scan_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('org_id', ctx.orgId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Scan job not found' }, { status: 404 });
    }

    // Inline timeout check: if job has been pending/scanning for >10 minutes, mark as failed
    if (['pending', 'scanning'].includes(job.status)) {
      const ageMinutes = (Date.now() - new Date(job.created_at).getTime()) / 60000;

      if (ageMinutes > 10) {
        console.warn(\`[Scan Status] Job \${jobId} timed out after \${ageMinutes.toFixed(1)} minutes\`);

        await supabase
          .from('harmony_scan_jobs')
          .update({
            status: 'failed',
            error_message: 'Scan timed out. Please try again.',
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        return NextResponse.json({
          status: 'failed',
          error: 'Scan timed out. Please try again.',
          progress: job.progress || 0,
        });
      }
    }

    // Return current job status
    return NextResponse.json({
      status: job.status,
      progress: job.progress || 0,
      totalRecords: job.total_records || 0,
      distinctValues: job.distinct_values || [],
      error: job.error_message || null,
    });
  } catch (error: any) {
    console.error('[Scan Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check scan status' },
      { status: 500 }
    );
  }
}
