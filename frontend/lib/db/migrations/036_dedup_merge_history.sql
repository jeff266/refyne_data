-- Migration 036: Dedup Merge History
-- Captures pre-merge snapshots for full auditability

CREATE TABLE dedup_merge_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  cluster_id uuid, -- May reference deleted cluster

  -- Merge metadata
  merged_by text NOT NULL, -- Clerk user ID
  merged_by_name text, -- Display name at time of merge
  merged_at timestamptz NOT NULL DEFAULT now(),
  merge_method text NOT NULL CHECK (merge_method IN ('manual', 'auto', 'bulk')),

  -- Record IDs
  survivor_record_id text NOT NULL, -- HubSpot company ID that survived
  merged_record_id text NOT NULL, -- HubSpot company ID that was merged away

  -- Pre-merge snapshots (complete field values BEFORE merge)
  survivor_snapshot jsonb NOT NULL,
  merged_snapshot jsonb NOT NULL,

  -- Post-merge result (final field values AFTER merge)
  result_snapshot jsonb NOT NULL,

  -- Field selection tracking
  field_selections jsonb, -- { "domain": "survivor", "phone": "merged", ... }

  -- Cluster metadata
  confidence_score numeric(5,2),
  similarity_signals text[], -- Signals that triggered the match

  -- Optional
  notes text
);

-- Indexes
CREATE INDEX dedup_merge_history_org ON dedup_merge_history (org_id);
CREATE INDEX dedup_merge_history_cluster ON dedup_merge_history (cluster_id);
CREATE INDEX dedup_merge_history_merged_at ON dedup_merge_history (merged_at DESC);
CREATE INDEX dedup_merge_history_survivor ON dedup_merge_history (survivor_record_id);

-- RLS
ALTER TABLE dedup_merge_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON dedup_merge_history
  FOR ALL USING (org_id = current_setting('app.org_id', true));

COMMENT ON TABLE dedup_merge_history IS 'Audit trail for dedup merges - captures before/after snapshots';
COMMENT ON COLUMN dedup_merge_history.survivor_snapshot IS 'Complete field values of survivor record BEFORE merge';
COMMENT ON COLUMN dedup_merge_history.merged_snapshot IS 'Complete field values of merged record BEFORE deletion';
COMMENT ON COLUMN dedup_merge_history.result_snapshot IS 'Final field values AFTER merge (what was written to HubSpot)';
COMMENT ON COLUMN dedup_merge_history.field_selections IS 'Tracks which fields came from which source record';
