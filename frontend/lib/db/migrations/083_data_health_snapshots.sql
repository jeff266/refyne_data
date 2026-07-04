/**
 * Migration 083: Data Health Snapshots
 *
 * Creates table for daily data health metrics snapshots.
 * Enables week-over-week trend analysis and historical tracking.
 */

-- Create data_health_snapshots table
CREATE TABLE IF NOT EXISTS data_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  data_health_score INTEGER NOT NULL,
  company_count INTEGER NOT NULL DEFAULT 0,
  contact_count INTEGER NOT NULL DEFAULT 0,
  normalize_issues INTEGER NOT NULL DEFAULT 0,
  dedup_clusters INTEGER NOT NULL DEFAULT 0,
  enrich_credits_used INTEGER NOT NULL DEFAULT 0,
  enrich_credits_total INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_org_snapshot_date UNIQUE (org_id, snapshot_date)
);

-- Indexes for efficient querying
CREATE INDEX idx_data_health_snapshots_org_id ON data_health_snapshots(org_id);
CREATE INDEX idx_data_health_snapshots_snapshot_date ON data_health_snapshots(snapshot_date DESC);
CREATE INDEX idx_data_health_snapshots_org_date ON data_health_snapshots(org_id, snapshot_date DESC);

-- RLS: Org isolation
ALTER TABLE data_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY data_health_snapshots_org_isolation ON data_health_snapshots
  FOR ALL
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));

-- Comment
COMMENT ON TABLE data_health_snapshots IS 'Daily snapshots of data health metrics for trend analysis';
COMMENT ON COLUMN data_health_snapshots.snapshot_date IS 'Date of snapshot (one per org per day)';
COMMENT ON COLUMN data_health_snapshots.data_health_score IS 'Calculated health score (0-100)';
