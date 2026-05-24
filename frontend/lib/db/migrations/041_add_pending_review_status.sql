-- Add 'pending_review' to arrangement_runs status enum
-- This status is used when enrichment requires user review before writing to HubSpot

-- Drop the old check constraint
ALTER TABLE arrangement_runs
DROP CONSTRAINT arrangement_runs_status_check;

-- Add new check constraint with 'pending_review' included
ALTER TABLE arrangement_runs
ADD CONSTRAINT arrangement_runs_status_check
CHECK (status IN ('queued', 'running', 'paused', 'completed', 'failed', 'cancelled', 'pending_review'));
