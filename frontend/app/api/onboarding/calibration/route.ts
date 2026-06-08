import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * POST /api/onboarding/calibration
 *
 * Handles the final step of the calibration wizard.
 * Updates normalization settings and harmony configurations.
 *
 * Auth: requireAdmin()
 */

interface CalibrationRequestBody {
  normalization_mode: 'implicit' | 'explicit';
  phone: {
    format: 'e164_international' | 'national' | 'e164_compact' | 'e164_formatted';
    default_country_code: string; // e.g. 'US', 'GB'
  };
  company_name: {
    casing: 'title' | 'upper' | 'preserve';
    suffix_treatment: 'expand' | 'abbreviate' | 'remove' | 'preserve';
  };
  url: {
    format: 'canonical_no_www' | 'canonical_www' | 'domain_only';
    strip_paths: boolean;
  };
  country: {
    format: 'full_name' | 'iso2' | 'iso3';
  };
  state: {
    format: 'full_name' | 'abbreviation';
  };
  // Optional fields
  industry?: {
    normalize: boolean;
    target: 'hubspot_standard' | 'naics' | null;
  };
  employee_count?: {
    format: 'range' | 'exact' | 'preserve';
  };
  linkedin?: {
    normalize: boolean;
  };
}

// Mapping of calibration settings to harmony IDs
const HARMONY_MAPPINGS = {
  phone: 'phone',
  company_name: 'company-name',
  url: 'company-domain',
  country: 'address-country',
  state: 'address-state',
  industry: 'company-industry',
  employee_count: 'company-employees',
  linkedin: 'linkedin-url',
} as const;

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = (await request.json()) as CalibrationRequestBody;

    // Validate request body
    if (!body.normalization_mode || !['implicit', 'explicit'].includes(body.normalization_mode)) {
      return NextResponse.json(
        { error: 'Invalid normalization_mode. Must be "implicit" or "explicit"' },
        { status: 400 }
      );
    }

    if (!body.phone || !body.company_name || !body.url || !body.country || !body.state) {
      return NextResponse.json(
        { error: 'Missing required fields: phone, company_name, url, country, state' },
        { status: 400 }
      );
    }

    console.log('[Calibration] Starting calibration for org:', ctx.orgId);

    const harmoniesConfigured: string[] = [];

    // 1. Upsert normalization_settings
    const { error: settingsError } = await supabaseAdmin
      .from('normalization_settings')
      .upsert(
        {
          org_id: ctx.orgId,
          mode: body.normalization_mode,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'org_id',
        }
      );

    if (settingsError) {
      console.error('[Calibration] Failed to upsert normalization_settings:', settingsError);
      captureWithOrgContext(settingsError, ctx.orgId, {
        route: '/api/onboarding/calibration',
        step: 'normalization_settings',
      });
      return NextResponse.json(
        { error: 'Failed to update normalization settings' },
        { status: 500 }
      );
    }

    console.log('[Calibration] Updated normalization_settings:', body.normalization_mode);

    // 2. Update transform_config on global harmonies
    // Note: These are global presets (org_id=NULL) that apply system-wide.
    // The calibration settings configure how these harmonies behave.
    const harmonyUpdates: Array<{ harmonyId: string; config: any }> = [];

    // Phone harmony
    harmonyUpdates.push({
      harmonyId: HARMONY_MAPPINGS.phone,
      config: {
        format: body.phone.format,
        default_country_code: body.phone.default_country_code,
        strip_extensions: true,
      },
    });

    // Company name harmony
    harmonyUpdates.push({
      harmonyId: HARMONY_MAPPINGS.company_name,
      config: {
        casing: body.company_name.casing,
        suffix_treatment: body.company_name.suffix_treatment,
      },
    });

    // Company domain harmony
    harmonyUpdates.push({
      harmonyId: HARMONY_MAPPINGS.url,
      config: {
        format: body.url.format,
        strip_paths: body.url.strip_paths,
      },
    });

    // Country harmony
    harmonyUpdates.push({
      harmonyId: HARMONY_MAPPINGS.country,
      config: {
        format: body.country.format,
      },
    });

    // State harmony
    harmonyUpdates.push({
      harmonyId: HARMONY_MAPPINGS.state,
      config: {
        format: body.state.format,
      },
    });

    // Optional: Industry harmony
    if (body.industry) {
      harmonyUpdates.push({
        harmonyId: HARMONY_MAPPINGS.industry,
        config: {
          normalize: body.industry.normalize,
          target: body.industry.target,
        },
      });
    }

    // Optional: Employee count harmony
    if (body.employee_count) {
      harmonyUpdates.push({
        harmonyId: HARMONY_MAPPINGS.employee_count,
        config: {
          format: body.employee_count.format,
        },
      });
    }

    // Optional: LinkedIn harmony
    if (body.linkedin) {
      harmonyUpdates.push({
        harmonyId: HARMONY_MAPPINGS.linkedin,
        config: {
          normalize: body.linkedin.normalize,
        },
      });
    }

    // Execute harmony updates on global presets
    for (const update of harmonyUpdates) {
      const { error: harmonyError } = await supabaseAdmin
        .from('harmonies')
        .update({
          transform_config: update.config,
          updated_at: new Date().toISOString(),
        })
        .eq('id', update.harmonyId)
        .is('org_id', null); // Update global preset only

      if (harmonyError) {
        console.error(
          `[Calibration] Failed to update harmony ${update.harmonyId}:`,
          harmonyError
        );
        captureWithOrgContext(harmonyError, ctx.orgId, {
          route: '/api/onboarding/calibration',
          step: 'harmony_update',
          harmonyId: update.harmonyId,
        });
        // Continue with other harmonies instead of failing completely
      } else {
        harmoniesConfigured.push(update.harmonyId);
        console.log(`[Calibration] Updated harmony ${update.harmonyId}:`, update.config);
      }
    }

    // 3. Activate harmony_field_assignments
    // Get global defaults (org_id = NULL) as template
    const { data: globalAssignments, error: globalError } = await supabaseAdmin
      .from('harmony_field_assignments')
      .select('*')
      .is('org_id', null)
      .in('harmony_id', harmoniesConfigured);

    if (globalError) {
      console.error('[Calibration] Failed to fetch global assignments:', globalError);
      captureWithOrgContext(globalError, ctx.orgId, {
        route: '/api/onboarding/calibration',
        step: 'fetch_global_assignments',
      });
    } else if (globalAssignments && globalAssignments.length > 0) {
      // Check which assignments already exist for this org
      const { data: existingAssignments, error: existingError } = await supabaseAdmin
        .from('harmony_field_assignments')
        .select('harmony_id')
        .eq('org_id', ctx.orgId)
        .in('harmony_id', harmoniesConfigured);

      if (existingError) {
        console.error('[Calibration] Failed to fetch existing assignments:', existingError);
        captureWithOrgContext(existingError, ctx.orgId, {
          route: '/api/onboarding/calibration',
          step: 'fetch_existing_assignments',
        });
      } else {
        const existingHarmonyIds = new Set(
          existingAssignments?.map((a) => a.harmony_id) || []
        );

        // Create assignments for harmonies that don't have them yet
        const assignmentsToCreate = globalAssignments
          .filter((a) => !existingHarmonyIds.has(a.harmony_id))
          .map((a) => ({
            org_id: ctx.orgId,
            harmony_id: a.harmony_id,
            object_type: a.object_type,
            canonical_field: a.canonical_field,
            hubspot_property: a.hubspot_property,
            output_format: a.output_format,
            is_active: true,
            priority: a.priority,
          }));

        if (assignmentsToCreate.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from('harmony_field_assignments')
            .insert(assignmentsToCreate);

          if (insertError) {
            console.error('[Calibration] Failed to create field assignments:', insertError);
            captureWithOrgContext(insertError, ctx.orgId, {
              route: '/api/onboarding/calibration',
              step: 'create_field_assignments',
            });
          } else {
            console.log(
              `[Calibration] Created ${assignmentsToCreate.length} field assignments`
            );
          }
        } else {
          console.log('[Calibration] All field assignments already exist');
        }
      }
    }

    // 4. Mark calibration complete in onboarding_progress
    const { error: onboardingError } = await supabaseAdmin
      .from('onboarding_progress')
      .upsert(
        {
          org_id: ctx.orgId,
          calibration_completed: true,
          calibration_completed_at: new Date().toISOString(),
        },
        {
          onConflict: 'org_id',
        }
      );

    if (onboardingError) {
      console.error('[Calibration] Failed to update onboarding_progress:', onboardingError);
      captureWithOrgContext(onboardingError, ctx.orgId, {
        route: '/api/onboarding/calibration',
        step: 'onboarding_progress',
      });
      // Don't fail the request since the main work is done
    }

    console.log('[Calibration] Calibration completed successfully');

    // 5. Return success response
    return NextResponse.json({
      success: true,
      harmonies_configured: harmoniesConfigured,
      mode: body.normalization_mode,
    });
  } catch (error) {
    console.error('[Calibration] Unexpected error:', error);
    captureWithOrgContext(error, ctx.orgId, {
      route: '/api/onboarding/calibration',
    });
    return NextResponse.json(
      { error: 'Failed to complete calibration' },
      { status: 500 }
    );
  }
}
