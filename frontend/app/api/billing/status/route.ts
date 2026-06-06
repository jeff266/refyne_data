import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getEntitlements } from '@/lib/billing/entitlements';
import { supabaseAdmin } from '@/lib/db/admin-client';

/**
 * GET /api/billing/status
 *
 * Returns comprehensive billing status for the current organization.
 * Includes entitlements, usage, and recent billing events.
 *
 * Auth: Requires authenticated user
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    // Get entitlements (from org_entitlements VIEW)
    const entitlements = await getEntitlements(ctx.orgId);

    // Get recent billing events
    const { data: events, error: eventsError } = await supabaseAdmin
      .from('org_billing_events')
      .select('*')
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (eventsError) {
      console.error('[Billing Status] Failed to fetch events:', eventsError);
    }

    // If no org_billing row exists, return trial defaults
    if (!entitlements) {
      return NextResponse.json({
        subscription_tier: 'trial',
        subscription_status: 'active',
        trial_days_remaining: null,
        trial_merges_remaining: null,
        trial_normalize_remaining: null,
        trial_enrich_remaining: null,
        current_period_start: null,
        current_period_end: null,
        merges_last_30d: 0,
        normalize_writes_last_30d: 0,
        enrich_credits_last_30d: 0,
        events: events || [],
      });
    }

    // Return full entitlements + events
    return NextResponse.json({
      ...entitlements,
      events: events || [],
    });
  } catch (error) {
    console.error('[Billing Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing status' },
      { status: 500 }
    );
  }
}
