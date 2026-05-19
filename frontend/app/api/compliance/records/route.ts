import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase } from '@/lib/db/supabase';

interface ComplianceRecord {
  recordId: string;
  companyName: string | null;
  domain: string | null;
  currentValue: string | null;
  hubspotId: string;
  portalId: string;
  suggestedValue?: string | null;
}

/**
 * GET /api/compliance/records
 *
 * Returns paginated company records failing a specific harmony.
 * Query params:
 *   - harmonyId: Harmony ID to filter by
 *   - status: 'unmatched' | 'stale' | 'all' (default: 'unmatched')
 *   - page: Page number (default: 1)
 *   - pageSize: Records per page (default: 50, max: 100)
 *
 * Response:
 *   - records: Array of ComplianceRecord
 *   - total: Total count
 *   - topPattern: Most common unmatched value (e.g., "Fintech" appears 82 times)
 *   - page, pageSize, hasMore
 */
export async function GET(request: NextRequest) {
  // Add auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

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
    const harmonyId = searchParams.get('harmonyId');
    const status = searchParams.get('status') || 'unmatched';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') || '50', 10));

    if (!harmonyId) {
      return NextResponse.json(
        { error: 'harmonyId query parameter is required' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json({
        records: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
        topPattern: null,
      });
    }

    // Build query
    let query = supabase
      .from('normalized_records')
      .select('record_id, field, raw_value, normalized_value, status', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('harmony_id', harmonyId)
      .eq('record_type', 'company');

    // Filter by status
    if (status === 'unmatched') {
      query = query.eq('status', 'unprocessed');
    } else if (status === 'stale') {
      query = query.eq('status', 'stale');
    }
    // 'all' = no status filter

    // Get count and records
    const offset = (page - 1) * pageSize;
    query = query
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data: records, error, count } = await query;

    if (error) {
      console.error('Error fetching compliance records:', error);
      throw new Error(\`Failed to fetch compliance records: \${error.message}\`);
    }

    const total = count || 0;

    // Get company details from HubSpot (simplified - in production would batch fetch)
    // For now, just use record_id as company name
    const complianceRecords: ComplianceRecord[] = (records || []).map((row) => ({
      recordId: row.record_id,
      companyName: null, // Would need HubSpot API call
      domain: null, // Would need HubSpot API call
      currentValue: row.raw_value,
      hubspotId: row.record_id,
      portalId: orgId, // Simplified - would need portal_id from record
      suggestedValue: row.normalized_value || null,
    }));

    // Calculate top pattern (most common raw value)
    let topPattern: string | null = null;
    if (status === 'unmatched' && records && records.length > 0) {
      const valueCounts = new Map<string, number>();
      for (const record of records) {
        const val = record.raw_value;
        if (val) {
          valueCounts.set(val, (valueCounts.get(val) || 0) + 1);
        }
      }

      // Find most common
      let maxCount = 0;
      let topValue = null;
      for (const [value, count] of valueCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          topValue = value;
        }
      }

      if (topValue && maxCount > 1) {
        topPattern = \`"\${topValue}" appears in \${maxCount} records\`;
      }
    }

    return NextResponse.json({
      records: complianceRecords,
      total,
      page,
      pageSize,
      hasMore: offset + pageSize < total,
      topPattern,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/compliance/records' });
    console.error('Failed to get compliance records:', error);
    return NextResponse.json(
      { error: 'Failed to get compliance records' },
      { status: 500 }
    );
  }
}
