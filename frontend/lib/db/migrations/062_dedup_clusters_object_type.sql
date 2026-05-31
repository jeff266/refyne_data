-- Migration 062: Add object_type to dedup_clusters
-- Enables object type filtering for dedup clusters (company, contact, deal)

ALTER TABLE dedup_clusters
  ADD COLUMN IF NOT EXISTS object_type TEXT NOT NULL DEFAULT 'company';

CREATE INDEX IF NOT EXISTS idx_dedup_clusters_object_type
  ON dedup_clusters(object_type);

-- Comment for migration tracking
COMMENT ON COLUMN dedup_clusters.object_type IS 'Migration 062: Object type (company, contact, deal) for filtering clusters by CRM object';
