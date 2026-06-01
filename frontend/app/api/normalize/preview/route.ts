import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { HubSpotClient } from '@/lib/hubspot/client';
import { runNormalizationPreview } from '@/lib/harmonies/normalization-engine';
import type { Harmony, HubSpotRecord } from '@/lib/harmonies/normalization-engine';
import { getFieldAssignments, buildFieldMap } from '@/lib/harmonies/field-assignments';

// Increase timeout to 60 seconds for large portals
export const maxDuration = 60;

interface PreviewRecord {
  company: string;
  field: string;
  before: string;
  beforeDisplay: string;
  after: string;
  hubspotCompanyId: string;
  portalId: string;
  matchType: 'exact' | 'fuzzy' | 'phonetic' | 'none';
  confidence: number;
  requiresReview: boolean;
  excludable: boolean;
}

/**
 * GET /api/normalize/preview
 *
 * Returns a preview of records that would be changed by normalization
 * using the new fuzzy matching engine.
 *
 * Query params:
 *   - harmonyIds: comma-separated list of harmony IDs to preview (optional)
 *   - limit: max number of records to return (default 50)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('[Normalize Preview] ========== REQUEST START ==========');

  // Auth check
  let ctx;
  try {
    const authStart = Date.now();
    ctx = await getOrgContext();
    console.log(`[Normalize Preview] Auth check: ${Date.now() - authStart}ms`);
  } catch (e) {
    console.error('[Normalize Preview] Auth error:', e);
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      console.error('[Normalize Preview] Supabase not configured');
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const harmonyIdsParam = searchParams.get('harmonyIds');
    const companyIdsParam = searchParams.get('companyIds');
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
    const objectType = (searchParams.get('objectType') ?? 'company') as 'company' | 'contact' | 'deal';

    console.log('[Normalize Preview] Request params:', {
      orgId: ctx.orgId,
      objectType,
      limit,
      harmonyIdsParam: harmonyIdsParam?.substring(0, 100),
      companyIdsParam: companyIdsParam ? `${companyIdsParam.split(',').length} companies` : 'none',
    });

    // Get HubSpot connection
    let connection;
    try {
      const connStart = Date.now();
      const result = await supabase
        .from('hubspot_connections')
        .select('portal_id')
        .eq('org_id', ctx.orgId)
        .eq('connection_status', 'active')
        .single();

      connection = result.data;
      console.log(`[Normalize Preview] HubSpot connection query: ${Date.now() - connStart}ms, portal: ${connection?.portal_id}`);

      if (result.error) {
        console.error('[Normalize Preview] Connection query error:', result.error);
        throw result.error;
      }
    } catch (connError) {
      console.error('[Normalize Preview] Failed to fetch HubSpot connection:', connError);
      captureWithOrgContext(connError, ctx.orgId, { route: '/api/normalize/preview', step: 'connection' });
      return NextResponse.json({ error: 'Failed to fetch HubSpot connection' }, { status: 500 });
    }

    if (!connection) {
      console.log('[Normalize Preview] No active HubSpot connection found');
      return NextResponse.json({ preview: [], summary: { total: 0, fuzzy: 0, phonetic: 0 } });
    }

    // Get access token
    let accessToken;
    try {
      const tokenStart = Date.now();
      accessToken = await getAccessToken(ctx.orgId);
      console.log(`[Normalize Preview] Access token fetch: ${Date.now() - tokenStart}ms`);

      if (!accessToken) {
        console.error('[Normalize Preview] Failed to get HubSpot access token - returned null/undefined');
        return NextResponse.json({ preview: [], summary: { total: 0, fuzzy: 0, phonetic: 0 } });
      }
    } catch (tokenError) {
      console.error('[Normalize Preview] Access token error:', tokenError);
      captureWithOrgContext(tokenError, ctx.orgId, { route: '/api/normalize/preview', step: 'access_token' });
      return NextResponse.json({ error: 'Failed to get access token' }, { status: 500 });
    }

    // Fetch active harmonies for selected object type
    let harmoniesData;
    try {
      const harmonyStart = Date.now();
      let harmonyQuery = supabase
        .from('harmonies')
        .select('*')
        .eq('is_active', true)
        .eq('object_type', objectType)
        .or(`org_id.is.null,org_id.eq.${ctx.orgId}`);

      if (harmonyIdsParam) {
        const harmonyIds = harmonyIdsParam.split(',');
        harmonyQuery = harmonyQuery.in('id', harmonyIds);
      }

      const { data, error: harmoniesError } = await harmonyQuery;
      console.log(`[Normalize Preview] Harmonies query: ${Date.now() - harmonyStart}ms, found: ${data?.length || 0}`);

      if (harmoniesError) {
        console.error('[Normalize Preview] Harmonies query error:', harmoniesError);
        captureWithOrgContext(harmoniesError, ctx.orgId, { route: '/api/normalize/preview', step: 'harmonies' });
        return NextResponse.json({ error: 'Failed to fetch harmonies' }, { status: 500 });
      }

      harmoniesData = data;
    } catch (harmonyError) {
      console.error('[Normalize Preview] Unexpected harmonies error:', harmonyError);
      captureWithOrgContext(harmonyError, ctx.orgId, { route: '/api/normalize/preview', step: 'harmonies' });
      return NextResponse.json({ error: 'Failed to fetch harmonies' }, { status: 500 });
    }

    if (!harmoniesData || harmoniesData.length === 0) {
      console.log('[Normalize Preview] No harmonies found, returning empty preview');
      return NextResponse.json({ preview: [], summary: { total: 0, fuzzy: 0, phonetic: 0 } });
    }

    // Fetch org-specific settings for preset harmonies
    let orgSettings;
    try {
      const settingsStart = Date.now();
      const presetHarmonyIds = harmoniesData.filter((h) => h.is_preset).map((h) => h.id);
      const result = presetHarmonyIds.length > 0
        ? await supabase
            .from('harmony_org_settings')
            .select('harmony_id, output_format')
            .eq('org_id', ctx.orgId)
            .in('harmony_id', presetHarmonyIds)
        : { data: [] };

      orgSettings = result.data;
      console.log(`[Normalize Preview] Org settings query: ${Date.now() - settingsStart}ms, found: ${orgSettings?.length || 0}`);

      if ('error' in result && result.error) {
        console.error('[Normalize Preview] Org settings error:', result.error);
        throw result.error;
      }
    } catch (settingsError) {
      console.error('[Normalize Preview] Failed to fetch org settings:', settingsError);
      captureWithOrgContext(settingsError, ctx.orgId, { route: '/api/normalize/preview', step: 'org_settings' });
      return NextResponse.json({ error: 'Failed to fetch org settings' }, { status: 500 });
    }

    const orgSettingsMap = new Map(
      (orgSettings || []).map((s: any) => [s.harmony_id, s])
    );

    // Transform harmonies to engine format
    const transformStart = Date.now();
    const harmonies: Harmony[] = harmoniesData.map((h) => {
      const orgSetting = orgSettingsMap.get(h.id);
      const effectiveOutputFormat = h.is_preset && orgSetting?.output_format
        ? orgSetting.output_format
        : h.output_format || 'default';

      return {
        id: h.id,
        name: h.name,
        field: h.field,
        objectType: h.object_type as 'company' | 'contact',
        transformType: h.transform_type || 'lookup',
        transformFunction: h.transform_function,
        transformConfig: h.transform_config || {},
        referenceTable: h.reference_table,
        fuzzyThreshold: h.fuzzy_threshold || 0.8,
        phoneticEnabled: h.phonetic_enabled || false,
        isActive: h.is_active,
        outputFormat: effectiveOutputFormat,
        outputFormatsAvailable: h.output_formats_available || [],
        isPreset: h.is_preset || false,
      };
    });
    console.log(`[Normalize Preview] Transform harmonies: ${Date.now() - transformStart}ms, harmonies:`, harmonies.map(h => ({ id: h.id, field: h.field, transformType: h.transformType })));

    // Fetch field assignments for this org (replaces DEFAULT_FIELD_MAPPINGS)
    let fieldAssignments;
    try {
      const assignmentsStart = Date.now();
      fieldAssignments = await getFieldAssignments(ctx.orgId, objectType);
      console.log(`[Normalize Preview] Field assignments: ${Date.now() - assignmentsStart}ms, found: ${fieldAssignments.length}`);

      if (fieldAssignments.length === 0) {
        console.warn(`[Normalize Preview] No field assignments found for org ${ctx.orgId} and objectType ${objectType}`);
        return NextResponse.json({
          preview: [],
          summary: { total: 0, fuzzy: 0, phonetic: 0 },
          error: `No field assignments configured for ${objectType}. Please configure field mappings first.`
        }, { status: 400 });
      }
    } catch (assignmentError) {
      console.error('[Normalize Preview] Field assignments error:', assignmentError);
      console.error('[Normalize Preview] Field assignments error stack:', assignmentError instanceof Error ? assignmentError.stack : undefined);
      captureWithOrgContext(assignmentError, ctx.orgId, { route: '/api/normalize/preview', step: 'field_assignments' });
      return NextResponse.json({ error: 'Failed to fetch field assignments' }, { status: 500 });
    }

    const mapStart = Date.now();
    const fieldMap = buildFieldMap(fieldAssignments);

    // Build reverse map: HubSpot property → canonical field
    const reverseFieldMap = new Map<string, string>();
    for (const assignment of fieldAssignments) {
      reverseFieldMap.set(assignment.hubspotProperty, assignment.canonicalField);
    }

    // Get HubSpot properties to fetch from field assignments
    const hubspotProperties = Array.from(
      new Set([
        'name',
        'domain',
        ...fieldAssignments.map((a) => a.hubspotProperty),
      ])
    );
    console.log(`[Normalize Preview] Build field maps: ${Date.now() - mapStart}ms, properties to fetch: ${hubspotProperties.length}`);

    // Fetch HubSpot companies
    const client = new HubSpotClient(accessToken, connection.portal_id);
    const properties = hubspotProperties;

    // Fetch companies - either specific IDs or paginated
    let limitedCompanies: any[] = [];

    try {
      const fetchStart = Date.now();
      if (companyIdsParam) {
        // Fetch specific companies by ID
        const companyIds = companyIdsParam.split(',').slice(0, limit);
        console.log(`[Normalize Preview] Fetching ${companyIds.length} specific companies by ID`);
        limitedCompanies = await client.getCompaniesByIds(companyIds, properties);
      } else {
        // Fetch companies with pagination (existing behavior)
        console.log(`[Normalize Preview] Fetching companies via pagination, limit: ${limit}`);
        const companies: any[] = [];
        let batchCount = 0;
        for await (const batch of client.getAllCompanies(properties)) {
          batchCount++;
          console.log(`[Normalize Preview] Batch ${batchCount}: fetched ${batch.length} companies, total so far: ${companies.length + batch.length}`);
          companies.push(...batch);
          if (companies.length >= limit) {
            console.log(`[Normalize Preview] Reached limit ${limit}, breaking out of pagination`);
            break;
          }
        }
        limitedCompanies = companies.slice(0, limit);
      }

      console.log(`[Normalize Preview] HubSpot company fetch: ${Date.now() - fetchStart}ms, fetched: ${limitedCompanies.length} companies`);
    } catch (fetchError) {
      console.error('[Normalize Preview] Failed to fetch companies from HubSpot:', fetchError);
      console.error('[Normalize Preview] Fetch error details:', {
        message: fetchError instanceof Error ? fetchError.message : String(fetchError),
        stack: fetchError instanceof Error ? fetchError.stack : undefined,
        portalId: connection.portal_id,
        propertiesCount: properties.length,
      });
      captureWithOrgContext(fetchError, ctx.orgId, { route: '/api/normalize/preview', step: 'fetch_companies', portalId: connection.portal_id });
      return NextResponse.json({
        error: 'Failed to fetch companies from HubSpot',
        details: fetchError instanceof Error ? fetchError.message : String(fetchError)
      }, { status: 500 });
    }

    // Transform to HubSpotRecord format and map properties to canonical field names
    const recordStart = Date.now();
    const records: HubSpotRecord[] = limitedCompanies.map((company) => {
      const record: HubSpotRecord = {
        id: company.id,
        ...company.properties,
      };

      // Map HubSpot property names to canonical field names using field assignments
      for (const assignment of fieldAssignments) {
        const value = company.properties[assignment.hubspotProperty];
        if (value !== undefined) {
          record[assignment.canonicalField] = value;
        }
      }

      return record;
    });
    console.log(`[Normalize Preview] Transform records: ${Date.now() - recordStart}ms`);

    // Debug: Check what industry values we're working with
    console.log('[Normalize Preview] Sample industry values:',
      records.slice(0, 5).map(r => r.industry).filter(Boolean)
    );

    // Run normalization preview
    let changes;
    try {
      const normStart = Date.now();
      console.log(`[Normalize Preview] Running normalization with ${harmonies.length} harmonies on ${records.length} records`);
      changes = await runNormalizationPreview(records, harmonies, ctx.orgId);
      console.log(`[Normalize Preview] Normalization engine: ${Date.now() - normStart}ms, generated ${changes.length} changes`);
    } catch (normError) {
      console.error('[Normalize Preview] Normalization engine error:', normError);
      console.error('[Normalize Preview] Normalization error details:', {
        message: normError instanceof Error ? normError.message : String(normError),
        stack: normError instanceof Error ? normError.stack : undefined,
        harmonies: harmonies.map(h => ({ id: h.id, field: h.field, transformType: h.transformType })),
        recordCount: records.length
      });
      captureWithOrgContext(normError, ctx.orgId, {
        route: '/api/normalize/preview',
        step: 'run_normalization',
        harmonies: harmonies.map(h => h.id),
        recordCount: records.length
      });
      return NextResponse.json({
        error: 'Normalization engine failed',
        details: normError instanceof Error ? normError.message : String(normError)
      }, { status: 500 });
    }

    // Fetch active exclusions
    let exclusions;
    try {
      const exclusionsStart = Date.now();
      const result = await supabase
        .from('normalize_exclusions')
        .select('company_id, field, exclusion_type, expires_at')
        .eq('org_id', ctx.orgId)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

      exclusions = result.data;
      console.log(`[Normalize Preview] Exclusions query: ${Date.now() - exclusionsStart}ms, found: ${exclusions?.length || 0}`);

      if (result.error) {
        console.error('[Normalize Preview] Exclusions query error:', result.error);
        throw result.error;
      }
    } catch (exclusionsError) {
      console.error('[Normalize Preview] Failed to fetch exclusions:', exclusionsError);
      captureWithOrgContext(exclusionsError, ctx.orgId, { route: '/api/normalize/preview', step: 'exclusions' });
      // Non-fatal - continue without exclusions
      exclusions = [];
    }

    // Build exclusion lookup sets
    const filterStart = Date.now();
    const excludedCompanies = new Set<string>();
    const excludedFields = new Set<string>();

    (exclusions || []).forEach((ex) => {
      if (!ex.field) {
        excludedCompanies.add(ex.company_id);
      } else {
        excludedFields.add(`${ex.company_id}:${ex.field}`);
      }
    });

    // Build company name lookup
    const companyNames: Record<string, string> = {};
    limitedCompanies.forEach((company) => {
      companyNames[company.id] = company.properties.name || company.id;
    });

    // Transform to preview format and filter exclusions
    const preview: PreviewRecord[] = changes
      .filter((change) => {
        if (excludedCompanies.has(change.hubspotRecordId)) return false;
        if (excludedFields.has(`${change.hubspotRecordId}:${change.field}`)) return false;
        return true;
      })
      .map((change) => ({
        company: companyNames[change.hubspotRecordId] || change.hubspotRecordId,
        field: change.field,
        before: change.before,
        beforeDisplay: change.beforeDisplay,
        after: change.after,
        hubspotCompanyId: change.hubspotRecordId,
        portalId: connection.portal_id,
        matchType: change.matchType,
        confidence: change.confidence,
        requiresReview: change.requiresReview,
        excludable: true,
      }));
    console.log(`[Normalize Preview] Filter and transform: ${Date.now() - filterStart}ms`);

    // Calculate summary stats
    const summary = {
      total: preview.length,
      fuzzy: preview.filter((p) => p.matchType === 'fuzzy').length,
      phonetic: preview.filter((p) => p.matchType === 'phonetic').length,
      exact: preview.filter((p) => p.matchType === 'exact').length,
    };

    const totalTime = Date.now() - startTime;
    console.log(`[Normalize Preview] Summary:`, summary);
    console.log(`[Normalize Preview] ========== REQUEST COMPLETE: ${totalTime}ms ==========`);

    return NextResponse.json({ preview, summary });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('[Normalize Preview] ========== UNEXPECTED ERROR ==========');
    console.error('[Normalize Preview] Unexpected error:', error);
    console.error('[Normalize Preview] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      orgId: ctx?.orgId,
      objectType: new URL(request.url).searchParams.get('objectType') ?? 'company',
      totalTime: `${totalTime}ms`
    });
    captureWithOrgContext(error, ctx?.orgId || 'unknown', {
      route: '/api/normalize/preview',
      step: 'unexpected_error',
      totalTime
    });
    return NextResponse.json(
      {
        error: 'Failed to get preview',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
