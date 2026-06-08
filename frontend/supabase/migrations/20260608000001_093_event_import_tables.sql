-- Migration 093: Event Import Tables Enhancement
-- Adds columns for import matching, filtering, owner assignment, and HubSpot sync

-- Alter event_imports table (created in migration 068)
ALTER TABLE event_imports
  ADD COLUMN IF NOT EXISTS filter_config JSONB,
  ADD COLUMN IF NOT EXISTS field_mapping JSONB,
  ADD COLUMN IF NOT EXISTS write_config JSONB,
  ADD COLUMN IF NOT EXISTS owner_assignment JSONB,
  ADD COLUMN IF NOT EXISTS match_summary JSONB,
  ADD COLUMN IF NOT EXISTS initiated_by TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_list_id TEXT,
  ADD COLUMN IF NOT EXISTS row_count INTEGER,
  ADD COLUMN IF NOT EXISTS matched_count INTEGER,
  ADD COLUMN IF NOT EXISTS created_count INTEGER,
  ADD COLUMN IF NOT EXISTS updated_count INTEGER,
  ADD COLUMN IF NOT EXISTS skipped_count INTEGER;

-- Alter event_import_rows table (created in migration 068)
ALTER TABLE event_import_rows
  ADD COLUMN IF NOT EXISTS bucket TEXT,
  ADD COLUMN IF NOT EXISTS match_type TEXT,
  ADD COLUMN IF NOT EXISTS match_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS hubspot_contact_id TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_company_id TEXT,
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS owner_id TEXT,
  ADD COLUMN IF NOT EXISTS cleaned_first_name TEXT,
  ADD COLUMN IF NOT EXISTS cleaned_last_name TEXT,
  ADD COLUMN IF NOT EXISTS email_domain TEXT,
  ADD COLUMN IF NOT EXISTS company_group_key TEXT;

-- RLS policies already enabled on these tables in migration 068
-- No additional policies needed
