-- Migration: 021_arrangements.sql
-- Adds Arrangements feature - saved enrichment pipelines

-- ============================================================
-- Table: arrangements
-- Stores arrangement configurations (pipelines)
-- ============================================================

CREATE TABLE arrangements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              text NOT NULL,
  name                text NOT NULL,
  description         text,

  -- Source configuration
  source_type         text NOT NULL CHECK (source_type IN ('hubspot_list', 'hubspot_filter', 'csv_upload', 'manual')),
  source_config       jsonb NOT NULL, -- { listId?, filters?, csv_url?, manual_ids? }

  -- Enrichment steps (array of provider + field configs)
  enrichment_steps    jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Example: [{ provider: 'apollo', fields: ['domain', 'employee_count'], order: 1 }]

  -- Output destination
  output_destination  text NOT NULL CHECK (output_destination IN ('hubspot')),
  output_config       jsonb NOT NULL DEFAULT '{}'::jsonb, -- { connection_id, object_type }

  -- Metadata
  created_by          text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  archived_at         timestamptz,

  -- Stats (updated after each run)
  last_run_at         timestamptz,
  total_runs          integer NOT NULL DEFAULT 0,
  total_records_processed integer NOT NULL DEFAULT 0,
  total_credits_used  integer NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS arrangements_org_idx ON arrangements(org_id);
CREATE INDEX IF NOT EXISTS arrangements_created_at_idx ON arrangements(created_at DESC);
CREATE INDEX IF NOT EXISTS arrangements_archived_idx ON arrangements(org_id, archived_at) WHERE archived_at IS NULL;

-- RLS
ALTER TABLE arrangements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON arrangements
  FOR ALL USING (org_id = current_setting('app.org_id', true));


-- ============================================================
-- Table: arrangement_runs
-- Tracks execution of arrangements
-- ============================================================

CREATE TABLE arrangement_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arrangement_id      uuid NOT NULL REFERENCES arrangements(id) ON DELETE CASCADE,
  org_id              text NOT NULL,

  -- Run type
  run_type            text NOT NULL CHECK (run_type IN ('preflight', 'rehearsal_demo', 'rehearsal_live', 'live')),

  -- Status
  status              text NOT NULL CHECK (status IN ('queued', 'running', 'paused', 'completed', 'failed', 'cancelled')),

  -- Source snapshot (resolved at run time)
  source_snapshot     jsonb NOT NULL, -- { type, total_records, sample_ids[] }

  -- Progress tracking
  total_records       integer NOT NULL DEFAULT 0,
  processed_records   integer NOT NULL DEFAULT 0,
  successful_records  integer NOT NULL DEFAULT 0,
  failed_records      integer NOT NULL DEFAULT 0,

  -- Cost tracking
  estimated_credits   integer NOT NULL DEFAULT 0,
  actual_credits_used integer NOT NULL DEFAULT 0,

  -- Checkpointing (for pause/resume)
  checkpoint_data     jsonb, -- { last_processed_id, provider_state }

  -- Results (for demo/rehearsal modes)
  results_snapshot    jsonb, -- Stores sample enriched records

  -- Errors
  error_message       text,

  -- Timing
  initiated_by        text NOT NULL,
  started_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  paused_at           timestamptz,
  resumed_at          timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS arrangement_runs_arrangement_idx ON arrangement_runs(arrangement_id);
CREATE INDEX IF NOT EXISTS arrangement_runs_org_idx ON arrangement_runs(org_id);
CREATE INDEX IF NOT EXISTS arrangement_runs_status_idx ON arrangement_runs(status);
CREATE INDEX IF NOT EXISTS arrangement_runs_started_at_idx ON arrangement_runs(started_at DESC);

-- RLS
ALTER TABLE arrangement_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON arrangement_runs
  FOR ALL USING (org_id = current_setting('app.org_id', true));


-- ============================================================
-- Table: arrangement_run_progress
-- Detailed progress tracking per record
-- ============================================================

CREATE TABLE arrangement_run_progress (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              uuid NOT NULL REFERENCES arrangement_runs(id) ON DELETE CASCADE,
  org_id              text NOT NULL,

  -- Record identifier
  record_id           text NOT NULL, -- HubSpot company ID, CSV row ID, etc.
  record_data         jsonb, -- Original record snapshot

  -- Status
  status              text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),

  -- Enrichment results per step
  enrichment_results  jsonb, -- { step_1: { fields }, step_2: { fields } }

  -- Errors
  error_message       text,

  -- Credits consumed for this record
  credits_used        integer NOT NULL DEFAULT 0,

  -- Timing
  started_at          timestamptz,
  completed_at        timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS arrangement_run_progress_run_idx ON arrangement_run_progress(run_id);
CREATE INDEX IF NOT EXISTS arrangement_run_progress_status_idx ON arrangement_run_progress(run_id, status);

-- RLS
ALTER TABLE arrangement_run_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON arrangement_run_progress
  FOR ALL USING (org_id = current_setting('app.org_id', true));


-- ============================================================
-- Table: arrangement_preflight
-- Stores preflight check results
-- ============================================================

CREATE TABLE arrangement_preflight (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arrangement_id      uuid NOT NULL REFERENCES arrangements(id) ON DELETE CASCADE,
  org_id              text NOT NULL,

  -- Preflight run snapshot
  run_id              uuid REFERENCES arrangement_runs(id) ON DELETE SET NULL,

  -- Check results
  check_type          text NOT NULL CHECK (check_type IN ('missing_fields', 'invalid_config', 'insufficient_credits', 'rate_limit')),
  severity            text NOT NULL CHECK (severity IN ('error', 'warning')),
  message             text NOT NULL,
  details             jsonb, -- Additional context

  -- Resolution
  resolved            boolean NOT NULL DEFAULT false,
  resolved_at         timestamptz,
  resolved_by         text,
  resolution_note     text,

  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS arrangement_preflight_arrangement_idx ON arrangement_preflight(arrangement_id);
CREATE INDEX IF NOT EXISTS arrangement_preflight_run_idx ON arrangement_preflight(run_id);
CREATE INDEX IF NOT EXISTS arrangement_preflight_resolved_idx ON arrangement_preflight(arrangement_id, resolved);

-- RLS
ALTER TABLE arrangement_preflight ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON arrangement_preflight
  FOR ALL USING (org_id = current_setting('app.org_id', true));
