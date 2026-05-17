import { NextRequest, NextResponse } from 'next/server';
import { getDrilldown, type DrilldownFilters, type ComplianceStatus, type RecordType } from '@/lib/compliance';

/**
 * GET /api/compliance/records
 *
 * Paginated drill-down into normalized records.
 * Query params:
 *   - orgId: Organization ID (required)
 *   - harmonyId: Filter by Harmony ID
 *   - field: Filter by field name
 *   - status: Filter by status ('compliant' | 'stale' | 'unprocessed')
 *   - recordType: Filter by record type ('company' | 'contact')
 *   - page: Page number (default: 1)
 *   - pageSize: Records per page (default: 50, max: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Missing orgId parameter' },
        { status: 400 }
      );
    }

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
    console.error('Failed to get compliance records:', error);
    return NextResponse.json(
      { error: 'Failed to get compliance records' },
      { status: 500 }
    );
  }
}
