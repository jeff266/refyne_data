import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { enqueueCompanyDedupScan } from '@/lib/dedup/company-dedup-scanner';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * POST /api/dedup/scan
 *
 * Enqueues a company dedup scan job.
 */
export async function POST(request: NextRequest) {
  // Add auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

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
    // Parse request body for optional forceFullScan parameter
    let forceFullScan = false;
    try {
      const body = await request.json();
      forceFullScan = body.forceFullScan === true;
    } catch {
      // No body or invalid JSON - use default
    }

    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Get active HubSpot connection
    const { data: connections } = await supabase
      .from('hubspot_connections')
      .select('id, portal_id')
      .eq('org_id', ctx.orgId)
      .eq('connection_status', 'active')
      .limit(1);

    if (!connections || connections.length === 0) {
      return NextResponse.json(
        { error: 'No active HubSpot connection found' },
        { status: 400 }
      );
    }

    const connection = connections[0];

    // Get access token
    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Failed to get HubSpot access token' },
        { status: 500 }
      );
    }

    // Enqueue scan job
    const result = await enqueueCompanyDedupScan(
      ctx.orgId,
      accessToken,
      connection.id,
      ctx.userId,
      forceFullScan
    );

    if (!result.queued) {
      return NextResponse.json(
        { error: result.reason || 'Failed to enqueue scan' },
        { status: 500 }
      );
    }

    console.log(`[Dedup Scan API] Enqueued company dedup scan: jobId=${result.jobId}, forceFullScan=${forceFullScan}`);

    return NextResponse.json({
      queued: true,
      jobId: result.jobId,
      portalId: connection.portal_id,
      scanType: forceFullScan ? 'full' : 'auto',
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/dedup/scan' });
    console.error('Failed to enqueue dedup scan:', error);
    return NextResponse.json(
      { error: 'Failed to enqueue scan' },
      { status: 500 }
    );
  }
}
