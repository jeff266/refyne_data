-- Migration 068: Add object_type to arrangement_runs and enrichment_runs
-- Enables object type filtering for enrichment runs (company, contact, deal)

-- Add object_type to arrangement_runs
ALTER TABLE arrangement_runs
  ADD COLUMN IF NOT EXISTS object_type TEXT NOT NULL DEFAULT 'company';

-- Add object_type to enrichment_runs
ALTER TABLE enrichment_runs
  ADD COLUMN IF NOT EXISTS object_type TEXT NOT NULL DEFAULT 'company';

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_arrangement_runs_object_type
  ON arrangement_runs(org_id, object_type);

CREATE INDEX IF NOT EXISTS idx_enrichment_runs_object_type
  ON enrichment_runs(org_id, object_type);

-- Add composite index for history queries (most common pattern)
CREATE INDEX IF NOT EXISTS idx_arrangement_runs_org_object_started
  ON arrangement_runs(org_id, object_type, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrichment_runs_org_object_started
  ON enrichment_runs(org_id, object_type, started_at DESC);

-- Add comments for migration tracking
COMMENT ON COLUMN arrangement_runs.object_type IS 'Migration 068: Object type (company, contact, deal) for filtering runs by CRM object';
COMMENT ON COLUMN enrichment_runs.object_type IS 'Migration 068: Object type (company, contact, deal) for filtering runs by CRM object';
