/**
 * Feature Gate and Billing Context Helpers
 *
 * Provides feature access checking, credit metering, and billing context.
 */

import { supabase } from '@/lib/db/supabase';
import { canAccess, getPlanFeatures, Plan } from './plan-features';

export interface BillingContext {
  plan: Plan;
  status: string;
  alwaysOnAddon: boolean;
  creditsUsed: number;
  creditsLimit: number;
  trialEndsAt: Date | null;
  daysRemaining: number | null;
}

export async function getBillingContext(orgId: string): Promise<BillingContext> {
  if (!supabase) {
    throw new Error('Database not configured');
  }

  const { data } = await supabase
    .from('workspace_entitlements')
    .select(`plan, subscription_status, always_on_addon,
             enrich_credits_used, enrich_credits_limit,
             trial_ends_at`)
    .eq('org_id', orgId)
    .single();

  const now = new Date();
  const trialEndsAt = data?.trial_ends_at ? new Date(data.trial_ends_at) : null;
  const isTrialExpired =
    trialEndsAt && now > trialEndsAt && data?.subscription_status === 'trialing';

  const effectivePlan = isTrialExpired
    ? 'trial_expired'
    : ((data?.plan ?? 'trialing') as Plan);

  const daysRemaining =
    trialEndsAt && effectivePlan === 'trialing'
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000))
      : null;

  return {
    plan: effectivePlan,
    status: isTrialExpired ? 'trial_expired' : data?.subscription_status ?? 'trialing',
    alwaysOnAddon: data?.always_on_addon ?? false,
    creditsUsed: data?.enrich_credits_used ?? 0,
    creditsLimit: data?.enrich_credits_limit ?? 50,
    trialEndsAt,
    daysRemaining,
  };
}

export async function requireFeature(
  orgId: string,
  feature: keyof ReturnType<typeof getPlanFeatures>
): Promise<void> {
  const ctx = await getBillingContext(orgId);
  if (!canAccess(ctx.plan, ctx.alwaysOnAddon, feature)) {
    throw new Error(`FEATURE_GATED:${feature}:${ctx.plan}`);
  }
}

export function parseFeatureGateError(error: unknown): {
  feature: string;
  currentPlan: string;
} | null {
  if (error instanceof Error && error.message.startsWith('FEATURE_GATED:')) {
    const [, feature, plan] = error.message.split(':');
    return { feature, currentPlan: plan };
  }
  return null;
}

/**
 * Deduct enrich credit for Serper/GraphIQ usage.
 * BYOK (bring your own key) providers don't consume credits.
 */
export async function deductEnrichCredit(
  orgId: string,
  userId: string,
  action: string,
  provider: string,
  count = 1
): Promise<{ allowed: boolean; remaining: number }> {
  if (!supabase) {
    throw new Error('Database not configured');
  }

  const { data } = await supabase
    .from('workspace_entitlements')
    .select('enrich_credits_used, enrich_credits_limit')
    .eq('org_id', orgId)
    .single();

  const used = data?.enrich_credits_used ?? 0;
  const limit = data?.enrich_credits_limit ?? 50;

  if (used + count > limit) {
    return { allowed: false, remaining: Math.max(0, limit - used) };
  }

  const newUsed = used + count;
  await supabase
    .from('workspace_entitlements')
    .update({ enrich_credits_used: newUsed })
    .eq('org_id', orgId);

  // Fire and forget audit log
  void (async () => {
    try {
      await supabase
        .from('credit_transactions')
        .insert({
          org_id: orgId,
          user_id: userId,
          type: 'deduct',
          amount: count,
          action,
          provider,
          balance_after: limit - newUsed,
        });
    } catch (err) {
      console.error('Failed to log credit transaction:', err);
    }
  })();

  return { allowed: true, remaining: limit - newUsed };
}

/**
 * Reset credits at the start of a new billing period.
 * Called from Stripe webhook on invoice.payment_succeeded.
 */
export async function resetEnrichCredits(orgId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Database not configured');
  }

  const { data } = await supabase
    .from('workspace_entitlements')
    .select('enrich_credits_limit')
    .eq('org_id', orgId)
    .single();

  const limit = data?.enrich_credits_limit ?? 50;

  await supabase
    .from('workspace_entitlements')
    .update({
      enrich_credits_used: 0,
      credits_reset_at: new Date().toISOString(),
    })
    .eq('org_id', orgId);

  // Log reset transaction
  await supabase.from('credit_transactions').insert({
    org_id: orgId,
    user_id: null,
    type: 'reset',
    amount: 0,
    action: 'billing_period_reset',
    provider: null,
    balance_after: limit,
  });
}
