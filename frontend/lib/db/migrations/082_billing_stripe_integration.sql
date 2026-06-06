-- Migration 082: Billing Stripe Integration - Update Tiers
-- Phase 2: Update tier constraint to match actual Stripe pricing
-- trial | starter | growth | scale | internal
-- (Previously: trial | pro | enterprise | internal)

-- =============================================================================
-- 1. Update org_billing tier constraint and default
-- =============================================================================

-- Drop old CHECK constraint if it exists
ALTER TABLE org_billing DROP CONSTRAINT IF EXISTS org_billing_subscription_tier_check;

-- Add new CHECK constraint with updated tiers
ALTER TABLE org_billing ADD CONSTRAINT org_billing_subscription_tier_check
  CHECK (subscription_tier IN ('trial', 'starter', 'growth', 'scale', 'internal'));

-- =============================================================================
-- 2. Update stripe_prices seed data with new tier names
-- =============================================================================

-- Remove old placeholder prices
DELETE FROM stripe_prices WHERE stripe_price_id LIKE 'price_placeholder_%';

-- Insert new placeholder prices with correct tier names
-- Note: These will be updated with real Stripe price IDs before production
INSERT INTO stripe_prices (tier, billing_period, stripe_price_id, amount_cents, currency, is_active) VALUES
  ('starter', 'monthly', 'price_placeholder_starter_monthly', 29900, 'usd', TRUE),
  ('starter', 'annual', 'price_placeholder_starter_annual', 299000, 'usd', TRUE),
  ('growth', 'monthly', 'price_placeholder_growth_monthly', 99900, 'usd', TRUE),
  ('growth', 'annual', 'price_placeholder_growth_annual', 999000, 'usd', TRUE),
  ('scale', 'monthly', 'price_placeholder_scale_monthly', 299900, 'usd', TRUE),
  ('scale', 'annual', 'price_placeholder_scale_annual', 2999000, 'usd', TRUE);

-- =============================================================================
-- 3. Update org_entitlements VIEW to use new tier names
-- =============================================================================

CREATE OR REPLACE VIEW public.org_entitlements AS
SELECT
  ob.org_id,
  ob.subscription_tier,
  ob.subscription_status,

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
GROUP BY ob.org_id, ob.subscription_tier, ob.subscription_status,
         ob.trial_merges_used, ob.trial_normalize_writes_used, ob.trial_enrich_credits_used,
         ob.trial_start_date, ob.trial_end_date,
         ob.pro_monthly_enrich_credits, ob.enterprise_monthly_enrich_credits,
         ob.current_period_start, ob.current_period_end, ob.cancel_at_period_end,
         ob.created_at, ob.updated_at;
