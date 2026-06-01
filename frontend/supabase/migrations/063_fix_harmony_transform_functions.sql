-- Fix Harmony Transform Functions
-- Migration to codify direct database fixes made on 2026-06-01
-- Ensures future seeder runs don't overwrite correct state

-- Fix address harmonies: should be lookup type not format
UPDATE harmonies SET
  transform_type = 'lookup',
  transform_function = null,
  reference_table = 'countries'
WHERE id = 'address-country';

UPDATE harmonies SET
  transform_type = 'lookup',
  transform_function = null,
  reference_table = 'us_states'
WHERE id = 'address-state';

-- Fix contact harmonies: assign correct transform functions
UPDATE harmonies SET transform_function = 'smart_title_case'
WHERE id IN ('person-name', 'contact-name-case');

UPDATE harmonies SET
  transform_type = 'lookup',
  transform_function = null,
  reference_table = 'contact_titles'
WHERE id IN ('person-title', 'contact-title-standard');

UPDATE harmonies SET
  transform_type = 'lookup',
  transform_function = null,
  reference_table = 'countries'
WHERE id = 'contact-location';

-- Fix company-domain and website-social-media
UPDATE harmonies SET
  transform_function = 'url_canonical',
  transform_config = '{}'
WHERE id IN ('company-domain', 'website-social-media');
