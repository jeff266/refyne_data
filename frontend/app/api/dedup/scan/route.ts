import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
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
    // Parse request body for optional forceFullScan and objectType parameters
    let forceFullScan = false;
    let objectType: 'company' | 'contact' | 'deal' = 'company';
    try {
      const body = await request.json();
      console.log(`[Dedup Scan API] Raw body received: ${JSON.stringify(body)}`);
      forceFullScan = body.forceFullScan === true;
      objectType = body.objectType || 'company';
      console.log(`[Dedup Scan API] Parsed: forceFullScan=${forceFullScan}, objectType=${objectType}`);
    } catch {
      // No body or invalid JSON - use defaults
    }

    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Auto-detect first scan: always do full scan if no scans have ever run
    const { count } = await supabase
      .from('dedup_scan_runs')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', ctx.orgId);

    const isFirstScan = count === 0;
    const shouldForceFullScan = forceFullScan || isFirstScan;

    if (isFirstScan) {
      console.log(`[Dedup Scan API] First scan for org ${ctx.orgId}, forcing full scan`);
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

    // Enqueue scan job (access token will be fetched fresh inside worker)
    const result = await enqueueCompanyDedupScan(
      ctx.orgId,
      connection.id,
      ctx.userId,
      shouldForceFullScan,
      objectType
    );

    if (!result.queued) {
      return NextResponse.json(
        { error: result.reason || 'Failed to enqueue scan' },
        { status: 500 }
      );
    }

    console.log(`[Dedup Scan API] Enqueued company dedup scan: jobId=${result.jobId}, forceFullScan=${shouldForceFullScan}, isFirstScan=${isFirstScan}`);

    return NextResponse.json({
      queued: true,
      jobId: result.jobId,
      portalId: connection.portal_id,
      scanType: shouldForceFullScan ? 'full' : 'auto',
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
