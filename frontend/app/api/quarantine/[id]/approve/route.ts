import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { getOrgContext, requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { HubSpotClient } from '@/lib/hubspot/client';

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
    ctx = await requireAdmin();
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
      captureWithOrgContext(updateError, ctx.orgId, { route: '/api/quarantine/[id]/approve' });
      console.error('Failed to approve record:', updateError);
      return NextResponse.json({ error: 'Failed to approve record' }, { status: 500 });
    }

    // Push record to HubSpot
    const accessToken = await getAccessToken(ctx.orgId);
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', ctx.orgId)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'HubSpot not connected' },
        { status: 400 }
      );
    }

    const hubspot = new HubSpotClient(accessToken, connection.portal_id);

    // Map record_data to HubSpot properties
    const recordData = record.record_data as Record<string, unknown>;
    const properties: Record<string, string | number | null> = {};

    for (const [key, value] of Object.entries(recordData)) {
      if (key !== 'id' && value !== null && value !== undefined) {
        properties[key] = String(value);
      }
    }

    const { results, errors } = await hubspot.batchCreateCompanies([{
      properties,
    }]);

    if (errors.length > 0) {
      captureWithOrgContext(
        new Error(`HubSpot push failed: ${errors[0].error}`),
        ctx.orgId,
        { route: '/api/quarantine/[id]/approve', quarantineId: id, errors }
      );
      return NextResponse.json(
        { error: 'Failed to push to HubSpot', details: errors[0].error },
        { status: 500 }
      );
    }

    const createdCompany = results[0];

    return NextResponse.json({
      message: 'Record approved and pushed to HubSpot',
      recordId: id,
      hubspotId: createdCompany.id,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/quarantine/[id]/approve' });
    console.error('Failed to approve record:', error);
    return NextResponse.json({ error: 'Failed to approve record' }, { status: 500 });
  }
}
