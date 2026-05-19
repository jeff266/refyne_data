import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

interface PreviewRecord {
  company: string;
  field: string;
  before: string;
  after: string;
  hubspotCompanyId: string;
  portalId: string;
}

/**
 * GET /api/normalize/preview
 *
 * Returns a preview of records that would be changed by normalization.
 * Query params:
 *   - harmonyIds: comma-separated list of harmony IDs to preview (optional)
 *   - limit: max number of records to return (default 50)
 */
export async function GET(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const harmonyIdsParam = searchParams.get('harmonyIds');
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));

    // Get HubSpot connection for portalId
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', ctx.orgId)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      return NextResponse.json({ preview: [] });
    }

    // Build query for normalized_records where there would be changes
    // Show records where raw_value differs from normalized_value (or normalized_value exists)
    let query = supabase
      .from('normalized_records')
      .select('record_id, field, raw_value, normalized_value, harmony_id, status')
      .eq('org_id', ctx.orgId)
      .eq('record_type', 'company')
      .not('normalized_value', 'is', null)
      .not('raw_value', 'is', null)
      .limit(limit);

    // Filter by harmony IDs if provided
    if (harmonyIdsParam) {
      const harmonyIds = harmonyIdsParam.split(',');
      query = query.in('harmony_id', harmonyIds);
    }

    const { data: records, error } = await query;

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/normalize/preview' });
      console.error('Failed to fetch preview records:', error);
      return NextResponse.json(
        { error: 'Failed to fetch preview' },
        { status: 500 }
      );
    }

    // Transform to preview format and filter to only records that would change
    const preview: PreviewRecord[] = (records || [])
      .filter((r) => r.raw_value !== r.normalized_value) // Only show records with actual changes
      .map((r) => ({
        company: r.record_id, // Will be enriched with company name if available
        field: r.field,
        before: r.raw_value || '',
        after: r.normalized_value || '',
        hubspotCompanyId: r.record_id,
        portalId: connection.portal_id,
      }));

    return NextResponse.json({ preview });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/normalize/preview' });
    console.error('Failed to get normalize preview:', error);
    return NextResponse.json(
      { error: 'Failed to get preview' },
      { status: 500 }
    );
  }
}
