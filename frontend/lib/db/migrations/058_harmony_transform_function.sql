-- Add transform_function and transform_config columns to harmonies
-- Phase 1: Data-driven format functions

ALTER TABLE harmonies
  ADD COLUMN IF NOT EXISTS transform_function TEXT,
  ADD COLUMN IF NOT EXISTS transform_config JSONB DEFAULT '{}';

-- Seed transform_function for all existing format harmonies
-- Map harmony IDs to shared transform functions

-- Phone harmonies (both use same e164_phone function)
UPDATE harmonies SET
  transform_function = 'e164_phone',
  transform_config = '{"default_country_code": "1", "strip_extensions": true}'
  WHERE id IN ('phone', 'contact-phone-e164');

-- Email harmonies (both use same email_lowercase function)
UPDATE harmonies SET transform_function = 'email_lowercase'
  WHERE id IN ('email', 'contact-email-lower');

-- LinkedIn URL
UPDATE harmonies SET transform_function = 'linkedin_url'
  WHERE id = 'linkedin-url';

-- Company name
UPDATE harmonies SET transform_function = 'smart_title_case'
  WHERE id = 'company-name';

-- Employee and revenue parsing (both use numeric_parse)
UPDATE harmonies SET transform_function = 'numeric_parse'
  WHERE id IN ('company-employees', 'company-revenue');

COMMENT ON COLUMN harmonies.transform_function IS 'Shared format function identifier (e.g., e164_phone, smart_title_case). Multiple harmonies can share the same transform function.';
COMMENT ON COLUMN harmonies.transform_config IS 'JSON configuration passed to the transform function (e.g., {"default_country_code": "1"}).';
