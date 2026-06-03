-- Migration 072: Add unique constraint to harmony_reference_data
--
-- Prevents duplicate mappings by enforcing uniqueness on (table_name, input_value).
-- Uses case-insensitive matching via functional index on LOWER(input_value).

CREATE UNIQUE INDEX IF NOT EXISTS idx_harmony_reference_data_unique
ON harmony_reference_data (table_name, LOWER(input_value));

COMMENT ON INDEX idx_harmony_reference_data_unique IS 'Enforce unique mappings per table, case-insensitive on input_value';
