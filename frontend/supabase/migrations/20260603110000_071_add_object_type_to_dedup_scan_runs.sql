-- Migration 071: Add object_type column to dedup_scan_runs
--
-- Allows distinguishing contact scans from company scans in the history view.

ALTER TABLE dedup_scan_runs
ADD COLUMN IF NOT EXISTS object_type TEXT NOT NULL DEFAULT 'company';

CREATE INDEX IF NOT EXISTS idx_dedup_scan_runs_object_type
ON dedup_scan_runs(object_type);

COMMENT ON COLUMN dedup_scan_runs.object_type IS 'Object type: company | contact';
