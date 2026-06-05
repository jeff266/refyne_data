-- ============================================================
-- Migration 079: Add error_message to normalization_run_progress
-- ============================================================
-- Captures HubSpot-specific error messages when field writes fail.
-- This allows UI to surface exactly why a field write was rejected
-- (e.g., "ABA Therapy is not a valid enumeration value for industry").
-- ============================================================

ALTER TABLE normalization_run_progress
ADD COLUMN IF NOT EXISTS error_message TEXT;

COMMENT ON COLUMN normalization_run_progress.error_message IS
'HubSpot error message when status = failed. Contains the specific reason the field write was rejected (e.g., enum validation failure, invalid format).';

-- ============================================================
-- Post-Migration Verification
-- ============================================================
-- Verify column was added:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'normalization_run_progress'
-- AND column_name = 'error_message';
-- Expected: error_message | text
