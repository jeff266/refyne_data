-- Migration: Add object_type column to dedup_pairs
-- This enables unified dedup system for companies, contacts, and deals

-- Add object_type column with default 'company' for existing rows
ALTER TABLE dedup_pairs 
ADD COLUMN object_type TEXT NOT NULL DEFAULT 'company';

-- Add index for filtering by object_type
CREATE INDEX IF NOT EXISTS idx_dedup_pairs_object_type 
ON dedup_pairs(org_id, portal_id, object_type);

-- Add composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_dedup_pairs_object_status 
ON dedup_pairs(org_id, portal_id, object_type, status);

-- Update unique constraint to include object_type
-- First drop old constraint
ALTER TABLE dedup_pairs 
DROP CONSTRAINT IF EXISTS dedup_pairs_org_id_record_a_id_record_b_id_key;

-- Add new constraint with object_type
ALTER TABLE dedup_pairs 
ADD CONSTRAINT dedup_pairs_org_id_object_type_records_key 
UNIQUE (org_id, object_type, record_a_id, record_b_id);

COMMENT ON COLUMN dedup_pairs.object_type IS 'Type of HubSpot object: company, contact, or deal';
