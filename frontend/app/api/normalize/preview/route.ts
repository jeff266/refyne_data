import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { HubSpotClient } from '@/lib/hubspot/client';
import { runNormalizationPreview } from '@/lib/harmonies/normalization-engine';
import type { Harmony, HubSpotRecord } from '@/lib/harmonies/normalization-engine';
import { getFieldAssignments, buildFieldMap } from '@/lib/harmonies/field-assignments';

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
    const companyIdsParam = searchParams.get('companyIds');
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
    const objectType = (searchParams.get('objectType') ?? 'company') as 'company' | 'contact' | 'deal';

    // Get HubSpot connection
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', ctx.orgId)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      return NextResponse.json({ preview: [], summary: { total: 0, fuzzy: 0, phonetic: 0 } });
    }

    // Get access token
    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      console.error('[Normalize Preview] Failed to get HubSpot access token');
      return NextResponse.json({ preview: [], summary: { total: 0, fuzzy: 0, phonetic: 0 } });
    }

    // Fetch active harmonies for selected object type
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

    const { data: harmoniesData, error: harmoniesError } = await harmonyQuery;

    if (harmoniesError) {
      captureWithOrgContext(harmoniesError, ctx.orgId, { route: '/api/normalize/preview' });
      console.error('[Normalize Preview] Failed to fetch harmonies:', harmoniesError);
      return NextResponse.json({ error: 'Failed to fetch harmonies' }, { status: 500 });
    }

    if (!harmoniesData || harmoniesData.length === 0) {
      return NextResponse.json({ preview: [], summary: { total: 0, fuzzy: 0, phonetic: 0 } });
    }

    // Fetch org-specific settings for preset harmonies
    const presetHarmonyIds = harmoniesData.filter((h) => h.is_preset).map((h) => h.id);
    const { data: orgSettings } = presetHarmonyIds.length > 0
      ? await supabase
          .from('harmony_org_settings')
          .select('harmony_id, output_format')
          .eq('org_id', ctx.orgId)
          .in('harmony_id', presetHarmonyIds)
      : { data: [] };

    const orgSettingsMap = new Map(
      (orgSettings || []).map((s: any) => [s.harmony_id, s])
    );

    // Transform harmonies to engine format
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

    // Fetch field assignments for this org (replaces DEFAULT_FIELD_MAPPINGS)
    let fieldAssignments;
    try {
      fieldAssignments = await getFieldAssignments(ctx.orgId, objectType);
      console.log(`[Normalize Preview] Field assignments found: ${fieldAssignments.length}`);

      if (fieldAssignments.length === 0) {
        console.warn(`[Normalize Preview] No field assignments found for org ${ctx.orgId} and objectType ${objectType}`);
        return NextResponse.json({
          preview: [],
          summary: { total: 0, fuzzy: 0, phonetic: 0 },
          error: `No field assignments configured for ${objectType}. Please configure field mappings first.`
        }, { status: 400 });
      }
    } catch (assignmentError) {
      console.error('[Normalize Preview] Failed to fetch field assignments:', assignmentError);
      captureWithOrgContext(assignmentError, ctx.orgId, { route: '/api/normalize/preview', step: 'field_assignments' });
      return NextResponse.json({ error: 'Failed to fetch field assignments' }, { status: 500 });
    }

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

    // Fetch HubSpot companies
    const client = new HubSpotClient(accessToken, connection.portal_id);
    const properties = hubspotProperties;

    // Fetch companies - either specific IDs or paginated
    let limitedCompanies: any[] = [];

    try {
      if (companyIdsParam) {
        // Fetch specific companies by ID
        const companyIds = companyIdsParam.split(',').slice(0, limit);
        console.log(`[Normalize Preview] Fetching ${companyIds.length} specific companies`);
        limitedCompanies = await client.getCompaniesByIds(companyIds, properties);
      } else {
        // Fetch companies with pagination (existing behavior)
        const companies: any[] = [];
        for await (const batch of client.getAllCompanies(properties)) {
          companies.push(...batch);
          if (companies.length >= limit) break;
        }
        limitedCompanies = companies.slice(0, limit);
      }

      console.log(`[Normalize Preview] Fetched ${limitedCompanies.length} companies`);
    } catch (fetchError) {
      console.error('[Normalize Preview] Failed to fetch companies from HubSpot:', fetchError);
      captureWithOrgContext(fetchError, ctx.orgId, { route: '/api/normalize/preview', step: 'fetch_companies' });
      return NextResponse.json({ error: 'Failed to fetch companies from HubSpot' }, { status: 500 });
    }

    // Transform to HubSpotRecord format and map properties to canonical field names
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

    // Debug: Check what industry values we're working with
    console.log('[Normalize Preview] Industry values:',
      records.slice(0, 10).map(r => r.industry).filter(Boolean)
    );

    // Run normalization preview
    let changes;
    try {
      console.log(`[Normalize Preview] Running normalization with ${harmonies.length} harmonies on ${records.length} records`);
      changes = await runNormalizationPreview(records, harmonies, ctx.orgId);
      console.log(`[Normalize Preview] Generated ${changes.length} changes`);
    } catch (normError) {
      console.error('[Normalize Preview] Normalization engine error:', normError);
      console.error('[Normalize Preview] Error details:', {
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
    const { data: exclusions } = await supabase
      .from('normalize_exclusions')
      .select('company_id, field, exclusion_type, expires_at')
      .eq('org_id', ctx.orgId)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    // Build exclusion lookup sets
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

    // Calculate summary stats
    const summary = {
      total: preview.length,
      fuzzy: preview.filter((p) => p.matchType === 'fuzzy').length,
      phonetic: preview.filter((p) => p.matchType === 'phonetic').length,
      exact: preview.filter((p) => p.matchType === 'exact').length,
    };

    console.log(`[Normalize Preview] Summary:`, summary);

    return NextResponse.json({ preview, summary });
  } catch (error) {
    console.error('[Normalize Preview] Unexpected error:', error);
    console.error('[Normalize Preview] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      orgId: ctx?.orgId,
      objectType: new URL(request.url).searchParams.get('objectType') ?? 'company'
    });
    captureWithOrgContext(error, ctx?.orgId || 'unknown', {
      route: '/api/normalize/preview',
      step: 'unexpected_error'
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
