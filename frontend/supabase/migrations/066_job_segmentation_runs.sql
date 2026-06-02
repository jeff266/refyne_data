-- Job Segmentation Runs Table
-- Tracks all job title classification runs with progress and status

CREATE TABLE public.job_segmentation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  portal_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  dry_run BOOLEAN NOT NULL DEFAULT false,
  batch_size INTEGER DEFAULT 100,
  level_field TEXT NOT NULL DEFAULT 'refyne_job_level',
  function_field TEXT NOT NULL DEFAULT 'refyne_job_function',
  processed_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Index for querying runs by org
CREATE INDEX idx_job_segmentation_runs_org ON job_segmentation_runs(org_id, created_at DESC);

-- Index for querying runs by status
CREATE INDEX idx_job_segmentation_runs_status ON job_segmentation_runs(status, created_at DESC);
