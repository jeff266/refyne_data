-- Migration 091: Update phone harmony transform_config to use e164_formatted
--
-- Bug Fix: Phone harmony description says "+1 (XXX) XXX-XXXX format"
-- but transform_config was running compact E.164 (+15627350870).
--
-- This migration updates existing phone harmonies to use e164_formatted
-- which matches the description and US team preference for human-readable format.

-- Update phone harmony transform_config to use e164_formatted
-- Matches the harmony description and US team preference
UPDATE harmonies
SET transform_config = jsonb_set(
  COALESCE(transform_config, '{}'::jsonb),
  '{format}',
  '"e164_formatted"'
)
WHERE id IN ('phone', 'contact-phone-e164')
AND (
  transform_config IS NULL
  OR transform_config->>'format' IS NULL
  OR transform_config->>'format' != 'e164_formatted'
);

-- Log the change
-- Expected: Updates phone harmonies to use formatted output
-- This preserves other config values (default_country_code, strip_extensions, etc.)
