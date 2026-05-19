import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { getRuleExplanation } from '@/lib/harmonies/get-rule-explanation';
import { HubSpotClient } from '@/lib/hubspot/client';

interface PreviewRecord {
  company: string;
  field: string;
  before: string;
  after: string;
  hubspotCompanyId: string;
  portalId: string;
  ruleExplanation?: string;
  excludable: boolean;
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

    // Get access token for HubSpot API calls
    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      console.error('Failed to get HubSpot access token');
      return NextResponse.json({ preview: [] });
    }

    // Fetch HubSpot property definitions to get display labels for enum values
    const labelMap: Record<string, string> = {};
    try {
      const propsResponse = await fetch(
        'https://api.hubapi.com/crm/v3/properties/companies',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (propsResponse.ok) {
        const propsData = await propsResponse.json();
        const properties = propsData.results || [];

        // Build label lookup map: "field:value" -> "display label"
        properties.forEach((prop: any) => {
          if (prop.options && Array.isArray(prop.options)) {
            prop.options.forEach((opt: any) => {
              labelMap[`${prop.name}:${opt.value}`] = opt.label;
            });
          }
        });
      }
    } catch (err) {
      console.error('Failed to fetch HubSpot property definitions:', err);
      // Continue without labels - will show raw values
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

    // Fetch active exclusions for this org
    const { data: exclusions } = await supabase
      .from('normalize_exclusions')
      .select('company_id, field, exclusion_type, expires_at')
      .eq('org_id', ctx.orgId)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    // Build exclusion lookup sets
    const excludedCompanies = new Set<string>();
    const excludedFields = new Set<string>(); // Format: "companyId:field"

    (exclusions || []).forEach((ex) => {
      if (!ex.field) {
        // Company-level exclusion
        excludedCompanies.add(ex.company_id);
      } else {
        // Field-level exclusion
        excludedFields.add(`${ex.company_id}:${ex.field}`);
      }
    });

    // Fetch company names from HubSpot for all unique record IDs
    let companyNames: Record<string, string> = {};
    if (records && records.length > 0) {
      try {
        const allRecordIds = new Set<string>();
        for (const record of records) {
          allRecordIds.add(record.record_id);
        }
        const recordIdArray = Array.from(allRecordIds);

        const client = new HubSpotClient(accessToken, connection.portal_id);
        const companies = await client.getCompaniesByIds(recordIdArray, ['name', 'domain']);

        for (const company of companies) {
          companyNames[company.id] = company.properties.name || company.id;
        }

        console.log(`[Normalize Preview] Fetched ${companies.length} company names`);
      } catch (err: any) {
        console.error('[Normalize Preview] Error fetching company names:', err.message);
        // Continue without names - will show IDs
      }
    }

    // Transform to preview format and filter to only records that would change
    const preview: PreviewRecord[] = (records || [])
      .filter((r) => {
        // Filter out records with actual changes
        if (r.raw_value === r.normalized_value) {
          return false;
        }

        // Filter out excluded companies
        if (excludedCompanies.has(r.record_id)) {
          return false;
        }

        // Filter out excluded fields
        if (excludedFields.has(`${r.record_id}:${r.field}`)) {
          return false;
        }

        return true;
      })
      .map((r) => {
        // Use display label if available, otherwise use raw value
        const beforeDisplay = labelMap[`${r.field}:${r.raw_value}`] || r.raw_value || '';

        // Get rule explanation
        const explanation = r.harmony_id
          ? getRuleExplanation(r.harmony_id, r.field, beforeDisplay, r.normalized_value || '')
          : null;

        return {
          company: companyNames[r.record_id] || r.record_id,
          field: r.field,
          before: beforeDisplay,
          after: r.normalized_value || '',
          hubspotCompanyId: r.record_id,
          portalId: connection.portal_id,
          ruleExplanation: explanation ?? undefined,
          excludable: true,
        };
      });

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
