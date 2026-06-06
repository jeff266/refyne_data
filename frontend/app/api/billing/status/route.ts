import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';

/**
 * GET /api/billing/status
 *
 * Returns billing status for the current organization.
 * Queries org_entitlements VIEW + last 10 org_billing_events.
 *
 * Auth: any org member
 */
export async function GET(_request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const [entitlementsResult, eventsResult] = await Promise.all([
      supabaseAdmin
        .from('org_entitlements')
        .select('*')
        .eq('org_id', ctx.orgId)
        .single(),
      supabaseAdmin
        .from('org_billing_events')
        .select('id, event_type, metadata, created_at')
        .eq('org_id', ctx.orgId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const events = eventsResult.data ?? [];

    // No org_billing row yet - return trial defaults
    if (!entitlementsResult.data) {
      return NextResponse.json({
        subscription_tier: 'trial',
        subscription_status: 'active',
        stripe_customer_id: null,
        trial_days_remaining: null,
        trial_merges_used: 0,
        trial_normalize_writes_used: 0,
        trial_enrich_credits_used: 0,
        trial_merge_limit: 25,
        trial_normalize_limit: 100,
        trial_enrich_limit: 50,
        merges_last_30d: 0,
        normalize_writes_last_30d: 0,
        enrich_credits_last_30d: 0,
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
        events: [],
      });
    }

    const e = entitlementsResult.data;
    return NextResponse.json({
      subscription_tier: e.subscription_tier,
      subscription_status: e.subscription_status,
      stripe_customer_id: e.stripe_customer_id ?? null,
      trial_days_remaining: e.trial_days_remaining,
      trial_merges_used: e.trial_merges_used,
      trial_normalize_writes_used: e.trial_normalize_writes_used,
      trial_enrich_credits_used: e.trial_enrich_credits_used,
      trial_merge_limit: e.trial_merge_limit,
      trial_normalize_limit: e.trial_normalize_limit,
      trial_enrich_limit: e.trial_enrich_limit,
      merges_last_30d: e.merges_last_30d,
      normalize_writes_last_30d: e.normalize_writes_last_30d,
      enrich_credits_last_30d: e.enrich_credits_last_30d,
      current_period_start: e.current_period_start,
      current_period_end: e.current_period_end,
      cancel_at_period_end: e.cancel_at_period_end,
      events,
    });
  } catch (error) {
    console.error('[Billing Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing status' },
      { status: 500 }
    );
  }
}
