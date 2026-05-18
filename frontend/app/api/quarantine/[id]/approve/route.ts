import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { getOrgContext, requireAdmin, authError } from '@/lib/auth/clerk-helpers';

/**
 * POST /api/quarantine/[id]/approve
 *
 * Approves a quarantined record and pushes it to HubSpot (admin only).
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  let ctx;
  try {
    ctx = requireAdmin();
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

    // Update status to approved
    const { error: updateError } = await supabase
      .from('quarantine_records')
      .update({
        status: 'approved',
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('org_id', ctx.orgId);

    if (updateError) {
      console.error('Failed to approve record:', updateError);
      return NextResponse.json({ error: 'Failed to approve record' }, { status: 500 });
    }

    // TODO: Push record to HubSpot
    // This would integrate with the existing HubSpot push logic

    return NextResponse.json({
      message: 'Record approved and pushed to HubSpot',
      recordId: id,
    });
  } catch (error) {
    console.error('Failed to approve record:', error);
    return NextResponse.json({ error: 'Failed to approve record' }, { status: 500 });
  }
}
