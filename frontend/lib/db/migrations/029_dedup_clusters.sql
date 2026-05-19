-- Migration 029: Dedup Clusters
-- Cluster-based dedup review system
-- Groups duplicate pairs into multi-record clusters using Union-Find

-- Create clusters table
CREATE TABLE IF NOT EXISTS dedup_clusters (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        text NOT NULL,
  portal_id     text NOT NULL,
  connection_id uuid REFERENCES hubspot_connections(id),
  grade         text NOT NULL CHECK (grade IN ('A','B','C','D')),
  record_ids    text[] NOT NULL,
  pair_ids      uuid[] NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','merged','rejected','skipped')),
  merged_into   text,
  resolved_by   text,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for org + status + grade filtering
CREATE INDEX dedup_clusters_org_status ON dedup_clusters (org_id, status, grade);

-- Enable RLS
ALTER TABLE dedup_clusters ENABLE ROW LEVEL SECURITY;

-- RLS policy for org isolation
CREATE POLICY "org_isolation" ON dedup_clusters
  FOR ALL USING (org_id = current_setting('app.org_id', true));

-- Add cluster_id to dedup_pairs
ALTER TABLE dedup_pairs
  ADD COLUMN IF NOT EXISTS cluster_id uuid REFERENCES dedup_clusters(id);

-- Index for cluster lookups
CREATE INDEX IF NOT EXISTS dedup_pairs_cluster_id_idx ON dedup_pairs(cluster_id);

-- Comment for migration tracking
COMMENT ON TABLE dedup_clusters IS 'Migration 029: Cluster-based dedup review - groups pairs into multi-record clusters';
