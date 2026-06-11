import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireRefyneStaff } from '@/lib/auth/staff-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { z } from 'zod';

const UpdateBillingSchema = z.object({
  subscription_tier: z
    .enum(['trial', 'starter', 'growth', 'scale', 'exempt'])
    .optional(),
  subscription_status: z
    .enum(['active', 'past_due', 'canceled', 'trialing'])
    .optional(),
  trial_end_date: z.string().datetime().optional(),
  reset_trial_usage: z.boolean().optional(),
  add_enrich_credits: z.number().int().min(0).max(10000).optional(),
  note: z.string().max(500).optional(),
});

/**
 * GET /api/admin/workspaces/[orgId]/billing
 *
 * Returns org_billing row for workspace
 * Staff only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Staff check
  try {
    await requireRefyneStaff(ctx.userId);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('org_billing')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error) {
      console.error('[Admin Billing] Fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch billing' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Billing record not found' }, { status: 404 });
    }

    return NextResponse.json({ billing: data });
  } catch (error) {
    console.error('[Admin Billing] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/workspaces/[orgId]/billing
 *
 * Update workspace billing configuration
 * Staff only - all changes logged to admin_audit_log
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Staff check
  try {
    await requireRefyneStaff(ctx.userId);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse and validate body
  let body;
  try {
    const rawBody = await request.json();
    body = UpdateBillingSchema.parse(rawBody);
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body', details: error },
      { status: 400 }
    );
  }

  try {
    // Fetch current billing state
    const { data: currentBilling, error: fetchError } = await supabaseAdmin
      .from('org_billing')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (fetchError || !currentBilling) {
      return NextResponse.json({ error: 'Billing record not found' }, { status: 404 });
    }

    // Build update object
    const updates: Record<string, any> = {};
    let action = 'update_billing';

    if (body.subscription_tier !== undefined) {
      updates.subscription_tier = body.subscription_tier;
      action = 'change_plan';
    }

    if (body.subscription_status !== undefined) {
      updates.subscription_status = body.subscription_status;
      if (action === 'update_billing') action = 'change_status';
    }

    if (body.trial_end_date !== undefined) {
      updates.trial_end_date = body.trial_end_date;
      action = 'extend_trial';
    }

    if (body.reset_trial_usage) {
      updates.trial_merges_used = 0;
      updates.trial_normalize_writes_used = 0;
      updates.trial_enrich_credits_used = 0;
      action = 'reset_trial_usage';
    }

    if (body.add_enrich_credits !== undefined && body.add_enrich_credits > 0) {
      const currentLimit = currentBilling.pro_monthly_enrich_credits || 0;
      updates.pro_monthly_enrich_credits = currentLimit + body.add_enrich_credits;
      action = 'add_credits';
    }

    // Update billing record
    const { data: updatedBilling, error: updateError } = await supabaseAdmin
      .from('org_billing')
      .update(updates)
      .eq('org_id', orgId)
      .select()
      .single();

    if (updateError) {
      console.error('[Admin Billing] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update billing' }, { status: 500 });
    }

    // If subscription_tier changed to non-trial, enable always_on feature flag
    if (
      body.subscription_tier &&
      body.subscription_tier !== 'trial' &&
      currentBilling.subscription_tier === 'trial'
    ) {
      await supabaseAdmin
        .from('org_feature_flags')
        .upsert(
          {
            org_id: orgId,
            flag: 'always_on',
            enabled: true,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'org_id,flag',
          }
        );
    }

    // Log to audit trail
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_user_id: ctx.userId,
      target_org_id: orgId,
      action,
      before_state: currentBilling,
      after_state: updates,
      note: body.note || null,
    });

    return NextResponse.json({ billing: updatedBilling });
  } catch (error) {
    console.error('[Admin Billing] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
