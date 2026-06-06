-- Migration 083: Billing UX - Trial email tracking columns
-- Adds trial_warning_email_sent_at and trial_expiry_email_sent_at to org_billing
-- Updates org_entitlements VIEW to expose stripe_customer_id

ALTER TABLE org_billing
  ADD COLUMN trial_warning_email_sent_at TIMESTAMPTZ,
  ADD COLUMN trial_expiry_email_sent_at TIMESTAMPTZ;

-- Update org_entitlements VIEW to expose stripe_customer_id for billing tab
CREATE OR REPLACE VIEW public.org_entitlements AS
SELECT
  ob.org_id,
  ob.subscription_tier,
  ob.subscription_status,
  ob.stripe_customer_id,
  ob.stripe_subscription_id,

  -- Trial limits
  CASE WHEN ob.subscription_tier = 'trial' THEN 25 ELSE NULL END AS trial_merge_limit,
  CASE WHEN ob.subscription_tier = 'trial' THEN 100 ELSE NULL END AS trial_normalize_limit,
  CASE WHEN ob.subscription_tier = 'trial' THEN 50 ELSE NULL END AS trial_enrich_limit,

  -- Trial usage
  ob.trial_merges_used,
  ob.trial_normalize_writes_used,
  ob.trial_enrich_credits_used,

  -- Trial remaining (null for non-trial tiers)
  CASE WHEN ob.subscription_tier = 'trial' THEN 25 - ob.trial_merges_used ELSE NULL END AS trial_merges_remaining,
  CASE WHEN ob.subscription_tier = 'trial' THEN 100 - ob.trial_normalize_writes_used ELSE NULL END AS trial_normalize_remaining,
  CASE WHEN ob.subscription_tier = 'trial' THEN 50 - ob.trial_enrich_credits_used ELSE NULL END AS trial_enrich_remaining,

  -- Trial dates
  ob.trial_start_date,
  ob.trial_end_date,
  EXTRACT(EPOCH FROM (ob.trial_end_date - NOW())) / 86400 AS trial_days_remaining,

  -- Paid plan credits (legacy columns retained for backward compatibility)
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
GROUP BY ob.org_id, ob.subscription_tier, ob.subscription_status,
         ob.stripe_customer_id, ob.stripe_subscription_id,
         ob.trial_merges_used, ob.trial_normalize_writes_used, ob.trial_enrich_credits_used,
         ob.trial_start_date, ob.trial_end_date,
         ob.pro_monthly_enrich_credits, ob.enterprise_monthly_enrich_credits,
         ob.current_period_start, ob.current_period_end, ob.cancel_at_period_end,
         ob.created_at, ob.updated_at;
