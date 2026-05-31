-- Migration 061: Add company_name to normalization_run_progress
-- Adds company name column for better UX in run details view

ALTER TABLE public.normalization_run_progress
ADD COLUMN IF NOT EXISTS company_name text;

CREATE INDEX IF NOT EXISTS idx_normalize_progress_company_name
ON normalization_run_progress(company_name);

COMMENT ON COLUMN normalization_run_progress.company_name IS
'Company name (for display in run history UI). Populated from HubSpot company data at write time.';
