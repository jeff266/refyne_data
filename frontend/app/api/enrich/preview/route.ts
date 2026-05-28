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
import { fetchCompaniesWithEmptyFields } from '@/lib/hubspot/fetch-companies';
import { ApolloAdapter } from '@/lib/providers/apollo';
import { getApolloKey } from '@/lib/providers/apollo-key';
import { GraphiqAdapter } from '@/lib/providers/graphiq';
import { getGraphiqKey } from '@/lib/providers/graphiq-key';
import { refyneSearch, type RefyneSearchResult } from '@/lib/providers/refyne-search';
import { generateHarmonyForField, type HarmonyMapping } from '@/lib/enrichment/harmony-generator';
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
    type: 'all' | 'list' | 'segment' | 'csv' | 'gaps';
    list_id?: string;
    fields?: string[];  // For gaps: which fields to check for emptiness
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
  company_id: string;
  company_name: string;
  field_key: string;
  field_label: string;
  current_value: string | null;
  found_value: string | null;
  found_raw: string | null;
  mapped_value: string | null;  // Harmony-mapped value for enum fields
  mapping_confidence: 'high' | 'medium' | 'low' | 'no_match' | null;  // Confidence of mapping
  source: string | null;
  status: 'would_fill' | 'would_override' | 'already_set' | 'no_data' | 'skipped' | 'requires_review';
  harmony_applied: boolean;
  harmony_name: string | null;
  selected: boolean;
  confidence?: number;  // For Refyne Search: 0-1 confidence score
  confidence_level?: 'high' | 'medium' | 'low' | 'insufficient';  // For Refyne Search
  evidence?: string;  // For Refyne Search: evidence snippet
  from_cache?: boolean;  // For Refyne Search: whether from cache
  requires_review?: boolean;  // For low-trust classifications (haiku_classified)
  trust_level?: 'high' | 'medium' | 'low';  // Trust level from classification source
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
  results: PreviewFieldResult[]; // Flattened array of field results
  summary: {
    would_fill: number;
    would_override: number;
    already_set: number;
    no_data: number;
    skipped: number;
    harmonies_applied: number;
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

// Hard cap on preview size to prevent timeouts
const PREVIEW_LIMIT = 20;

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
    // Cap at PREVIEW_LIMIT to prevent timeouts
    const effectiveLimit = Math.min(body.record_limit, PREVIEW_LIMIT);
    const companies = await fetchCompaniesForPreview(
      hubspot,
      body.source,
      body.fields,
      effectiveLimit
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

    // Initialize providers based on what's selected
    let apollo: ApolloAdapter | null = null;
    let graphiq: GraphiqAdapter | null = null;
    const useRefyneSearch = body.providers.includes('refyne_search');

    if (body.providers.includes('apollo')) {
      const apolloKey = await getApolloKey(ctx.orgId);
      if (apolloKey) {
        apollo = new ApolloAdapter(apolloKey);
      }
    }

    if (body.providers.includes('graphiq') || body.providers.includes('refyne')) {
      const graphiqKey = await getGraphiqKey(ctx.orgId);
      if (graphiqKey) {
        graphiq = new GraphiqAdapter(graphiqKey);
      }
    }

    // Require at least one provider (refyne_search is always available)
    if (!apollo && !graphiq && !useRefyneSearch) {
      return NextResponse.json({
        error: 'No providers connected. Please connect Apollo, GraphIQ, or use Refyne Search in Settings → Connections.',
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
        }
      }, { status: 400 });
    }

    // Load active harmonies for the fields
    const harmonies = await loadHarmonies(ctx.orgId, connection.portal_id, body.fields);

    // Enrich companies
    const results: PreviewFieldResult[] = []; // Flattened field results
    let wouldFill = 0;
    let wouldOverride = 0;
    let alreadySet = 0;
    let noData = 0;
    let skipped = 0;
    let harmoniesApplied = 0;

    // Provider Promise cache - prevents race condition when multiple fields query same provider
    const providerPromiseCache = new Map<string, Promise<any>>();
    let apiCallCount = 0; // Track actual API calls

    for (const company of companies) {
      const companyDomain = company.properties.domain || '';
      const companyId = company.id;
      const companyName = company.properties.name || companyDomain || company.id;

      // Enrich via providers with Promise cache (prevents duplicate API calls)
      let providerData: any = null;
      let usedProvider: string | null = null;

      // Try Apollo first if selected
      if (apollo && companyDomain) {
        const cacheKey = `apollo:${companyDomain}`;

        // Check cache first
        if (providerPromiseCache.has(cacheKey)) {
          console.log(`[Preview Cache] HIT: apollo for ${companyDomain}`);
          providerData = await providerPromiseCache.get(cacheKey);
        } else {
          console.log(`[Preview Cache] MISS: apollo for ${companyDomain}, calling API`);
          apiCallCount++;

          // Create and cache Promise BEFORE awaiting
          const promise = apollo.enrichCompany({ domain: companyDomain })
            .catch(err => {
              console.warn(`[Preview] Apollo enrichment failed for ${companyDomain}:`, err);
              return null;
            });

          providerPromiseCache.set(cacheKey, promise);
          providerData = await promise;
        }

        if (providerData) {
          usedProvider = 'apollo';
        }
      }

      // Try GraphIQ if Apollo didn't return data or if GraphIQ selected
      if (!providerData && graphiq) {
        const cacheKey = `graphiq:${companyDomain || company.properties.name}`;

        // Check cache first
        if (providerPromiseCache.has(cacheKey)) {
          console.log(`[Preview Cache] HIT: graphiq for ${companyDomain || company.properties.name}`);
          providerData = await providerPromiseCache.get(cacheKey);
        } else {
          console.log(`[Preview Cache] MISS: graphiq for ${companyDomain || company.properties.name}, calling API`);
          apiCallCount++;

          // Create and cache Promise BEFORE awaiting
          const promise = graphiq.enrichCompany({
            domain: companyDomain || undefined,
            name: company.properties.name || undefined
          }).catch(err => {
            console.warn(`[Preview] GraphIQ enrichment failed:`, err);
            return null;
          });

          providerPromiseCache.set(cacheKey, promise);
          providerData = await promise;
        }

        if (providerData) {
          usedProvider = 'graphiq';
        }
      }

      // Try Refyne Search if no other provider returned data
      let refyneResults: Record<string, RefyneSearchResult> = {};
      if (!providerData && useRefyneSearch) {
        const cacheKey = `refyne_search:${companyDomain || company.properties.name}`;

        if (providerPromiseCache.has(cacheKey)) {
          console.log(`[Preview Cache] HIT: refyne_search for ${companyDomain || company.properties.name}`);
          const results = await providerPromiseCache.get(cacheKey);
          refyneResults = results || {};
        } else {
          console.log(`[Preview Cache] MISS: refyne_search for ${companyDomain || company.properties.name}, calling API`);
          apiCallCount++;

          const promise = refyneSearch(
            ctx.orgId,
            companyDomain || null,
            company.properties.name || null,
            body.fields
          ).then(results => {
            // Convert array to keyed object
            const keyed: Record<string, RefyneSearchResult> = {};
            for (const r of results) {
              keyed[r.fieldKey] = r;
            }
            return keyed;
          }).catch(err => {
            console.warn(`[Preview] Refyne Search failed:`, err);
            return {};
          });

          providerPromiseCache.set(cacheKey, promise);
          refyneResults = await promise;
        }

        if (Object.keys(refyneResults).length > 0) {
          usedProvider = 'refyne_search';
        }
      }

      // Process each field
      for (const fieldKey of body.fields) {
        const currentValue = company.properties[fieldKey] || null;
        let foundValue: string | null = null;
        let foundRaw: string | null = null;
        let source: string | null = usedProvider;
        let confidence: number | undefined = undefined;
        let confidenceLevel: 'high' | 'medium' | 'low' | 'insufficient' | undefined = undefined;
        let evidence: string | undefined = undefined;
        let fromCache: boolean | undefined = undefined;

        // Extract raw and normalized values from provider data
        if (providerData) {
          if (usedProvider === 'apollo' || usedProvider === 'graphiq') {
            foundRaw = providerData.raw?.[fieldKey] || getFieldValueFromProvider(providerData.raw, fieldKey, usedProvider);
            foundValue = getFieldValueFromProvider(providerData.normalized, fieldKey, usedProvider);
          }
        } else if (usedProvider === 'refyne_search' && refyneResults[fieldKey]) {
          // Refyne Search results
          const rsResult = refyneResults[fieldKey];
          foundValue = rsResult.value ? String(rsResult.value) : null;
          foundRaw = foundValue; // Refyne Search doesn't have separate raw/normalized
          confidence = rsResult.confidence;
          confidenceLevel = rsResult.level;
          evidence = rsResult.evidence;
          fromCache = rsResult.fromCache;
          source = 'refyne_search';
        }

        // Extract trust level and review flag from Refyne Search results
        let requiresReview = false;
        let trustLevel: 'high' | 'medium' | 'low' | undefined = undefined;
        if (usedProvider === 'refyne_search' && refyneResults[fieldKey]) {
          const rsResult = refyneResults[fieldKey];
          requiresReview = rsResult.requiresReview ?? false;
          trustLevel = rsResult.trustLevel;
        }

        // Apply harmony if configured
        let harmonyApplied = false;
        let harmonyName: string | null = null;

        if (foundValue && harmonies[fieldKey]) {
          const harmony = harmonies[fieldKey];
          const normalized = await applyHarmony(
            foundValue,
            harmony,
            ctx.orgId
          );

          if (normalized && normalized !== foundValue) {
            foundValue = normalized;
            harmonyApplied = true;
            harmonyName = harmony.name;
            harmoniesApplied++;
          }
        }

        // Determine status
        let status: 'would_fill' | 'would_override' | 'already_set' | 'no_data' | 'skipped' | 'requires_review';
        let selected = false;

        if (!companyDomain && !company.properties.name) {
          status = 'skipped';
          skipped++;
        } else if (!foundValue) {
          status = 'no_data';
          noData++;
        } else if (requiresReview) {
          // Low-trust classification (haiku_classified) - requires manual review
          status = 'requires_review';
          selected = false; // Don't auto-select low-trust results
          console.log(`[Preview] Low-trust result for ${companyName} - ${fieldKey}: requires review`);
        } else if (!currentValue || currentValue.trim() === '') {
          status = 'would_fill';
          wouldFill++;
          selected = true; // Auto-select fill actions
        } else if (body.write_policy === 'overwrite' && currentValue !== foundValue) {
          status = 'would_override';
          wouldOverride++;
          selected = true; // Auto-select override actions
        } else {
          status = 'already_set';
          alreadySet++;
        }

        results.push({
          company_id: companyId,
          company_name: companyName,
          field_key: fieldKey,
          field_label: FIELD_LABELS[fieldKey] || fieldKey,
          current_value: currentValue,
          found_value: foundValue,
          found_raw: foundRaw,
          mapped_value: null,  // Will be set by harmony generation
          mapping_confidence: null,  // Will be set by harmony generation
          source: source,
          status: status,
          harmony_applied: harmonyApplied,
          harmony_name: harmonyName,
          selected: selected,
          confidence,
          confidence_level: confidenceLevel,
          evidence,
          from_cache: fromCache,
          requires_review: requiresReview,
          trust_level: trustLevel,
        });
      }
    }

    console.log(`[Preview] Collected ${results.length} field results, starting harmony generation for enum fields`);

    // Step 1: Collect unique raw values for each enum field
    const enumFieldValues: Record<string, Set<string>> = {};
    const isEnumField = (fieldKey: string) => fieldKey === 'industry';  // Only industry for now

    for (const row of results) {
      if (row.found_value && isEnumField(row.field_key)) {
        if (!enumFieldValues[row.field_key]) {
          enumFieldValues[row.field_key] = new Set();
        }
        enumFieldValues[row.field_key].add(row.found_value);
      }
    }

    // Step 2: Load or generate harmonies for each enum field that has values
    const generatedHarmonies: Record<string, HarmonyMapping[]> = {};

    for (const [fieldKey, rawValues] of Object.entries(enumFieldValues)) {
      console.log(`[Preview] Processing harmony for ${fieldKey} with ${rawValues.size} unique values`);

      // Check for existing harmony first
      const { data: existingHarmony } = await supabase
        .from('field_mappings')
        .select('canonical_to_hubspot_map')
        .eq('org_id', ctx.orgId)
        .eq('canonical_field', fieldKey)
        .maybeSingle();

      if (existingHarmony?.canonical_to_hubspot_map && Object.keys(existingHarmony.canonical_to_hubspot_map).length > 0) {
        // Use stored harmony, skip Claude entirely
        console.log(`[Harmony] Using stored harmony for ${fieldKey}, skipping Claude`);

        const map = existingHarmony.canonical_to_hubspot_map as Record<
          string,
          string | { hubspot_value: string; confidence: string }
        >;

        generatedHarmonies[fieldKey] = Object.entries(map).map(([raw, value]) => {
          if (typeof value === 'string') {
            return { raw, mapped: value, confidence: 'high' as const };
          } else {
            return {
              raw,
              mapped: value.hubspot_value,
              confidence: value.confidence as 'high' | 'medium' | 'low' | 'no_match',
            };
          }
        });
      } else {
        // No stored harmony - generate using Claude (first run only)
        console.log(`[Harmony] No stored harmony for ${fieldKey}, generating with Claude`);

        // Fetch valid HubSpot values from industry_crosswalk table
        const { data: crosswalkData } = await supabase
          .from('industry_crosswalk')
          .select('hubspot_value')
          .not('hubspot_value', 'is', null);

        const hubspotValidValues = Array.from(
          new Set(
            (crosswalkData || [])
              .map(row => row.hubspot_value)
              .filter((v): v is string => v !== null)
          )
        );

        console.log(`[Preview] Loaded ${hubspotValidValues.length} valid HubSpot ${fieldKey} values`);

        // Generate harmony using generateHarmonyForField (includes NAICS crosswalk + Claude fallback)
        const harmony = await generateHarmonyForField(
          ctx.orgId,
          connection.portal_id,
          fieldKey,
          Array.from(rawValues),
          hubspotValidValues
        );

        generatedHarmonies[fieldKey] = harmony;
        console.log(`[Preview] Generated ${harmony.length} mappings for ${fieldKey}`);
      }
    }

    // Step 3: Apply harmony to preview rows before returning
    // Helper to check if value is already canonical
    const isAlreadyCanonical = (value: string, fieldKey: string): boolean => {
      if (fieldKey !== 'industry') return false;
      // HubSpot industry values are UPPER_SNAKE_CASE (2+ uppercase letters/underscores)
      return /^[A-Z][A-Z_]+$/.test(value);
    };

    for (const row of results) {
      if (isEnumField(row.field_key) && row.found_value) {
        // Check if already canonical (from NAICS crosswalk classification)
        if (isAlreadyCanonical(row.found_value, row.field_key)) {
          // Already classified by NAICS crosswalk, pass through unchanged
          row.mapped_value = row.found_value;
          row.mapping_confidence = 'high';
          row.harmony_applied = false;  // Didn't need Harmony
          row.harmony_name = null;
          console.log(`[Preview] Skipping Harmony for already-canonical value: ${row.found_value}`);
          continue;
        }

        const harmony = generatedHarmonies[row.field_key];

        if (harmony) {
          const mapping = harmony.find(m => m.raw === row.found_value);

          if (mapping && mapping.mapped && mapping.confidence !== 'no_match') {
            row.mapped_value = mapping.mapped;  // MENTAL_HEALTH_CARE
            row.mapping_confidence = mapping.confidence;  // high, medium, low
            row.harmony_applied = true;
            row.harmony_name = `${row.field_key}_harmony`;

            // Update status and selection based on mapping confidence
            if (row.status === 'would_fill' || row.status === 'would_override') {
              // Keep actionable status but adjust selection based on confidence
              if (mapping.confidence === 'low') {
                row.selected = false;  // Don't auto-select low confidence mappings
              }
            }
          } else {
            // No mapping found
            row.mapped_value = null;
            row.mapping_confidence = 'no_match';
            row.status = 'no_data';  // Can't write without valid mapping
            row.selected = false;
          }
        }
      } else {
        // Non-enum fields: use found_value as-is
        row.mapped_value = row.found_value;
        row.mapping_confidence = null;
      }
    }

    console.log(`[Preview] Applied harmony mappings to ${results.length} rows`);

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
        would_fill: wouldFill,
        would_override: wouldOverride,
        already_set: alreadySet,
        no_data: noData,
        skipped: skipped,
        harmonies_applied: harmoniesApplied,
      },
    };

    // Debug logging with API call tracking
    const responseSize = JSON.stringify(response).length;
    console.log('[Preview API] Built response:', {
      results_count: results.length,
      first_result: results[0] ? `${results[0].company_name} - ${results[0].field_label}` : 'none',
      response_size_kb: Math.round(responseSize / 1024),
      api_calls_made: apiCallCount,
      would_fill: wouldFill,
      would_override: wouldOverride,
      already_set: alreadySet,
      no_data: noData,
      skipped: skipped
    });

    // Cache results in Redis for 30 minutes
    const cacheKey = `${ctx.orgId}:enrich:preview:${previewId}`;
    await redis.setex(cacheKey, 1800, JSON.stringify(response));

    console.log('[Preview API] Returning response with', results.length, 'companies, size:', Math.round(responseSize / 1024), 'KB');

    // Verify response structure before returning
    if (!response.results || !Array.isArray(response.results)) {
      console.error('[Preview API] CRITICAL: response.results is not an array!', {
        results_exists: !!response.results,
        results_type: typeof response.results,
        results_is_array: Array.isArray(response.results)
      });
    }

    const res = NextResponse.json(response);
    res.headers.set('Deprecation', 'true');
    res.headers.set('Sunset', '2026-07-01');
    res.headers.set('Link', '</api/enrich/preview/enqueue>; rel="successor-version"');
    return res;
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
      limit: limit,
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
  } else if (source.type === 'gaps' && source.fields && source.fields.length > 0) {
    // Fetch companies with gaps in selected fields
    const gapResults = await fetchCompaniesWithEmptyFields(
      hubspot,
      source.fields, // Already HubSpot property names from UI
      { properties }
    );
    companies.push(...gapResults.map(r => ({
      id: r.id,
      properties: r.properties,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })));
  } else {
    // All companies with missing fields
    const filterGroups = buildSearchFilters({
      missing_fields: fields,
    });

    const searchRequest = {
      filterGroups,
      properties,
      limit: limit,
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
  // HubSpot allows max 5 filterGroups, so limit to first 5 fields
  if (filters.missing_fields && filters.missing_fields.length > 0) {
    const fieldsToQuery = filters.missing_fields.slice(0, 5);
    for (const field of fieldsToQuery) {
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
  if (additionalFilters.length > 0) {
    if (filterGroups.length > 0) {
      // Add to existing filter groups (AND with missing field checks)
      filterGroups.forEach(group => {
        group.filters.push(...additionalFilters);
      });
    } else {
      // No missing field filters - create a single filter group with just the additional filters
      filterGroups.push({
        filters: additionalFilters
      });
    }
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
 * Extract field value from provider response (Apollo or GraphIQ)
 */
function getFieldValueFromProvider(normalizedFields: any, fieldKey: string, provider: string): string | null {
  switch (fieldKey) {
    case 'industry':
      return normalizedFields.industry || null;
    case 'numberofemployees':
      return normalizedFields.employee_count ? String(normalizedFields.employee_count) : null;
    case 'linkedin_company_page':
      return normalizedFields.linkedin_url || null;
    case 'phone':
      return normalizedFields.phone || null; // GraphIQ provides phone, Apollo doesn't
    case 'domain':
      return normalizedFields.domain || null;
    case 'annualrevenue':
      if (provider === 'apollo') {
        return normalizedFields.revenue_range || normalizedFields.revenue || null;
      }
      return normalizedFields.revenue || null;
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
