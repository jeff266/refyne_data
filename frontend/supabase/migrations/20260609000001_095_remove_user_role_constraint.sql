-- Migration: 095_remove_user_role_constraint.sql
-- Remove check constraint on onboarding_progress.user_role
-- to allow any text value (field is just a freeform job title)

-- Drop the constraint if it exists
ALTER TABLE onboarding_progress
  DROP CONSTRAINT IF EXISTS onboarding_progress_user_role_check;

COMMENT ON COLUMN onboarding_progress.user_role
  IS 'User role/title (e.g., Head of RevOps, Founder, CEO) from welcome step - freeform text';
