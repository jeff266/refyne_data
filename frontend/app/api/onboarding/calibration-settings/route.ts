import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * GET /api/onboarding/calibration-settings
 *
 * Returns current calibration settings to pre-fill the wizard in "recalibrate" mode.
 * Auth: getOrgContext() - anyone can view settings (no admin requirement)
 *
 * Response shape matches the wizard answer shape (same as POST body):
 * {
 *   normalization_mode: 'implicit' | 'explicit',
 *   phone: { format, default_country_code },
 *   company_name: { casing, suffix_treatment },
 *   url: { format, strip_paths },
 *   country: { format },
 *   state: { format },
 *   industry?: { normalize, target },
 *   employee_count?: { format },
 *   linkedin?: { normalize }
 * }
 */
export async function GET() {
  // Auth check - no admin requirement, anyone in org can view settings
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { orgId } = ctx;

    // 1. Fetch normalization mode
    const { data: normSettings, error: normError } = await supabaseAdmin
      .from('normalization_settings')
      .select('mode')
      .eq('org_id', orgId)
      .single();

    // If no settings exist yet, return 404
    if (normError && normError.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'No calibration settings found. Please complete initial setup.' },
        { status: 404 }
      );
    }

    if (normError) {
      captureWithOrgContext(normError, orgId, { route: '/api/onboarding/calibration-settings' });
      console.error('Failed to fetch normalization settings:', normError);
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }

    // 2. Fetch transform configs from harmonies for specific fields
    const harmonyIds = [
      'phone',
      'contact-phone-e164',
      'company-name',
      'company-domain',
      'country',
      'state',
      'company-industry',
      'company-employees',
      'linkedin',
    ];

    interface HarmonyRow {
      id: string;
      transform_config: Record<string, any> | null;
      transform_function: string | null;
    }

    const { data: harmonies, error: harmoniesError } = await supabaseAdmin
      .from('harmonies')
      .select('id, transform_config, transform_function')
      .in('id', harmonyIds)
      .or(`org_id.is.null,org_id.eq.${orgId}`);

    if (harmoniesError) {
      captureWithOrgContext(harmoniesError, orgId, { route: '/api/onboarding/calibration-settings' });
      console.error('Failed to fetch harmonies:', harmoniesError);
      return NextResponse.json(
        { error: 'Failed to fetch harmony configurations' },
        { status: 500 }
      );
    }

    // 3. Build settings map from harmonies
    const harmoniesMap = new Map<string, HarmonyRow>(
      ((harmonies || []) as HarmonyRow[]).map(h => [h.id, h])
    );

    // Helper to get harmony config with fallback
    const getConfig = (id: string, fallback: Record<string, any> = {}): Record<string, any> => {
      const harmony = harmoniesMap.get(id);
      return harmony?.transform_config || fallback;
    };

    // 4. Map to wizard answer shape with sensible defaults

    // Phone settings
    const phoneConfig = getConfig('phone', { default_country_code: '1' });
    const phoneFormat = phoneConfig.format || 'e164_international'; // default format

    // Company name settings
    const companyNameConfig = getConfig('company-name', {});
    const casing = companyNameConfig.casing || 'title';
    const suffixTreatment = companyNameConfig.suffix_treatment || 'abbreviate';

    // URL/Domain settings
    const domainConfig = getConfig('company-domain', {});
    const urlFormat = domainConfig.format || 'canonical_no_www';
    const stripPaths = domainConfig.strip_paths ?? true;

    // Country settings
    const countryConfig = getConfig('country', {});
    const countryFormat = countryConfig.format || 'full_name';

    // State settings
    const stateConfig = getConfig('state', {});
    const stateFormat = stateConfig.format || 'full_name';

    // Industry settings (optional)
    const industryHarmony = harmoniesMap.get('company-industry');
    const industryConfig = getConfig('company-industry', {});
    const industryNormalize = industryHarmony?.transform_function === 'taxonomy_lookup';
    const industryTarget = industryConfig.target || 'hubspot_standard';

    // Employee count settings (optional)
    const employeeConfig = getConfig('company-employees', {});
    const employeeFormat = employeeConfig.format || 'range';

    // LinkedIn settings (optional)
    const linkedinHarmony = harmoniesMap.get('linkedin');
    const linkedinNormalize = linkedinHarmony?.transform_function === 'url_canonical';

    const response = {
      normalization_mode: normSettings.mode as 'implicit' | 'explicit',
      phone: {
        format: phoneFormat,
        default_country_code: phoneConfig.default_country_code || '1',
      },
      company_name: {
        casing,
        suffix_treatment: suffixTreatment,
      },
      url: {
        format: urlFormat,
        strip_paths: stripPaths,
      },
      country: {
        format: countryFormat,
      },
      state: {
        format: stateFormat,
      },
      // Optional fields - only include if configured
      ...(industryHarmony && {
        industry: {
          normalize: industryNormalize,
          target: industryTarget,
        },
      }),
      ...(employeeConfig && Object.keys(employeeConfig).length > 0 && {
        employee_count: {
          format: employeeFormat,
        },
      }),
      ...(linkedinHarmony && {
        linkedin: {
          normalize: linkedinNormalize,
        },
      }),
    };

    return NextResponse.json(response);

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/onboarding/calibration-settings' });
    console.error('Failed to get calibration settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
