import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { getOrgContext, requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * POST /api/quarantine/[id]/reject
 *
 * Rejects a quarantined record (admin only).
 */
export async function POST(
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
    const body = await request.json();
    const { note } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Get the quarantine record
    const { data: record, error: fetchError } = await supabase
      .from('quarantine_records')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single();

    if (fetchError || !record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    if (record.status !== 'pending') {
      return NextResponse.json(
        { error: `Record already ${record.status}` },
        { status: 400 }
      );
    }

    // Update status to rejected
    const { error: updateError } = await supabase
      .from('quarantine_records')
      .update({
        status: 'rejected',
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
        rejection_note: note || null,
      })
      .eq('id', id)
      .eq('org_id', ctx.orgId);

    if (updateError) {
      captureWithOrgContext(updateError, ctx.orgId, { route: '/api/quarantine/[id]/reject' });
      console.error('Failed to reject record:', updateError);
      return NextResponse.json({ error: 'Failed to reject record' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Record rejected',
      recordId: id,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/quarantine/[id]/reject' });
    console.error('Failed to reject record:', error);
    return NextResponse.json({ error: 'Failed to reject record' }, { status: 500 });
  }
}
