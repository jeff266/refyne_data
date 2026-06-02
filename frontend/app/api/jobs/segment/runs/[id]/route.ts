/**
 * GET /api/jobs/segment/runs/[id]
 *
 * Fetches a specific job segmentation run by ID.
 * Verifies that the run belongs to the authenticated org.
 *
 * Returns:
 * - run: Run object with full details
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/db/admin-client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data: run, error } = await supabaseAdmin
      .from('job_segmentation_runs')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json({ run });
  } catch (error) {
    console.error('[JobSegmentation] GET /api/jobs/segment/runs/[id] failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
