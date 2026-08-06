-- Migration 115: Fix org_entitlements view to respect plan_override
--
-- The org_entitlements view was returning raw subscription_tier,
-- ignoring the plan_override field added in migration 112.
-- This caused admin-comped accounts to still show trial banners.

CREATE OR REPLACE VIEW public.org_entitlements AS
SELECT
  ob.org_id,
  -- Use plan_override if set, otherwise fall back to subscription_tier
  COALESCE(ob.plan_override, ob.subscription_tier) AS subscription_tier,
  ob.subscription_status,

  -- Trial limits
  CASE WHEN COALESCE(ob.plan_override, ob.subscription_tier) = 'trial' THEN 25 ELSE NULL END AS trial_merge_limit,
  CASE WHEN COALESCE(ob.plan_override, ob.subscription_tier) = 'trial' THEN 100 ELSE NULL END AS trial_normalize_limit,
  CASE WHEN COALESCE(ob.plan_override, ob.subscription_tier) = 'trial' THEN 50 ELSE NULL END AS trial_enrich_limit,

  -- Trial usage
  ob.trial_merges_used,
  ob.trial_normalize_writes_used,
  ob.trial_enrich_credits_used,

  -- Trial remaining (null for non-trial tiers)
  CASE WHEN COALESCE(ob.plan_override, ob.subscription_tier) = 'trial' THEN 25 - ob.trial_merges_used ELSE NULL END AS trial_merges_remaining,
  CASE WHEN COALESCE(ob.plan_override, ob.subscription_tier) = 'trial' THEN 100 - ob.trial_normalize_writes_used ELSE NULL END AS trial_normalize_remaining,
  CASE WHEN COALESCE(ob.plan_override, ob.subscription_tier) = 'trial' THEN 50 - ob.trial_enrich_credits_used ELSE NULL END AS trial_enrich_remaining,

  -- Trial dates
  ob.trial_start_date,
  ob.trial_end_date,
  EXTRACT(EPOCH FROM (ob.trial_end_date - NOW())) / 86400 AS trial_days_remaining,

  -- Paid plan credits (legacy pro/enterprise columns retained for backward compatibility)
  ob.pro_monthly_enrich_credits,
  ob.enterprise_monthly_enrich_credits,

  -- Current period usage (last 30 days)
  COALESCE(SUM(ou.merges_executed) FILTER (WHERE ou.date >= CURRENT_DATE - INTERVAL '30 days'), 0) AS merges_last_30d,
  COALESCE(SUM(ou.normalize_writes) FILTER (WHERE ou.date >= CURRENT_DATE - INTERVAL '30 days'), 0) AS normalize_writes_last_30d,
  COALESCE(SUM(ou.enrich_credits_consumed) FILTER (WHERE ou.date >= CURRENT_DATE - INTERVAL '30 days'), 0) AS enrich_credits_last_30d,

  -- Period dates
  ob.current_period_start,
  ob.current_period_end,
  ob.cancel_at_period_end,

  ob.created_at,
  ob.updated_at
FROM org_billing ob
LEFT JOIN org_usage ou ON ob.org_id = ou.org_id
GROUP BY ob.org_id, ob.plan_override, ob.subscription_tier, ob.subscription_status,
         ob.trial_merges_used, ob.trial_normalize_writes_used, ob.trial_enrich_credits_used,
         ob.trial_start_date, ob.trial_end_date,
         ob.pro_monthly_enrich_credits, ob.enterprise_monthly_enrich_credits,
         ob.current_period_start, ob.current_period_end, ob.cancel_at_period_end,
         ob.created_at, ob.updated_at;

COMMENT ON VIEW org_entitlements IS
  'Combined view of org billing + usage. Returns effective plan (plan_override || subscription_tier).';
