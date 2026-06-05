-- Migration: 076_trial_system.sql
-- Add trial and plan tracking to org_policies

ALTER TABLE org_policies
  ADD COLUMN IF NOT EXISTS trial_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'trial'
    CHECK (plan IN ('trial', 'starter', 'growth', 'scale', 'enterprise'));

-- Index for trial expiry queries
CREATE INDEX IF NOT EXISTS org_policies_trial_ends ON org_policies (trial_ends_at) WHERE trial_ends_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS org_policies_plan ON org_policies (plan);
