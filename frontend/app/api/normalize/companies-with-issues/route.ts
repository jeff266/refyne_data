/**
 * GET /api/normalize/companies-with-issues
 *
 * Returns company IDs that have non-canonical values for selected harmonies.
 * Used to filter normalize preview to companies that actually need normalization.
 *
 * Query params:
 *   - harmonyIds: comma-separated list of harmony IDs (e.g., "company-industry,phone-e164")
 *
 * Response:
 * {
 *   "companyIds": ["123", "456", "789"],
 *   "total": 847
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { HubSpotClient } from '@/lib/hubspot/client';
import { matchesCanonicalFormat } from '@/lib/normalize/issue-detector';
import type { Harmony } from '@/lib/harmonies/normalization-engine';

/**
 * Extract HubSpot property name from canonical field format.
 * 'company.industry' → 'industry'
 */
function extractPropertyName(field: string): string {
  if (field.includes('.')) {
    return field.split('.').pop() || field;
  }
  return field;
}

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

    if (!harmonyIdsParam) {
      return NextResponse.json({ companyIds: [], total: 0 });
    }

    const requestedHarmonyIds = harmonyIdsParam.split(',');

    // Get HubSpot connection
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', ctx.orgId)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      return NextResponse.json({ companyIds: [], total: 0 });
    }

    // Get access token
    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      console.error('[Companies with Issues] Failed to get HubSpot access token');
      return NextResponse.json({ companyIds: [], total: 0 });
    }

    const hubspot = new HubSpotClient(accessToken, connection.portal_id);

    // Fetch requested harmonies
    const { data: harmoniesData, error: harmoniesError } = await supabase
      .from('harmonies')
      .select('*')
      .eq('is_active', true)
      .in('id', requestedHarmonyIds)
      .or(`org_id.is.null,org_id.eq.${ctx.orgId}`);

    if (harmoniesError) {
      captureWithOrgContext(harmoniesError, ctx.orgId, { route: '/api/normalize/companies-with-issues' });
      console.error('[Companies with Issues] Failed to fetch harmonies:', harmoniesError);
      return NextResponse.json({ error: 'Failed to fetch harmonies' }, { status: 500 });
    }

    if (!harmoniesData || harmoniesData.length === 0) {
      return NextResponse.json({ companyIds: [], total: 0 });
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
        referenceTable: h.reference_table,
        fuzzyThreshold: h.fuzzy_threshold || 0.8,
        phoneticEnabled: h.phonetic_enabled || false,
        isActive: h.is_active,
        outputFormat: effectiveOutputFormat,
        outputFormatsAvailable: h.output_formats_available || [],
        isPreset: h.is_preset || false,
      };
    });

    console.log(`[Companies with Issues] Finding companies for ${harmonies.length} harmonies`);

    // Collect company IDs with issues (union across all harmonies)
    const companyIdsWithIssues = new Set<string>();

    for (const harmony of harmonies) {
      try {
        // For lookup harmonies, fetch canonical values
        if (harmony.transformType === 'lookup' && harmony.referenceTable) {
          const { data: referenceData } = await supabase
            .from('harmony_reference_data')
            .select('canonical_value')
            .eq('table_name', harmony.referenceTable)
            .eq('is_active', true)
            .or(`org_id.is.null,org_id.eq.${ctx.orgId}`);

          const canonicalValues = new Set(
            (referenceData || []).map(r => r.canonical_value.toLowerCase())
          );

          if (canonicalValues.size === 0) {
            console.warn(`[Companies with Issues] No canonical values for ${harmony.referenceTable}`);
            continue;
          }

          // Extract HubSpot property name
          const propertyName = extractPropertyName(harmony.field);

          // Fetch companies with this field set (wrapped in try/catch for HubSpot API errors)
          try {
            const companies = await hubspot.searchCompanies(
              [
                {
                  filters: [
                    {
                      propertyName,
                      operator: 'HAS_PROPERTY',
                    },
                  ],
                },
              ],
              [propertyName],
              100
            );

            // Add companies with non-canonical values
            for (const company of companies) {
              const value = company.properties[propertyName];
              if (value && !canonicalValues.has(value.toLowerCase())) {
                companyIdsWithIssues.add(company.id);
              }
            }
          } catch (searchErr) {
            console.warn(`[Companies with Issues] HubSpot search failed for ${harmony.id}:`, searchErr);
            // Skip this harmony and continue with others
            continue;
          }
        } else {
          // For format harmonies, fetch and validate
          // Extract HubSpot property name
          const propertyName = extractPropertyName(harmony.field);

          // Fetch companies with this field set (wrapped in try/catch for HubSpot API errors)
          try {
            const companies = await hubspot.searchCompanies(
              [
                {
                  filters: [
                    {
                      propertyName,
                      operator: 'HAS_PROPERTY',
                    },
                  ],
                },
              ],
              [propertyName],
              100
            );

            // Add companies with non-canonical format
            for (const company of companies) {
              const value = company.properties[propertyName];
              if (value && !matchesCanonicalFormat(harmony.id, value)) {
                companyIdsWithIssues.add(company.id);
              }
            }
          } catch (searchErr) {
            console.warn(`[Companies with Issues] HubSpot search failed for ${harmony.id}:`, searchErr);
            // Skip this harmony and continue with others
            continue;
          }
        }

        console.log(`[Companies with Issues] ${harmony.id}: ${companyIdsWithIssues.size} total issues so far`);
      } catch (err) {
        console.error(`[Companies with Issues] Failed to fetch issues for ${harmony.id}:`, err);
        // Continue with next harmony
      }
    }

    // Convert to array and cap at 100 for preview
    const companyIds = Array.from(companyIdsWithIssues).slice(0, 100);

    console.log(`[Companies with Issues] Found ${companyIdsWithIssues.size} companies, returning ${companyIds.length}`);

    return NextResponse.json({
      companyIds,
      total: companyIdsWithIssues.size,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/normalize/companies-with-issues' });
    console.error('[Companies with Issues] Error:', error);
    return NextResponse.json(
      { error: 'Failed to find companies with issues' },
      { status: 500 }
    );
  }
}
