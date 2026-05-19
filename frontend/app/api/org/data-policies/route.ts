import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

export interface DataPolicies {
  existingValuePolicy: 'fill_gaps' | 'overwrite_always' | 'overwrite_if_stale';
  overwriteStaleDays: number;
  conflictResolution: 'first_wins' | 'highest_confidence' | 'manual_review';
  dedupPreflight: boolean;
}

/**
 * GET /api/org/data-policies
 *
 * Returns current data write behavior policies for the org.
 * Auth: any role
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from('workspace_entitlements')
      .select('existing_value_policy, overwrite_stale_days, conflict_resolution, dedup_preflight')
      .eq('org_id', ctx.orgId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Failed to fetch policies' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      existingValuePolicy: data.existing_value_policy,
      overwriteStaleDays: data.overwrite_stale_days,
      conflictResolution: data.conflict_resolution,
      dedupPreflight: data.dedup_preflight,
    });
  } catch (error) {
    console.error('[Data Policies] GET error:', error);
    captureWithOrgContext(error, ctx.orgId, { route: '/api/org/data-policies' });
    return NextResponse.json(
      { error: 'Failed to fetch policies' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/org/data-policies
 *
 * Updates data write behavior policies.
 * Auth: org:admin only
 */
export async function PUT(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const updates: Partial<{
      existing_value_policy: string;
      overwrite_stale_days: number;
      conflict_resolution: string;
      dedup_preflight: boolean;
    }> = {};

    if (body.existingValuePolicy !== undefined) {
      updates.existing_value_policy = body.existingValuePolicy;
    }
    if (body.overwriteStaleDays !== undefined) {
      updates.overwrite_stale_days = body.overwriteStaleDays;
    }
    if (body.conflictResolution !== undefined) {
      updates.conflict_resolution = body.conflictResolution;
    }
    if (body.dedupPreflight !== undefined) {
      updates.dedup_preflight = body.dedupPreflight;
    }

    const { data, error } = await supabase
      .from('workspace_entitlements')
      .update(updates)
      .eq('org_id', ctx.orgId)
      .select('existing_value_policy, overwrite_stale_days, conflict_resolution, dedup_preflight')
      .single();

    if (error || !data) {
      console.error('[Data Policies] Update error:', error);
      return NextResponse.json(
        { error: 'Failed to update policies' },
        { status: 500 }
      );
    }

    // Log to org_events
    await supabase.from('org_events').insert({
      org_id: ctx.orgId,
      user_id: ctx.userId,
      action: 'policy_changed',
      metadata: { updates },
    });

    return NextResponse.json({
      policies: {
        existingValuePolicy: data.existing_value_policy,
        overwriteStaleDays: data.overwrite_stale_days,
        conflictResolution: data.conflict_resolution,
        dedupPreflight: data.dedup_preflight,
      },
    });
  } catch (error) {
    console.error('[Data Policies] PUT error:', error);
    captureWithOrgContext(error, ctx.orgId, { route: '/api/org/data-policies' });
    return NextResponse.json(
      { error: 'Failed to update policies' },
      { status: 500 }
    );
  }
}
