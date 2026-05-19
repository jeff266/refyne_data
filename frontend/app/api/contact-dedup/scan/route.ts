import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { enqueueContactDedupScan } from '@/lib/dedup/contact-dedup-scanner';
import { getAccessToken } from '@/lib/hubspot/get-access-token';

/**
 * POST /api/contact-dedup/scan
 *
 * Trigger a contact dedup scan for the organization.
 * Enqueues a BullMQ job to scan all contacts and detect duplicates.
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

    const orgId = ctx.orgId;
    const userId = ctx.userId;

    // Get HubSpot connection
    const { data: connection, error: connError } = await supabase
      .from('hubspot_connections')
      .select('id, portal_id')
      .eq('org_id', orgId)
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'HubSpot connection not found' },
        { status: 404 }
      );
    }

    // Get access token
    const accessToken = await getAccessToken(orgId);

    // Enqueue scan job
    const result = await enqueueContactDedupScan(
      orgId,
      accessToken,
      connection.id,
      userId
    );

    if (!result.queued) {
      return NextResponse.json(
        { error: result.reason || 'Failed to enqueue scan' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      runId: result.runId,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/contact-dedup/scan' });
    console.error('Failed to trigger contact dedup scan:', error);
    return NextResponse.json(
      { error: 'Failed to trigger scan' },
      { status: 500 }
    );
  }
}
