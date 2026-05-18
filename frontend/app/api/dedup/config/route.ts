import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import {
  rowToConfig,
  configUpdateToRow,
  type DedupConfigRow,
  type DedupConfigUpdate,
} from '@/lib/dedup/types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';

// Valid canonical fields for core_display_fields
const VALID_CORE_FIELDS = new Set([
  'name', 'domain', 'industry', 'phone', 'employees',
  'city', 'state', 'country', 'website', 'linkedin_url',
  'annual_revenue', 'description', 'founded_year',
]);

/**
 * GET /api/dedup/config
 *
 * Returns dedup config for the current org.
 * Creates default row if none exists (upsert behavior).
 */
export async function GET(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  // Feature gate: dedup
  try {
    await requireFeature(ctx.orgId, 'dedup');
  } catch (error) {
    const gateError = parseFeatureGateError(error);
    if (gateError) {
      return NextResponse.json(
        { error: 'feature_gated', feature: gateError.feature, currentPlan: gateError.currentPlan },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const orgId = ctx.orgId;

    // Try to get existing config
    const { data: existing, error: selectError } = await supabase
      .from('dedup_config')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (expected for new orgs)
      console.error('Failed to get dedup config:', selectError);
      return NextResponse.json(
        { error: 'Failed to get config' },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json({ config: rowToConfig(existing as DedupConfigRow) });
    }

    // Create default config
    const { data: created, error: insertError } = await supabase
      .from('dedup_config')
      .insert({ org_id: orgId })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create default dedup config:', insertError);
      return NextResponse.json(
        { error: 'Failed to create config' },
        { status: 500 }
      );
    }

    return NextResponse.json({ config: rowToConfig(created as DedupConfigRow) });
  } catch (error) {
    console.error('Failed to get dedup config:', error);
    return NextResponse.json(
      { error: 'Failed to get config' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/dedup/config
 *
 * Update dedup config for the current org.
 * Admin role only.
 */
export async function PUT(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  // Feature gate: dedup
  try {
    await requireFeature(ctx.orgId, 'dedup');
  } catch (error) {
    const gateError = parseFeatureGateError(error);
    if (gateError) {
      return NextResponse.json(
        { error: 'feature_gated', feature: gateError.feature, currentPlan: gateError.currentPlan },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const orgId = ctx.orgId;

    const body = await request.json() as DedupConfigUpdate;

    // Validate weight ranges (0.0-1.0)
    const weightFields = [
      'signalPhoneWeight', 'signalAddressWeight', 'signalNameWeight',
      'nameLevenshteinFloor', 'nameDivergenceFloor',
      'parentOneMultiplier', 'parentDifferentScore',
    ] as const;

    for (const field of weightFields) {
      if (body[field] !== undefined) {
        const value = body[field];
        if (typeof value !== 'number' || value < 0 || value > 1) {
          return NextResponse.json(
            { error: `${field} must be between 0.0 and 1.0`, field },
            { status: 400 }
          );
        }
      }
    }

    // Validate auto_merge_threshold (50-100)
    if (body.autoMergeThreshold !== undefined) {
      if (body.autoMergeThreshold < 50 || body.autoMergeThreshold > 100) {
        return NextResponse.json(
          { error: 'autoMergeThreshold must be between 50 and 100', field: 'autoMergeThreshold' },
          { status: 400 }
        );
      }
    }

    // Validate review_floor_threshold must be < auto_merge_threshold
    if (body.reviewFloorThreshold !== undefined) {
      // Get current auto_merge_threshold if not being updated
      let autoThreshold: number = body.autoMergeThreshold ?? 90;
      if (body.autoMergeThreshold === undefined) {
        const { data: current } = await supabase
          .from('dedup_config')
          .select('auto_merge_threshold')
          .eq('org_id', orgId)
          .single();
        autoThreshold = current?.auto_merge_threshold ?? 90;
      }

      if (body.reviewFloorThreshold >= autoThreshold) {
        return NextResponse.json(
          { error: 'reviewFloorThreshold must be less than autoMergeThreshold', field: 'reviewFloorThreshold' },
          { status: 400 }
        );
      }
    }

    // Validate core_display_fields (min 1 item, all must be valid)
    if (body.coreDisplayFields !== undefined) {
      if (!Array.isArray(body.coreDisplayFields) || body.coreDisplayFields.length < 1) {
        return NextResponse.json(
          { error: 'coreDisplayFields must have at least 1 field', field: 'coreDisplayFields' },
          { status: 400 }
        );
      }
      for (const field of body.coreDisplayFields) {
        if (!VALID_CORE_FIELDS.has(field)) {
          return NextResponse.json(
            { error: `Invalid field in coreDisplayFields: ${field}`, field: 'coreDisplayFields' },
            { status: 400 }
          );
        }
      }
    }

    // Validate rollback_window_hours (1-168)
    if (body.rollbackWindowHours !== undefined) {
      if (body.rollbackWindowHours < 1 || body.rollbackWindowHours > 168) {
        return NextResponse.json(
          { error: 'rollbackWindowHours must be between 1 and 168', field: 'rollbackWindowHours' },
          { status: 400 }
        );
      }
    }

    // Convert to database format
    const rowUpdate = configUpdateToRow(body);

    // Upsert the config
    const { data: updated, error: updateError } = await supabase
      .from('dedup_config')
      .upsert({
        org_id: orgId,
        ...rowUpdate,
      })
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update dedup config:', updateError);
      return NextResponse.json(
        { error: 'Failed to update config' },
        { status: 500 }
      );
    }

    return NextResponse.json({ config: rowToConfig(updated as DedupConfigRow) });
  } catch (error) {
    console.error('Failed to update dedup config:', error);
    return NextResponse.json(
      { error: 'Failed to update config' },
      { status: 500 }
    );
  }
}
