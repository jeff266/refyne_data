import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { createHubSpotClient } from '@/lib/hubspot/client';
import { getAccessToken } from '@/lib/hubspot/get-access-token';

/**
 * POST /api/contact-dedup/pairs/:id/approve
 *
 * Approve a single contact pair for merge.
 * Calls HubSpot contacts merge API.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Add auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  // Feature gate: dedup
  try {
    await requireFeature(ctx.orgId, 'dedup');
  } catch (error) {
    const gateError = parseFeatureGateError(error);
    if (gateError) {
      return NextResponse.json(
        { error: 'feature_gated', feature: gateError.feature, currentPlan: gateError.currentPlan },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { id } = params;
    const orgId = ctx.orgId;
    const userId = ctx.userId;

    // Verify pair exists and is pending
    const { data: existing, error: selectError } = await supabase
      .from('contact_dedup_pairs')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (selectError || !existing) {
      return NextResponse.json(
        { error: 'Pair not found' },
        { status: 404 }
      );
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot approve pair with status: ${existing.status}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const fieldSelections = body.fieldSelections || null;

    // Get access token
    const accessToken = await getAccessToken(orgId);

    // Call HubSpot contacts merge API
    // POST /crm/v3/objects/contacts/merge
    const clientResult = await createHubSpotClient(accessToken);
    if ('error' in clientResult) {
      return NextResponse.json(
        { error: `HubSpot client error: ${clientResult.error}` },
        { status: 500 }
      );
    }
    const { client } = clientResult;

    // Determine primary/secondary based on field selections or default to record_a
    const primaryObjectId = existing.record_a_id;
    const objectIdToMerge = existing.record_b_id;

    await client.request('/crm/v3/objects/contacts/merge', {
      method: 'POST',
      body: JSON.stringify({
        primaryObjectId,
        objectIdToMerge,
      }),
    });

    // Update pair status to merged
    await supabase
      .from('contact_dedup_pairs')
      .update({
        status: 'merged',
        field_selections: fieldSelections,
        surviving_record_id: primaryObjectId,
        merged_at: new Date().toISOString(),
        merged_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json({ success: true, survivingRecordId: primaryObjectId });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/contact-dedup/pairs/[id]/approve' });
    console.error('Failed to approve contact pair:', error);
    return NextResponse.json(
      { error: 'Failed to approve pair' },
      { status: 500 }
    );
  }
}
