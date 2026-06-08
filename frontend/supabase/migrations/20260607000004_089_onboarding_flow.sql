-- Migration: 089_onboarding_flow.sql
-- Add use case selection and guided flow tracking to onboarding_progress

ALTER TABLE onboarding_progress
  ADD COLUMN IF NOT EXISTS use_cases TEXT[],
  ADD COLUMN IF NOT EXISTS use_case_selected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS welcome_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invited_team_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_flow_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_flow_skipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS workspace_name TEXT,
  ADD COLUMN IF NOT EXISTS user_role TEXT;

COMMENT ON COLUMN onboarding_progress.use_cases
  IS 'User-selected use cases: clean, enrich, both';
COMMENT ON COLUMN onboarding_progress.use_case_selected_at
  IS 'Timestamp when user selected use cases in guided flow';
COMMENT ON COLUMN onboarding_progress.welcome_completed_at
  IS 'Timestamp when user completed welcome step';
COMMENT ON COLUMN onboarding_progress.invited_team_at
  IS 'Timestamp when user visited team invite step (completion not required)';
COMMENT ON COLUMN onboarding_progress.onboarding_flow_completed_at
  IS 'Timestamp when user completed entire guided onboarding flow';
COMMENT ON COLUMN onboarding_progress.onboarding_flow_skipped_at
  IS 'Timestamp when user skipped guided onboarding';
COMMENT ON COLUMN onboarding_progress.workspace_name
  IS 'User-provided workspace name from welcome step';
COMMENT ON COLUMN onboarding_progress.user_role
  IS 'User role/title (e.g., Head of RevOps) from welcome step';
