-- Migration 069: Add write_policy column to harmonies table
--
-- This allows harmonies to specify whether they should only fill empty fields
-- or always overwrite existing values.

ALTER TABLE harmonies
ADD COLUMN IF NOT EXISTS write_policy TEXT NOT NULL DEFAULT 'fill_empty';

COMMENT ON COLUMN harmonies.write_policy IS 'Write policy: fill_empty | always_overwrite';
