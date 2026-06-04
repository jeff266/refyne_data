-- Fix missing unique constraint on dedup_pairs table
--
-- Error: there is no unique or exclusion constraint matching the ON CONFLICT specification
--
-- Run this in Supabase SQL Editor to check and fix the constraint.

-- Step 1: Check if constraint exists
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'dedup_pairs'
  AND constraint_type = 'UNIQUE'
  AND constraint_name LIKE '%org_id%record%';

-- Expected result: dedup_pairs_org_id_record_a_id_record_b_id_key
-- If no results, continue with Step 2

-- Step 2: Check for duplicate rows (must be clean before adding constraint)
SELECT org_id, record_a_id, record_b_id, COUNT(*) as count
FROM dedup_pairs
GROUP BY org_id, record_a_id, record_b_id
HAVING COUNT(*) > 1;

-- If duplicates exist, clean them up first:
-- DELETE FROM dedup_pairs p1
-- USING dedup_pairs p2
-- WHERE p1.id > p2.id
--   AND p1.org_id = p2.org_id
--   AND p1.record_a_id = p2.record_a_id
--   AND p1.record_b_id = p2.record_b_id;

-- Step 3: Add the unique constraint
ALTER TABLE dedup_pairs
ADD CONSTRAINT dedup_pairs_org_id_record_a_id_record_b_id_key
UNIQUE (org_id, record_a_id, record_b_id);

-- Step 4: Verify constraint was created
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'dedup_pairs'
  AND constraint_type = 'UNIQUE';
