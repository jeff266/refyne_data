import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { supabaseAdmin } from '@/lib/db/admin-client';

/**
 * POST /api/admin/orgs/[orgId]/plan
 *
 * Set or clear plan override for an org.
 * Plan override takes precedence over Stripe subscription.
 *
 * Auth: Requires super admin
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    await requireSuperAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  try {
    const { plan, reason } = await req.json();
    const { orgId } = params;

    // Validate input
    if (plan && !['growth', 'scale', 'enterprise'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be growth, scale, enterprise, or null' },
        { status: 400 }
      );
    }

    if (plan && !reason) {
      return NextResponse.json(
        { error: 'Reason is required when setting plan override' },
        { status: 400 }
      );
    }

    // Get or create org_billing record
    let { data: orgBilling } = await supabaseAdmin
      .from('org_billing')
      .select('org_id')
      .eq('org_id', orgId)
      .single();

    if (!orgBilling) {
      // Create org_billing if it doesn't exist
      const { error: insertError } = await supabaseAdmin
        .from('org_billing')
        .insert({
          org_id: orgId,
          subscription_tier: 'trial',
          subscription_status: 'active',
        });

      if (insertError) {
        console.error('[POST /api/admin/orgs/plan] Failed to create org_billing:', insertError);
        return NextResponse.json(
          { error: 'Failed to initialize billing record' },
          { status: 500 }
        );
      }
    }

    // Update plan override
    const { data, error } = await supabaseAdmin
      .from('org_billing')
      .update({
        plan_override: plan || null,
        plan_override_reason: plan ? reason : null,
        plan_override_set_at: plan ? new Date().toISOString() : null,
      })
      .eq('org_id', orgId)
      .select('org_id, plan_override, plan_override_reason, plan_override_set_at')
      .single();

    if (error) {
      console.error('[POST /api/admin/orgs/plan] Error:', error);
      return NextResponse.json(
        { error: 'Failed to update plan override' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      org: data,
    });
  } catch (error) {
    console.error('[POST /api/admin/orgs/plan] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
