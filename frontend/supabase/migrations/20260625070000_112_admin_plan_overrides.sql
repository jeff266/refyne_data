-- Migration 112: Admin plan overrides and credit grants
--
-- Adds ability for super admins to override org plans without touching Stripe,
-- extend trials, and grant additional credits.

-- Add plan override columns to org_billing
ALTER TABLE org_billing
  ADD COLUMN IF NOT EXISTS plan_override TEXT
    CHECK (plan_override IN ('growth', 'scale', 'enterprise')),
  ADD COLUMN IF NOT EXISTS plan_override_reason TEXT,
  ADD COLUMN IF NOT EXISTS plan_override_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_extended_by_days INTEGER DEFAULT 0;

-- Create admin_credit_grants table for tracking manual credit grants
CREATE TABLE IF NOT EXISTS admin_credit_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  granted_by TEXT NOT NULL,  -- user_id of admin who granted
  credits INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast org lookups
CREATE INDEX IF NOT EXISTS idx_admin_credit_grants_org_id
  ON admin_credit_grants(org_id);

-- RLS: Service role only (no user access to admin tables)
ALTER TABLE admin_credit_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_credit_grants_service_role ON admin_credit_grants
  FOR ALL TO service_role USING (true);

-- Comments for documentation
COMMENT ON COLUMN org_billing.plan_override IS
  'Admin-set plan override. Takes precedence over Stripe subscription.';

COMMENT ON COLUMN org_billing.plan_override_reason IS
  'Reason for plan override (e.g., "Pilot - Frontera Health Q3 2026")';

COMMENT ON COLUMN org_billing.trial_ends_at IS
  'When trial ends. Can be extended by admins.';

COMMENT ON COLUMN org_billing.trial_extended_by_days IS
  'Total days trial has been extended by admins';

COMMENT ON TABLE admin_credit_grants IS
  'Manual credit grants by super admins. Summed with base credits for total balance.';
