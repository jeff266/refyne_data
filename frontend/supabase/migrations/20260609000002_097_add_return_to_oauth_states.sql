-- Migration: 097_add_return_to_oauth_states.sql
-- Add return_to column to hubspot_oauth_states table for onboarding flow redirects

ALTER TABLE hubspot_oauth_states
  ADD COLUMN IF NOT EXISTS return_to TEXT;

COMMENT ON COLUMN hubspot_oauth_states.return_to
  IS 'Optional redirect path after OAuth completes (e.g., /onboarding/first-run)';
