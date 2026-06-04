-- Migration: 073_archive_harmonies.sql
-- Add archive functionality for custom harmonies

-- Add is_archived column to harmonies table
ALTER TABLE harmonies
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Index for filtering archived harmonies
CREATE INDEX IF NOT EXISTS idx_harmonies_archived
ON harmonies(org_id, is_archived);

-- Comment for clarity
COMMENT ON COLUMN harmonies.is_archived IS 'Soft delete flag. Archived harmonies are hidden from the list but recoverable. Only applies to custom (non-library) harmonies.';
