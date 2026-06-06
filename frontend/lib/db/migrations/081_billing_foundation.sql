-- Migration 081: Billing System Foundation
-- Phase 1: Core schema with atomic counters, weekly partitions, and Stripe integration
-- Critical design decisions from architecture review:
-- - Weekly partitions (not monthly) for 14-day trial analysis
-- - Atomic counters via RPC (no race conditions)
-- - Stripe webhook idempotency table
-- - PostgreSQL VIEW for single-query entitlements
-- - No Redis caching (direct DB reads are fast enough)

-- =============================================================================
-- 1. ORG_BILLING: Subscription state + atomic trial counters
-- =============================================================================

CREATE TABLE public.org_billing (
  org_id TEXT PRIMARY KEY,
  -- Subscription state
  subscription_tier TEXT NOT NULL DEFAULT 'trial', -- trial | pro | enterprise | internal
  subscription_status TEXT NOT NULL DEFAULT 'active', -- active | past_due | cancelled | paused
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,

  -- Trial tracking
  trial_start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_end_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),

  -- Atomic trial counters (prevents race conditions)
  trial_merges_used INTEGER NOT NULL DEFAULT 0,
  trial_normalize_writes_used INTEGER NOT NULL DEFAULT 0,
  trial_enrich_credits_used INTEGER NOT NULL DEFAULT 0,

  -- Paid plan credits (monthly allocation)
  pro_monthly_enrich_credits INTEGER,
  enterprise_monthly_enrich_credits INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for Stripe lookups
CREATE INDEX idx_org_billing_stripe_customer ON org_billing(stripe_customer_id);
CREATE INDEX idx_org_billing_stripe_subscription ON org_billing(stripe_subscription_id);

-- Index for trial expiration queries
CREATE INDEX idx_org_billing_trial_end ON org_billing(trial_end_date) WHERE subscription_tier = 'trial';

-- RLS: Org isolation
ALTER TABLE org_billing ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_billing_org_isolation ON org_billing
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- =============================================================================
-- 2. ORG_USAGE: Weekly partitioned usage tracking
-- =============================================================================
-- Weekly partitions (not monthly) for better 14-day trial analysis
-- Partitions created 12 weeks ahead for operational safety

CREATE TABLE public.org_usage (
  id UUID DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  week_start DATE NOT NULL, -- Monday of the week (partition key)

  -- Daily usage counters
  date DATE NOT NULL,
  merges_executed INTEGER DEFAULT 0,
  normalize_writes INTEGER DEFAULT 0,
  enrich_credits_consumed INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (org_id, week_start, date)
) PARTITION BY RANGE (week_start);

-- Create partitions for next 12 weeks
-- Week starts on Monday, partitions are weekly
DO $$
DECLARE
  start_date DATE := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  end_date DATE;
  partition_name TEXT;
  week_offset INTEGER;
BEGIN
  FOR week_offset IN 0..11 LOOP
    end_date := start_date + (week_offset * 7);
    partition_name := 'org_usage_' || TO_CHAR(end_date, 'IYYY_IW'); -- e.g., org_usage_2026_23

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF org_usage
       FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      end_date,
      end_date + 7
    );
  END LOOP;
END $$;

-- Indexes on partitioned table
CREATE INDEX idx_org_usage_org_date ON org_usage(org_id, date DESC);
CREATE INDEX idx_org_usage_week ON org_usage(week_start);

-- RLS: Org isolation
ALTER TABLE org_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_usage_org_isolation ON org_usage
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- =============================================================================
-- 3. STRIPE_WEBHOOK_EVENTS: Idempotency for webhook processing
-- =============================================================================

CREATE TABLE public.stripe_webhook_events (
  id TEXT PRIMARY KEY, -- Stripe event ID (evt_xxx)
  event_type TEXT NOT NULL, -- customer.subscription.created, etc.
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  org_id TEXT, -- May be null if event doesn't map to org yet
  metadata JSONB, -- Full event payload for debugging

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for event type queries
CREATE INDEX idx_stripe_webhook_events_type ON stripe_webhook_events(event_type, processed_at DESC);
CREATE INDEX idx_stripe_webhook_events_org ON stripe_webhook_events(org_id, processed_at DESC);

-- Index for idempotency cleanup (90-day retention)
CREATE INDEX idx_stripe_webhook_events_created ON stripe_webhook_events(created_at);

-- RLS: Global read-only (Stripe events are not org-specific until processed)
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY stripe_webhook_events_read_all ON stripe_webhook_events
  FOR SELECT
  USING (true);

-- =============================================================================
-- 4. STRIPE_PRICES: Store Stripe price IDs in database (not env vars)
-- =============================================================================

CREATE TABLE public.stripe_prices (
  id SERIAL PRIMARY KEY,
  tier TEXT NOT NULL, -- pro | enterprise
  billing_period TEXT NOT NULL, -- monthly | annual
  stripe_price_id TEXT NOT NULL UNIQUE, -- price_xxx from Stripe
  amount_cents INTEGER NOT NULL, -- Price in cents
  currency TEXT NOT NULL DEFAULT 'usd',
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for price lookups
CREATE INDEX idx_stripe_prices_tier_period ON stripe_prices(tier, billing_period) WHERE is_active = TRUE;

-- RLS: Global read-only
ALTER TABLE stripe_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY stripe_prices_read_all ON stripe_prices
  FOR SELECT
  USING (true);

-- =============================================================================
-- 5. ORG_BILLING_EVENTS: Audit trail for billing state changes
-- =============================================================================

CREATE TABLE public.org_billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- trial_started | subscription_created | usage_limit_exceeded | etc.
  actor_id TEXT, -- User who triggered (null for system events)
  before_state JSONB,
  after_state JSONB,
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX idx_org_billing_events_org ON org_billing_events(org_id, created_at DESC);
CREATE INDEX idx_org_billing_events_type ON org_billing_events(event_type, created_at DESC);

-- RLS: Org isolation
ALTER TABLE org_billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_billing_events_org_isolation ON org_billing_events
  FOR SELECT
  USING (org_id = (auth.jwt() ->> 'org_id'));

-- =============================================================================
-- 6. RPC FUNCTION: Atomic trial counter increment
-- =============================================================================
-- Prevents race conditions when consuming trial credits
-- Returns TRUE if increment succeeded, FALSE if limit exceeded

CREATE OR REPLACE FUNCTION public.increment_trial_counter(
  p_org_id TEXT,
  p_counter_name TEXT, -- 'merges' | 'normalize_writes' | 'enrich_credits'
  p_increment INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_value INTEGER;
  v_limit INTEGER;
  v_column_name TEXT;
BEGIN
  -- Map counter name to column name
  v_column_name := CASE p_counter_name
    WHEN 'merges' THEN 'trial_merges_used'
    WHEN 'normalize_writes' THEN 'trial_normalize_writes_used'
    WHEN 'enrich_credits' THEN 'trial_enrich_credits_used'
    ELSE NULL
  END;

  IF v_column_name IS NULL THEN
    RAISE EXCEPTION 'Invalid counter name: %', p_counter_name;
  END IF;

  -- Set limits (from billing spec)
  v_limit := CASE p_counter_name
    WHEN 'merges' THEN 25
    WHEN 'normalize_writes' THEN 100
    WHEN 'enrich_credits' THEN 50
  END;

  -- Atomic increment with row lock
  EXECUTE format(
    'UPDATE org_billing
     SET %I = %I + $1, updated_at = NOW()
     WHERE org_id = $2
       AND subscription_tier = ''trial''
       AND %I + $1 <= $3
     RETURNING %I',
    v_column_name, v_column_name, v_column_name, v_column_name
  ) USING p_increment, p_org_id, v_limit INTO v_current_value;

  -- Return TRUE if update succeeded (limit not exceeded)
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 7. RPC FUNCTION: Upsert daily usage for paid/internal orgs
-- =============================================================================
-- Handles concurrent writes to org_usage table using INSERT ... ON CONFLICT

CREATE OR REPLACE FUNCTION public.upsert_daily_usage(
  p_org_id TEXT,
  p_date DATE,
  p_week_start DATE,
  p_column_name TEXT,
  p_increment INTEGER
) RETURNS VOID AS $$
BEGIN
  -- Validate column name to prevent SQL injection
  IF p_column_name NOT IN ('merges_executed', 'normalize_writes', 'enrich_credits_consumed') THEN
    RAISE EXCEPTION 'Invalid column name: %', p_column_name;
  END IF;

  -- Upsert with dynamic column update
  EXECUTE format(
    'INSERT INTO org_usage (org_id, week_start, date, %I)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (org_id, week_start, date)
     DO UPDATE SET %I = org_usage.%I + $4',
    p_column_name, p_column_name, p_column_name
  ) USING p_org_id, p_week_start, p_date, p_increment;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 8. VIEW: org_entitlements for single-query performance
-- =============================================================================
-- Combines org_billing + usage aggregation into single view
-- Eliminates need for multi-query logic in application code

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

  -- Paid plan credits
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

-- =============================================================================
-- 9. SEED DATA: Stripe prices (placeholder - update with real price IDs)
-- =============================================================================

INSERT INTO stripe_prices (tier, billing_period, stripe_price_id, amount_cents, currency, is_active) VALUES
  ('pro', 'monthly', 'price_placeholder_pro_monthly', 29900, 'usd', TRUE),
  ('pro', 'annual', 'price_placeholder_pro_annual', 299000, 'usd', TRUE),
  ('enterprise', 'monthly', 'price_placeholder_enterprise_monthly', 99900, 'usd', TRUE),
  ('enterprise', 'annual', 'price_placeholder_enterprise_annual', 999000, 'usd', TRUE);

-- Note: Update these price IDs with real Stripe prices before production deployment
