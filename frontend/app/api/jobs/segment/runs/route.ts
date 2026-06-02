/**
 * GET /api/jobs/segment/runs
 *
 * Lists all job segmentation runs for the authenticated org,
 * sorted by created_at descending (most recent first).
 *
 * Returns:
 * - runs: Array of run objects with status, counts, timestamps
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/db/admin-client';

export async function GET(req: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: runs, error } = await supabaseAdmin
      .from('job_segmentation_runs')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[JobSegmentation] Failed to fetch runs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch runs' },
        { status: 500 }
      );
    }

    return NextResponse.json({ runs });
  } catch (error) {
    console.error('[JobSegmentation] GET /api/jobs/segment/runs failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
