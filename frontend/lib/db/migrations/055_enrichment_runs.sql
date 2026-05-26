-- Migration: 055_enrichment_runs.sql
-- Adds enrichment_runs table for tracking ad-hoc preview-based enrichment jobs
-- Separate from arrangements (which are saved pipelines)

-- ============================================================
-- Table: enrichment_runs
-- Tracks execution of ad-hoc enrichment jobs (preview → apply flow)
-- ============================================================

CREATE TABLE IF NOT EXISTS enrichment_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              text NOT NULL,

  -- Configuration snapshot
  fields              text[] NOT NULL, -- Field keys to enrich
  providers           text[] NOT NULL, -- Provider IDs (apollo, graphiq, refyne_search)
  write_policy        text NOT NULL CHECK (write_policy IN ('fill_empty', 'overwrite')),

  -- Source configuration
  source_type         text NOT NULL CHECK (source_type IN ('all', 'list', 'segment', 'csv')),
  source_config       jsonb NOT NULL, -- { list_id?, filters?, domains? }

  -- Status
  status              text NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),

  -- Progress tracking
  total_records       integer NOT NULL DEFAULT 0,
  processed_records   integer NOT NULL DEFAULT 0,
  successful_records  integer NOT NULL DEFAULT 0, -- Records with at least 1 field enriched
  failed_records      integer NOT NULL DEFAULT 0,

  -- Field-level stats
  fields_enriched     integer NOT NULL DEFAULT 0, -- Total field writes
  fields_skipped      integer NOT NULL DEFAULT 0, -- Already set or no data

  -- Cost tracking (for Refyne Search)
  serper_calls        integer NOT NULL DEFAULT 0,
  deepseek_tokens_in  integer NOT NULL DEFAULT 0,
  deepseek_tokens_out integer NOT NULL DEFAULT 0,
  cost_usd            numeric(10, 6) NOT NULL DEFAULT 0,

  -- Errors
  error_message       text,

  -- Timing
  initiated_by        text NOT NULL,
  started_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,

  -- Job queue reference
  job_id              text -- BullMQ job ID for status tracking
);

-- Indexes
CREATE INDEX IF NOT EXISTS enrichment_runs_org_idx ON enrichment_runs(org_id);
CREATE INDEX IF NOT EXISTS enrichment_runs_status_idx ON enrichment_runs(status);
CREATE INDEX IF NOT EXISTS enrichment_runs_started_at_idx ON enrichment_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS enrichment_runs_job_idx ON enrichment_runs(job_id) WHERE job_id IS NOT NULL;

-- RLS
ALTER TABLE enrichment_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON enrichment_runs
  FOR ALL USING (org_id = current_setting('app.org_id', true));
