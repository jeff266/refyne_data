-- Dedup Decisions Table
-- Captures every operator decision (merge/reject/defer) with signal context
-- Foundation for probabilistic learning and operator behavior analysis

CREATE TABLE public.dedup_decisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          text NOT NULL,
  cluster_id      uuid REFERENCES dedup_clusters(id),
  decision        text NOT NULL
                  CHECK (decision IN ('merged', 'rejected', 'deferred')),
  signal_scores   jsonb NOT NULL,
  cluster_grade   text,
  decided_by      text NOT NULL,
  decided_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_dedup_decisions_org_id
ON dedup_decisions(org_id);

CREATE INDEX idx_dedup_decisions_decided_at
ON dedup_decisions(decided_at);

CREATE INDEX idx_dedup_decisions_cluster_id
ON dedup_decisions(cluster_id);

-- Add comment
COMMENT ON TABLE dedup_decisions IS 'Logs every dedup decision with signal context for ML training and audit';
