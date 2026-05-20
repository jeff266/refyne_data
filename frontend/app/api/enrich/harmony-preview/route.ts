/**
 * Harmony Preview API
 *
 * GET /api/enrich/harmony-preview
 *
 * Shows which harmonies will apply to selected fields during enrichment.
 * Returns harmony details with example input/output from reference data.
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

    // Get fields from query params
    const { searchParams } = new URL(req.url);
    const fieldsParam = searchParams.get('fields');
    if (!fieldsParam) {
      return NextResponse.json({ fields: [] });
    }

    const fieldKeys = fieldsParam.split(',').filter(Boolean);
    if (fieldKeys.length === 0) {
      return NextResponse.json({ fields: [] });
    }

    // Fetch active harmonies for these fields
    const { data: harmonies, error: harmoniesError } = await supabase
      .from('harmonies')
      .select('*')
      .in('field', fieldKeys)
      .eq('is_active', true)
      .or(`org_id.is.null,org_id.eq.${ctx.orgId}`);

    if (harmoniesError) {
      console.error('[Harmony Preview] Failed to fetch harmonies:', harmoniesError);
      return NextResponse.json({ error: 'Failed to fetch harmonies' }, { status: 500 });
    }

    // Fetch org-specific settings for preset harmonies
    const presetHarmonyIds = (harmonies || []).filter((h) => h.is_preset).map((h) => h.id);
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

    // Build field-to-harmony mapping
    const harmonyByField = new Map<string, any>();
    (harmonies || []).forEach((harmony) => {
      const orgSetting = orgSettingsMap.get(harmony.id);
      const effectiveOutputFormat = harmony.is_preset && orgSetting?.output_format
        ? orgSetting.output_format
        : harmony.output_format || 'default';

      harmonyByField.set(harmony.field, {
        ...harmony,
        output_format: effectiveOutputFormat,
      });
    });

    // Fetch example data from harmony_reference_data for each harmony
    const harmonyIds = Array.from(harmonyByField.values()).map((h) => h.id);
    const { data: referenceData } = harmonyIds.length > 0
      ? await supabase
          .from('harmony_reference_data')
          .select('harmony_id, raw_value, normalized_value')
          .in('harmony_id', harmonyIds)
          .limit(1)
      : { data: [] };

    const examplesByHarmonyId = new Map<string, { input: string; output: string }>();
    (referenceData || []).forEach((ref: any) => {
      if (!examplesByHarmonyId.has(ref.harmony_id)) {
        examplesByHarmonyId.set(ref.harmony_id, {
          input: ref.raw_value,
          output: ref.normalized_value,
        });
      }
    });

    // Build response for each field
    const fieldLabels: Record<string, string> = {
      industry: 'Industry',
      numberofemployees: 'Employee count',
      linkedin_company_page: 'LinkedIn URL',
      phone: 'Phone',
      domain: 'Domain',
      annualrevenue: 'Revenue',
    };

    const fields = fieldKeys.map((field_key) => {
      const harmony = harmonyByField.get(field_key);

      if (!harmony) {
        return {
          field_key,
          field_label: fieldLabels[field_key] || field_key,
          harmony: null,
        };
      }

      // Determine if harmony will apply during enrichment
      // Reference list harmonies apply to incoming values
      // Normalization harmonies (Company Name, Domain) apply to existing values only
      const isNormalizationHarmony = ['company_name', 'domain'].includes(harmony.field);
      const willApply = !isNormalizationHarmony;

      const example = examplesByHarmonyId.get(harmony.id);

      let reason = '';
      if (willApply) {
        reason = 'Maps raw provider values to your canonical taxonomy.';
      } else {
        reason = 'Not applied during enrichment (normalizes existing values, not incoming ones).';
      }

      return {
        field_key,
        field_label: fieldLabels[field_key] || field_key,
        harmony: {
          id: harmony.id,
          name: harmony.name,
          approach: harmony.transform_type || 'lookup',
          will_apply: willApply,
          reason,
          example_input: example?.input || null,
          example_output: example?.output || null,
        },
      };
    });

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
