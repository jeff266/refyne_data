-- Migration: 026_benchmark_columns.sql
-- Add benchmark data columns to workspace_entitlements for dashboard context

ALTER TABLE workspace_entitlements
  ADD COLUMN IF NOT EXISTS benchmark_score     int,
  ADD COLUMN IF NOT EXISTS benchmark_updated_at timestamptz;

COMMENT ON COLUMN workspace_entitlements.benchmark_score
  IS 'Average compliance score for similar-sized organizations. Populated by compliance scanner on each run. Never exposes individual org data - aggregate only.';

COMMENT ON COLUMN workspace_entitlements.benchmark_updated_at
  IS 'Timestamp when benchmark_score was last updated';
