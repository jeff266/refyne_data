-- Migration: normalization_run_progress table
-- Creates audit trail for normalize apply operations

CREATE TABLE IF NOT EXISTS public.normalization_run_progress (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              uuid REFERENCES normalization_runs(id) ON DELETE CASCADE,
  hubspot_company_id  text NOT NULL,
  field_key           text NOT NULL,
  previous_value      text,
  new_value           text NOT NULL,
  status              text DEFAULT 'written'
                      CHECK (status IN ('written', 'failed', 'skipped')),
  written_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_normalize_progress_run_id
ON normalization_run_progress(run_id);

CREATE INDEX IF NOT EXISTS idx_normalize_progress_company
ON normalization_run_progress(hubspot_company_id);

-- Ensure normalization_runs has required columns for worker
-- Add missing columns if they don't exist (idempotent)

DO $$
BEGIN
  -- records_processed column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'normalization_runs'
    AND column_name = 'records_processed'
  ) THEN
    ALTER TABLE normalization_runs
    ADD COLUMN records_processed integer DEFAULT 0;
  END IF;

  -- records_changed column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'normalization_runs'
    AND column_name = 'records_changed'
  ) THEN
    ALTER TABLE normalization_runs
    ADD COLUMN records_changed integer DEFAULT 0;
  END IF;

  -- records_failed column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'normalization_runs'
    AND column_name = 'records_failed'
  ) THEN
    ALTER TABLE normalization_runs
    ADD COLUMN records_failed integer DEFAULT 0;
  END IF;

  -- completed_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'normalization_runs'
    AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE normalization_runs
    ADD COLUMN completed_at timestamptz;
  END IF;

  -- error column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'normalization_runs'
    AND column_name = 'error'
  ) THEN
    ALTER TABLE normalization_runs
    ADD COLUMN error text;
  END IF;
END $$;

COMMENT ON TABLE normalization_run_progress IS
'Audit trail for normalize apply operations. Logs each field written to HubSpot.';

COMMENT ON COLUMN normalization_run_progress.run_id IS
'References normalization_runs.id. Parent run that triggered this write.';

COMMENT ON COLUMN normalization_run_progress.hubspot_company_id IS
'HubSpot company ID (string format from HubSpot API).';

COMMENT ON COLUMN normalization_run_progress.field_key IS
'Canonical field key (not HubSpot property name). e.g., industry, phone, company_name.';

COMMENT ON COLUMN normalization_run_progress.previous_value IS
'Value before normalization (raw HubSpot value).';

COMMENT ON COLUMN normalization_run_progress.new_value IS
'Value after normalization (canonical normalized value written to HubSpot).';

COMMENT ON COLUMN normalization_run_progress.status IS
'Write status: written (success), failed (HubSpot API error), skipped (excluded).';
