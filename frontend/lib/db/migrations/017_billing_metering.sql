-- Migration 017: Billing, Metering, and Feature Gating
-- Adds trial tracking, subscription management, and credit metering

-- ── Extend workspace_entitlements ──────────────────────────────────
ALTER TABLE workspace_entitlements
  -- Trial
  ADD COLUMN IF NOT EXISTS trial_started_at      timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at         timestamptz,

  -- Subscription
  ADD COLUMN IF NOT EXISTS subscription_status   text NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN (
      'trialing','active','past_due','cancelled','trial_expired','paused'
    )),
  ADD COLUMN IF NOT EXISTS plan                  text NOT NULL DEFAULT 'trialing'
    CHECK (plan IN (
      'trialing','prospect_solo','prospect_team',
      'starter','growth','scale','enterprise'
    )),

  -- Stripe
  ADD COLUMN IF NOT EXISTS stripe_customer_id      text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  text UNIQUE,
  ADD COLUMN IF NOT EXISTS billing_owner_user_id   text,
  ADD COLUMN IF NOT EXISTS billing_period_start    timestamptz,
  ADD COLUMN IF NOT EXISTS always_on_addon         boolean NOT NULL DEFAULT false,

  -- Credit metering (Serper + GraphIQ only)
  ADD COLUMN IF NOT EXISTS enrich_credits_used     int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrich_credits_limit    int NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS credits_reset_at        timestamptz;

-- ── Credit transaction log ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_transactions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          text        NOT NULL,
  user_id         text,
  type            text        NOT NULL
    CHECK (type IN ('deduct','refund','reset','grant')),
  amount          int         NOT NULL,
  action          text,
  provider        text,
  metadata        jsonb,
  balance_after   int         NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_tx_org_date
  ON credit_transactions (org_id, created_at DESC);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON credit_transactions
  FOR ALL USING (org_id = current_setting('app.org_id', true));

-- ── Set trial defaults on existing orgs ───────────────────────────
UPDATE workspace_entitlements
  SET trial_started_at = now(),
      trial_ends_at    = now() + interval '14 days',
      enrich_credits_limit = 50
  WHERE trial_started_at IS NULL;
