import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { supabaseAdmin } from '@/lib/db/admin-client';

/**
 * POST /api/admin/orgs/[orgId]/trial
 *
 * Extend trial period for an org.
 * Adds days to existing trial_ends_at.
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
    const { extend_days } = await req.json();
    const { orgId } = params;

    // Validate input
    if (typeof extend_days !== 'number' || extend_days <= 0) {
      return NextResponse.json(
        { error: 'extend_days must be a positive number' },
        { status: 400 }
      );
    }

    // Get current org_billing record
    const { data: orgBilling, error: fetchError } = await supabaseAdmin
      .from('org_billing')
      .select('org_id, trial_ends_at, trial_extended_by_days')
      .eq('org_id', orgId)
      .single();

    if (fetchError || !orgBilling) {
      return NextResponse.json(
        { error: 'Org billing record not found' },
        { status: 404 }
      );
    }

    // Calculate new trial end date
    const currentTrialEnds = orgBilling.trial_ends_at
      ? new Date(orgBilling.trial_ends_at)
      : new Date(); // If no trial_ends_at, start from now

    const newTrialEnds = new Date(currentTrialEnds);
    newTrialEnds.setDate(newTrialEnds.getDate() + extend_days);

    // Update trial
    const { data, error } = await supabaseAdmin
      .from('org_billing')
      .update({
        trial_ends_at: newTrialEnds.toISOString(),
        trial_extended_by_days: (orgBilling.trial_extended_by_days || 0) + extend_days,
      })
      .eq('org_id', orgId)
      .select('org_id, trial_ends_at, trial_extended_by_days')
      .single();

    if (error) {
      console.error('[POST /api/admin/orgs/trial] Error:', error);
      return NextResponse.json(
        { error: 'Failed to extend trial' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      org: data,
      extended_by_days: extend_days,
      new_trial_ends_at: data.trial_ends_at,
    });
  } catch (error) {
    console.error('[POST /api/admin/orgs/trial] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
