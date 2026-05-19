import { NextRequest, NextResponse } from 'next/server';
import { getDrilldown, type DrilldownFilters, type ComplianceStatus, type RecordType } from '@/lib/compliance';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';


/**
 * GET /api/compliance/records
 *
 * Paginated drill-down into normalized records.
 * Query params:
 *   - harmonyId: Filter by Harmony ID
 *   - field: Filter by field name
 *   - status: Filter by status ('compliant' | 'stale' | 'unprocessed')
 *   - recordType: Filter by record type ('company' | 'contact')
 *   - page: Page number (default: 1)
 *   - pageSize: Records per page (default: 50, max: 100)
 */
export async function GET(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }
  // Feature gate: compliance
  try {
    await requireFeature(ctx.orgId, 'compliance');
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
    const { searchParams } = new URL(request.url);
    const orgId = ctx.orgId;

    const filters: DrilldownFilters = {
      harmonyId: searchParams.get('harmonyId') || undefined,
      field: searchParams.get('field') || undefined,
      status: (searchParams.get('status') as ComplianceStatus) || undefined,
      recordType: (searchParams.get('recordType') as RecordType) || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      pageSize: Math.min(
        parseInt(searchParams.get('pageSize') || '50', 10),
        100
      ),
    };

    const result = await getDrilldown(orgId, filters);

    return NextResponse.json(result);
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/compliance/records' });
    console.error('Failed to get compliance records:', error);
    return NextResponse.json(
      { error: 'Failed to get compliance records' },
      { status: 500 }
    );
  }
}
