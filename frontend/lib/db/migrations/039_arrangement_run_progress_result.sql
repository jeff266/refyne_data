/**
 * Migration 039: Add result column to arrangement_run_progress
 *
 * Adds a jsonb column to store detailed field-level results:
 * - fields_attempted
 * - fields_written
 * - fields_skipped
 * - field_detail (per-field metadata)
 */

ALTER TABLE arrangement_run_progress
ADD COLUMN IF NOT EXISTS result jsonb;

COMMENT ON COLUMN arrangement_run_progress.result IS
'Detailed field-level processing results: { fields_attempted, fields_written, fields_skipped, field_detail: { [field_key]: { provider, strategy, written, skipped, metadata } } }';
