-- Migration 090: Fix write policy for format harmonies (phone, linkedin-url)
--
-- Phone and LinkedIn URL are format harmonies - they need 'always_overwrite' to fix dirty values.
-- 'fill_empty' only writes to empty fields, which is useless for normalization.
--
-- This migration updates the default write_policy from 'fill_empty' to 'always_overwrite'
-- for phone and linkedin-url harmonies.

-- Update write_policy for phone and linkedin harmonies
-- These are format harmonies that need to normalize dirty values, not just fill empty ones
UPDATE harmonies
SET write_policy = 'always_overwrite'
WHERE id IN (
  'phone',                -- Phone Number Formatter (company.phone)
  'contact-phone-e164',   -- Contact Phone E.164 Formatter (person.phone, person.mobile)
  'linkedin-url'          -- LinkedIn URL Normalizer (company.linkedin_url, person.linkedin_url)
)
AND write_policy = 'fill_empty';

-- Note: Only updates harmonies that currently have 'fill_empty' policy.
-- This preserves any custom overrides that may have been manually set.

COMMENT ON COLUMN harmonies.write_policy IS 'Write policy: fill_empty | always_overwrite | never_overwrite. Format harmonies (phone, linkedin-url) should use always_overwrite to normalize dirty values.';
