-- Migration 063: Delete incomplete format harmonies
-- These harmonies have transform_type='format' but no transform_function defined
-- They cause normalization engine errors and keep getting re-activated
-- Delete them entirely until they can be properly implemented

DELETE FROM harmonies
WHERE transform_type = 'format'
  AND transform_function IS NULL;

-- Field assignments will cascade delete due to ON DELETE CASCADE

COMMENT ON COLUMN harmonies.transform_function IS
'Required for format harmonies. If NULL, harmony will cause errors and should be deleted.';
