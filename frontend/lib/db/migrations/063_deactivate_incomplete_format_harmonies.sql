-- Migration 063: Deactivate incomplete format harmonies
-- These harmonies have transform_type='format' but no transform_function defined
-- They cause normalization engine errors until properly implemented

UPDATE harmonies
SET is_active = false
WHERE transform_type = 'format'
  AND transform_function IS NULL;

COMMENT ON COLUMN harmonies.transform_function IS
'Required for format harmonies. If NULL, harmony must be deactivated or converted to lookup type.';
