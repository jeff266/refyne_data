import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/billing/record-count
 *
 * Fetch the latest HubSpot record count for the authenticated org.
 *
 * Response:
 * {
 *   recordCount: {
 *     companyCount: number;
 *     contactCount: number;
 *     totalRecords: number;
 *     suggestedPlan: string;
 *     fetchedAt: string;
 *   } | null;
 * }
 */
export async function GET(req: NextRequest) {
  // 1. Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // 2. Fetch latest record count for org
  const { data: recordCount, error } = await supabaseAdmin
    .from('hubspot_record_counts')
    .select('company_count, contact_count, total_records, suggested_plan, fetched_at, is_near_limit, is_over_limit, grace_period_ends_at, grace_period_expired')
    .eq('org_id', ctx.orgId)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[RecordCount API] Failed to fetch record count:', error);
    return NextResponse.json({ error: 'Failed to fetch record count' }, { status: 500 });
  }

  if (!recordCount) {
    return NextResponse.json({ recordCount: null });
  }

  // Get current plan and plan limit
  const { getOrgPlan } = await import('@/lib/billing/get-org-plan');
  const { getRecordLimit } = await import('@/lib/billing/plan-features');

  const currentPlan = await getOrgPlan(ctx.orgId);
  const planLimit = currentPlan ? getRecordLimit(currentPlan) : null;

  return NextResponse.json({
    recordCount: {
      companyCount: recordCount.company_count,
      contactCount: recordCount.contact_count,
      totalRecords: recordCount.total_records,
      suggestedPlan: recordCount.suggested_plan,
      fetchedAt: recordCount.fetched_at,
      isNearLimit: recordCount.is_near_limit,
      isOverLimit: recordCount.is_over_limit,
      gracePeriodEndsAt: recordCount.grace_period_ends_at,
      gracePeriodExpired: recordCount.grace_period_expired,
      currentPlan,
      planLimit,
    },
  });
}
