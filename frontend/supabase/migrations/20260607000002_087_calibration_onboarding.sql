-- Migration: 087_calibration_onboarding.sql
-- Add calibration completion tracking to onboarding_progress

ALTER TABLE onboarding_progress
  ADD COLUMN IF NOT EXISTS calibration_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS calibration_completed_at timestamptz;

COMMENT ON COLUMN onboarding_progress.calibration_completed
  IS 'True after user completes calibration wizard for normalization settings';
COMMENT ON COLUMN onboarding_progress.calibration_completed_at
  IS 'Timestamp when calibration wizard was completed';
