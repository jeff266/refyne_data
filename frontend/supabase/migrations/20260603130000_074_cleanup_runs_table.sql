-- Migration 074: Cleanup Runs Table
-- Tracks daily cleanup job runs for visibility

CREATE TABLE public.cleanup_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at TIMESTAMPTZ DEFAULT NOW(),
  progress_rows_deleted INTEGER DEFAULT 0,
  runs_deleted INTEGER DEFAULT 0,
  dedup_runs_deleted INTEGER DEFAULT 0,
  suggestions_deleted INTEGER DEFAULT 0,
  segmentation_runs_deleted INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error TEXT
);

-- Index for querying recent cleanup runs
CREATE INDEX idx_cleanup_runs_ran_at ON public.cleanup_runs(ran_at DESC);

-- RLS: Allow authenticated users to view cleanup runs
ALTER TABLE public.cleanup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view cleanup runs"
ON public.cleanup_runs
FOR SELECT
TO authenticated
USING (true);
