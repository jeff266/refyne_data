import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { createHubSpotClient } from '@/lib/hubspot/client';
import { getAccessToken } from '@/lib/hubspot/get-access-token';

/**
 * POST /api/contact-dedup/pairs/bulk-approve
 *
 * Bulk approve multiple contact pairs (max 50).
 * Calls HubSpot contacts merge API for each pair.
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const pairIds = body.pairIds as string[];

    if (!pairIds || !Array.isArray(pairIds) || pairIds.length === 0) {
      return NextResponse.json(
        { error: 'pairIds array is required' },
        { status: 400 }
      );
    }

    if (pairIds.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 pairs per bulk request' },
        { status: 400 }
      );
    }

    const orgId = ctx.orgId;
    const userId = ctx.userId;

    // Get access token
    const accessToken = await getAccessToken(orgId);
    const clientResult = await createHubSpotClient(accessToken);
    if ('error' in clientResult) {
      return NextResponse.json(
        { error: `HubSpot client error: ${clientResult.error}` },
        { status: 500 }
      );
    }
    const { client } = clientResult;

    // Fetch all pairs
    const { data: pairs, error: fetchError } = await supabase
      .from('contact_dedup_pairs')
      .select('*')
      .eq('org_id', orgId)
      .in('id', pairIds)
      .eq('status', 'pending');

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch pairs' },
        { status: 500 }
      );
    }

    if (!pairs || pairs.length === 0) {
      return NextResponse.json(
        { error: 'No pending pairs found' },
        { status: 404 }
      );
    }

    // Process each pair
    const results: Array<{ pairId: string; success: boolean; error?: string }> = [];

    for (const pair of pairs) {
      try {
        // Merge contacts in HubSpot
        await client.request('/crm/v3/objects/contacts/merge', {
          method: 'POST',
          body: JSON.stringify({
            primaryObjectId: pair.record_a_id,
            objectIdToMerge: pair.record_b_id,
          }),
        });

        // Update pair status
        await supabase
          .from('contact_dedup_pairs')
          .update({
            status: 'merged',
            surviving_record_id: pair.record_a_id,
            merged_at: new Date().toISOString(),
            merged_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pair.id);

        results.push({ pairId: pair.id, success: true });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to merge pair ${pair.id}:`, errorMsg);
        results.push({ pairId: pair.id, success: false, error: errorMsg });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failedCount === 0,
      merged: successCount,
      failed: failedCount,
      results,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/contact-dedup/pairs/bulk-approve' });
    console.error('Failed to bulk approve contact pairs:', error);
    return NextResponse.json(
      { error: 'Failed to bulk approve pairs' },
      { status: 500 }
    );
  }
}
