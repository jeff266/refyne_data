-- Migration 078: Add condition_groups to harmonies
-- Enables conditional execution: harmonies can specify which records they apply to
--
-- RLS: Required if table has org_id column
-- Pattern: Already enabled in migration 031 - no changes needed
--
-- Backward compatibility: NULL = runs on all records (existing behavior)

-- Add condition_groups column to harmonies table
ALTER TABLE harmonies
  ADD COLUMN IF NOT EXISTS condition_groups JSONB DEFAULT NULL;

-- Add documentation comment
COMMENT ON COLUMN harmonies.condition_groups IS
  'Conditional execution rules. NULL = runs on all records (default). JSONB structure: {match: "all"|"any", groups: [{match: "all"|"any", conditions: [{field, fieldLabel, fieldType, operator, value}]}]}. Enables Openprise-style branching where different harmonies handle different record subsets (e.g., US phone vs UK phone formatting).';

-- Index for querying harmonies with conditions
-- Supports: SELECT * FROM harmonies WHERE condition_groups IS NOT NULL AND is_active = true
CREATE INDEX IF NOT EXISTS idx_harmonies_has_conditions
  ON harmonies ((condition_groups IS NOT NULL))
  WHERE condition_groups IS NOT NULL;

-- Verify: All existing harmonies have NULL condition_groups (runs on all records)
-- Run after migration:
--   SELECT id, name, condition_groups FROM harmonies WHERE org_id = 'your_org_id';
--   Expected: All condition_groups = NULL
