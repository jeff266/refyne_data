/**
 * Enrich Preview API
 *
 * POST /api/enrich/preview
 *
 * Previews enrichment results on a small sample of companies without creating arrangements.
 * Results are cached in Redis for 30 minutes and can be applied via /api/enrich/apply.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { HubSpotClient } from '@/lib/hubspot/client';
import { ApolloAdapter } from '@/lib/providers/apollo';
import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

// Initialize Redis from URL (extracts token from URL automatically)
const redis = process.env.UPSTASH_REDIS_URL
  ? Redis.fromEnv()
  : null;

interface PreviewRequest {
  fields: string[];
  providers: string[];
  write_policy: 'fill_empty' | 'overwrite';
  record_limit: number;
  source: {
    type: 'all' | 'list' | 'segment' | 'csv';
    list_id?: string;
    filters?: {
      missing_fields?: string[];
      lifecyclestage?: string;
      hubspot_owner_id?: string;
      industry?: string[];
    };
    domains?: string[];
  };
}

interface PreviewFieldResult {
  field_key: string;
  field_label: string;
  before: string | null;
  after: string | null;
  would_write: boolean;
  harmony_applied: boolean;
  harmony_name: string | null;
  provider: string | null;
}

interface PreviewCompanyResult {
  hubspot_company_id: string;
  company_name: string;
  fields: PreviewFieldResult[];
}

interface PreviewResponse {
  preview_id: string;
  status: 'completed';
  records_processed: number;
  duration_seconds: number;
  results: PreviewCompanyResult[];
  summary: {
    fields_would_fill: number;
    fields_skipped: number;
    fields_not_found: number;
    harmonies_applied: number;
    no_domain: number;
    already_complete: number;
  };
}

const FIELD_LABELS: Record<string, string> = {
  industry: 'Industry',
  numberofemployees: 'Employee count',
  linkedin_company_page: 'LinkedIn URL',
  phone: 'Phone',
  domain: 'Domain',
  annualrevenue: 'Revenue',
};

export async function POST(req: NextRequest) {
  const startTime = Date.now();

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

    if (!redis) {
      return NextResponse.json(
        { error: 'Redis not configured' },
        { status: 503 }
      );
    }

    const body: PreviewRequest = await req.json();

    // Validate request
    if (!body.fields || body.fields.length === 0) {
      return NextResponse.json({ error: 'No fields specified' }, { status: 400 });
    }

    if (!body.providers || body.providers.length === 0) {
      return NextResponse.json({ error: 'No providers specified' }, { status: 400 });
    }

    // Get HubSpot access token
    const accessToken = await getAccessToken(ctx.orgId);

    // Get portal info
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', ctx.orgId)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'HubSpot not connected' },
        { status: 400 }
      );
    }

    const hubspot = new HubSpotClient(accessToken, connection.portal_id);

    // Fetch companies based on source config
    const companies = await fetchCompaniesForPreview(
      hubspot,
      body.source,
      body.fields,
      body.record_limit
    );

    if (companies.length === 0) {
      return NextResponse.json({
        preview_id: randomUUID(),
        status: 'completed',
        records_processed: 0,
        duration_seconds: (Date.now() - startTime) / 1000,
        results: [],
        summary: {
          fields_would_fill: 0,
          fields_skipped: 0,
          fields_not_found: 0,
          harmonies_applied: 0,
          no_domain: 0,
          already_complete: 0,
        },
      });
    }

    // Load active harmonies for the fields
    const harmonies = await loadHarmonies(ctx.orgId, connection.portal_id, body.fields);

    // Enrich companies
    const results: PreviewCompanyResult[] = [];
    let fieldsWouldFill = 0;
    let fieldsSkipped = 0;
    let fieldsNotFound = 0;
    let harmoniesApplied = 0;
    let noDomain = 0;
    let alreadyComplete = 0;

    const apollo = new ApolloAdapter();

    for (const company of companies) {
      const companyDomain = company.properties.domain || '';

      // Track if company has no domain
      if (!companyDomain) {
        noDomain++;
      }

      // Track if all selected fields are already complete
      const allFieldsComplete = body.fields.every(f => {
        const val = company.properties[f];
        return val && val.trim() !== '';
      });
      if (allFieldsComplete) {
        alreadyComplete++;
      }

      const companyResult: PreviewCompanyResult = {
        hubspot_company_id: company.id,
        company_name: company.properties.name || companyDomain || company.id,
        fields: [],
      };

      // Enrich via Apollo
      let apolloData: any = null;
      if (body.providers.includes('apollo') && companyDomain) {
        try {
          apolloData = await apollo.enrichCompany({ domain: companyDomain });
        } catch (err) {
          console.warn(`[Preview] Apollo enrichment failed for ${companyDomain}:`, err);
        }
      }

      // Process each field
      for (const fieldKey of body.fields) {
        const beforeValue = company.properties[fieldKey] || null;
        let afterValue: string | null = null;
        let provider: string | null = null;

        // Get value from Apollo
        if (apolloData && apolloData.fields) {
          const apolloFieldValue = getApolloFieldValue(apolloData.fields, fieldKey);
          if (apolloFieldValue) {
            afterValue = apolloFieldValue;
            provider = 'apollo';
          }
        }

        // Apply harmony if configured
        let harmonyApplied = false;
        let harmonyName: string | null = null;

        if (afterValue && harmonies[fieldKey]) {
          const harmony = harmonies[fieldKey];
          const normalized = await applyHarmony(
            afterValue,
            harmony,
            ctx.orgId
          );

          if (normalized && normalized !== afterValue) {
            afterValue = normalized;
            harmonyApplied = true;
            harmonyName = harmony.name;
            harmoniesApplied++;
          }
        }

        // Determine if we would write
        let wouldWrite = false;
        if (afterValue) {
          if (body.write_policy === 'fill_empty') {
            wouldWrite = !beforeValue || beforeValue.trim() === '';
          } else {
            wouldWrite = true;
          }
        }

        if (wouldWrite) {
          fieldsWouldFill++;
        } else if (afterValue && beforeValue) {
          fieldsSkipped++;
        } else if (!afterValue) {
          fieldsNotFound++;
        }

        companyResult.fields.push({
          field_key: fieldKey,
          field_label: FIELD_LABELS[fieldKey] || fieldKey,
          before: beforeValue,
          after: afterValue,
          would_write: wouldWrite,
          harmony_applied: harmonyApplied,
          harmony_name: harmonyName,
          provider: provider,
        });
      }

      results.push(companyResult);
    }

    // Generate preview ID
    const previewId = randomUUID();

    // Build response
    const response: PreviewResponse = {
      preview_id: previewId,
      status: 'completed',
      records_processed: companies.length,
      duration_seconds: (Date.now() - startTime) / 1000,
      results,
      summary: {
        fields_would_fill: fieldsWouldFill,
        fields_skipped: fieldsSkipped,
        fields_not_found: fieldsNotFound,
        harmonies_applied: harmoniesApplied,
        no_domain: noDomain,
        already_complete: alreadyComplete,
      },
    };

    // Cache results in Redis for 30 minutes
    const cacheKey = `${ctx.orgId}:enrich:preview:${previewId}`;
    await redis.setex(cacheKey, 1800, JSON.stringify(response));

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Preview] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate preview',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch companies for preview based on source config
 */
async function fetchCompaniesForPreview(
  hubspot: HubSpotClient,
  source: PreviewRequest['source'],
  fields: string[],
  limit: number
): Promise<any[]> {
  const properties = ['name', 'domain', ...fields];
  const companies: any[] = [];

  if (source.type === 'list' && source.list_id) {
    // Fetch from HubSpot list
    for await (const batch of hubspot.getListMembers(source.list_id, properties)) {
      companies.push(...batch);
      if (companies.length >= limit) break;
    }
  } else if (source.type === 'segment' && source.filters) {
    // Use HubSpot Search API with filters
    const filterGroups = buildSearchFilters(source.filters);

    const searchRequest = {
      filterGroups,
      properties,
      limit: Math.min(limit, 100),
      sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }]
    };

    const response = await hubspot.request<{
      results: Array<{
        id: string;
        properties: Record<string, string | null>;
        createdAt: string;
        updatedAt: string;
      }>;
    }>('/crm/v3/objects/companies/search', {
      method: 'POST',
      body: JSON.stringify(searchRequest),
    }, true);

    companies.push(...response.results.map(r => ({
      id: r.id,
      properties: r.properties,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })));
  } else if (source.type === 'csv' && source.domains) {
    // Fetch companies by domain lookup
    for (const domain of source.domains.slice(0, limit)) {
      const matches = await hubspot.searchCompaniesByDomain(domain, properties);
      if (matches.length > 0) {
        companies.push(matches[0]);
      }
      if (companies.length >= limit) break;
    }
  } else {
    // All companies with missing fields
    const filterGroups = buildSearchFilters({
      missing_fields: fields,
    });

    const searchRequest = {
      filterGroups,
      properties,
      limit: Math.min(limit, 100),
      sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }]
    };

    const response = await hubspot.request<{
      results: Array<{
        id: string;
        properties: Record<string, string | null>;
        createdAt: string;
        updatedAt: string;
      }>;
    }>('/crm/v3/objects/companies/search', {
      method: 'POST',
      body: JSON.stringify(searchRequest),
    }, true);

    companies.push(...response.results.map(r => ({
      id: r.id,
      properties: r.properties,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })));
  }

  return companies.slice(0, limit);
}

/**
 * Build HubSpot Search API filter groups
 *
 * Missing fields use OR logic by creating separate filter groups.
 * Each filter group is OR'd together, so this finds companies missing ANY of the fields.
 */
function buildSearchFilters(filters: any): any[] {
  const filterGroups: any[] = [];

  // Create separate filter group for each missing field (OR logic)
  if (filters.missing_fields && filters.missing_fields.length > 0) {
    for (const field of filters.missing_fields) {
      filterGroups.push({
        filters: [{
          propertyName: field,
          operator: 'NOT_HAS_PROPERTY'
        }]
      });
    }
  }

  // Add other filters to all groups (AND with missing field check)
  const additionalFilters: any[] = [];

  if (filters.lifecyclestage) {
    additionalFilters.push({
      propertyName: 'lifecyclestage',
      operator: 'EQ',
      value: filters.lifecyclestage,
    });
  }

  if (filters.hubspot_owner_id) {
    additionalFilters.push({
      propertyName: 'hubspot_owner_id',
      operator: 'EQ',
      value: filters.hubspot_owner_id,
    });
  }

  if (filters.industry && filters.industry.length > 0) {
    additionalFilters.push({
      propertyName: 'industry',
      operator: 'IN',
      values: filters.industry,
    });
  }

  // Add additional filters to each filter group
  if (additionalFilters.length > 0 && filterGroups.length > 0) {
    filterGroups.forEach(group => {
      group.filters.push(...additionalFilters);
    });
  }

  return filterGroups;
}

/**
 * Load active harmonies for specified fields
 */
async function loadHarmonies(
  orgId: string,
  portalId: string,
  fields: string[]
): Promise<Record<string, any>> {
  if (!supabase) return {};

  const harmonies: Record<string, any> = {};

  for (const hubspotProperty of fields) {
    // Get field mapping
    const { data: mapping } = await supabase
      .from('field_mappings')
      .select('canonical_field')
      .eq('org_id', orgId)
      .eq('portal_id', portalId)
      .eq('object_type', 'company')
      .eq('hubspot_property', hubspotProperty)
      .maybeSingle();

    if (!mapping) continue;

    // Get active harmony
    const { data: harmony } = await supabase
      .from('harmonies')
      .select('*')
      .eq('field', mapping.canonical_field)
      .eq('is_active', true)
      .or(`org_id.is.null,org_id.eq.${orgId}`)
      .maybeSingle();

    if (harmony) {
      harmonies[hubspotProperty] = harmony;
    }
  }

  return harmonies;
}

/**
 * Extract field value from Apollo response
 */
function getApolloFieldValue(apolloFields: any, fieldKey: string): string | null {
  switch (fieldKey) {
    case 'industry':
      return apolloFields.industry || null;
    case 'numberofemployees':
      return apolloFields.employee_count ? String(apolloFields.employee_count) : null;
    case 'linkedin_company_page':
      return apolloFields.linkedin_url || null;
    case 'phone':
      return null; // Apollo doesn't provide company phone
    case 'domain':
      return apolloFields.domain || null;
    case 'annualrevenue':
      return apolloFields.revenue_range || null;
    default:
      return null;
  }
}

/**
 * Apply harmony normalization to a value
 */
async function applyHarmony(
  value: string,
  harmony: any,
  orgId: string
): Promise<string | null> {
  if (!supabase) return value;

  // Only apply lookup-based harmonies
  if (harmony.transform_type !== 'lookup' || !harmony.reference_table) {
    return value;
  }

  try {
    // Check cache first
    const { data: cached } = await supabase
      .from('harmony_lookup_cache')
      .select('canonical_value, match_type')
      .eq('org_id', orgId)
      .eq('harmony_id', harmony.id)
      .eq('input_value', value.toLowerCase())
      .maybeSingle();

    if (cached && cached.match_type !== 'none') {
      return cached.canonical_value || value;
    }

    // Perform lookup
    const { data, error } = await supabase.rpc('batch_lookup_harmony', {
      p_table_name: harmony.reference_table,
      p_input_values: [value],
      p_org_id: orgId,
      p_fuzzy_threshold: harmony.fuzzy_threshold ?? 0.8,
      p_phonetic_enabled: harmony.phonetic_enabled ?? false,
    });

    if (error || !data || data.length === 0) {
      return value;
    }

    const result = data[0];
    if (result.match_type === 'none' || !result.canonical_value) {
      return value;
    }

    // Parse JSON if needed
    let finalValue = result.canonical_value;
    if (finalValue.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(finalValue);
        // Extract first value from JSON object
        finalValue = String(Object.values(parsed)[0] || finalValue);
      } catch {
        // Not valid JSON, use as-is
      }
    }

    return finalValue;
  } catch (err) {
    console.warn('[Preview] Harmony application failed:', err);
    return value;
  }
}
