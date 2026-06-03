/**
 * Harmony Preview API
 *
 * GET /api/enrich/harmony-preview?objectType=company|contact
 *
 * Shows which harmonies will apply to selected fields during enrichment.
 * Uses proper two-step lookup: HubSpot property → canonical field → harmony.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

export async function GET(req: NextRequest) {
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

    // Get fields and objectType from query params
    const { searchParams } = new URL(req.url);
    const objectType = searchParams.get('objectType') ?? 'company';
    const fieldsParam = searchParams.get('fields');
    if (!fieldsParam) {
      return NextResponse.json({ fields: [] });
    }

    const hubspotProperties = fieldsParam.split(',').filter(Boolean);
    if (hubspotProperties.length === 0) {
      return NextResponse.json({ fields: [] });
    }

    // Get portal_id for field mapping lookup
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', ctx.orgId)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
    }

    const portalId = connection.portal_id;

    // Field labels by object type
    const companyFieldLabels: Record<string, string> = {
      industry: 'Industry',
      numberofemployees: 'Employee count',
      linkedin_company_page: 'LinkedIn URL',
      phone: 'Phone',
      domain: 'Domain',
      annualrevenue: 'Revenue',
    };

    const contactFieldLabels: Record<string, string> = {
      jobtitle: 'Job Title',
      company: 'Company',
      phone: 'Phone',
      mobilephone: 'Mobile Phone',
      linkedin: 'LinkedIn URL',
      city: 'City',
      state: 'State',
      country: 'Country',
      email: 'Email',
    };

    const fieldLabels = objectType === 'contact' ? contactFieldLabels : companyFieldLabels;

    // Build response for each HubSpot property
    const fields = await Promise.all(
      hubspotProperties.map(async (hubspotProperty) => {
        const harmony = await getHarmonyForHubSpotProperty(
          ctx.orgId,
          portalId,
          objectType,
          hubspotProperty
        );

        if (!harmony) {
          return {
            field_key: hubspotProperty,
            field_label: fieldLabels[hubspotProperty] || hubspotProperty,
            harmony: null,
          };
        }

        // Determine if harmony will apply during enrichment
        // Reference list harmonies apply to incoming values
        // Normalization harmonies (Company Name, Domain) apply to existing values only
        const isNormalizationHarmony = ['name', 'domain'].includes(harmony.canonical_field);
        const willApply = !isNormalizationHarmony;

        // Get example from reference data
        let referenceData = null;
        if (supabase) {
          const { data } = await supabase
            .from('harmony_reference_data')
            .select('raw_value, normalized_value')
            .eq('harmony_id', harmony.id)
            .limit(1)
            .single();
          referenceData = data;
        }

        let reason = '';
        if (willApply) {
          reason = 'Maps raw provider values to your canonical taxonomy.';
        } else {
          reason = 'Not applied during enrichment (normalizes existing values, not incoming ones).';
        }

        return {
          field_key: hubspotProperty,
          field_label: fieldLabels[hubspotProperty] || hubspotProperty,
          harmony: {
            id: harmony.id,
            name: harmony.name,
            approach: harmony.transform_type || 'lookup',
            will_apply: willApply,
            reason,
            example_input: referenceData?.raw_value || null,
            example_output: referenceData?.normalized_value || null,
          },
        };
      })
    );

    return NextResponse.json({ fields });
  } catch (error) {
    console.error('[Harmony Preview] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get harmony preview',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Clean two-step lookup: HubSpot property → canonical field → harmony
 * No fuzzy matching. Uses explicit field_mappings table.
 */
async function getHarmonyForHubSpotProperty(
  orgId: string,
  portalId: string,
  objectType: string,
  hubspotProperty: string
): Promise<any | null> {
  if (!supabase) return null;

  // Step 1: HubSpot property → Refyne canonical field
  const { data: mapping } = await supabase
    .from('field_mappings')
    .select('canonical_field')
    .eq('org_id', orgId)
    .eq('portal_id', portalId)
    .eq('object_type', objectType)
    .eq('hubspot_property', hubspotProperty)
    .maybeSingle();

  if (!mapping) {
    console.log(`[Harmony Preview] No field mapping for ${hubspotProperty}`);
    return null;
  }

  const canonicalField = mapping.canonical_field;

  // Step 2: Refyne canonical field → active harmony
  const { data: harmony } = await supabase
    .from('harmonies')
    .select('*')
    .eq('field', canonicalField)
    .eq('is_active', true)
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .maybeSingle();

  if (!harmony) {
    console.log(`[Harmony Preview] No harmony for canonical field ${canonicalField}`);
    return null;
  }

  // Add canonical_field to result for normalization check
  return { ...harmony, canonical_field: canonicalField };
}
