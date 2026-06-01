-- Fix 4 broken contact harmonies
UPDATE harmonies SET
  transform_function = 'smart_title_case',
  transform_config = '{}'
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

-- Remove duplicate email harmony (keep contact-email-lower)
UPDATE harmonies SET is_active = false WHERE id = 'email';

-- Add missing field assignments for contacts
INSERT INTO harmony_field_assignments
  (org_id, harmony_id, object_type, canonical_field, hubspot_property, priority)
VALUES
  (NULL, 'person-name',           'contact', 'contact.firstname',            'firstname',               0),
  (NULL, 'contact-name-case',     'contact', 'contact.lastname',             'lastname',                0),
  (NULL, 'contact-title-standard','contact', 'contact.jobtitle',             'jobtitle',                0),
  (NULL, 'person-title',          'contact', 'contact.jobtitle',             'jobtitle',                1),
  (NULL, 'contact-location',      'contact', 'contact.country',              'country',                 0),
  (NULL, 'contact-email-lower',   'contact', 'contact.email',                'email',                   0),
  (NULL, 'contact-phone-e164',    'contact', 'contact.phone',                'phone',                   0),
  (NULL, 'contact-phone-e164',    'contact', 'contact.mobilephone',          'mobilephone',             1)
ON CONFLICT (org_id, harmony_id, canonical_field) DO NOTHING;

-- Add DEFAULT_FIELD_MAPPINGS entries for contact HubSpot properties
-- These are the canonical → HubSpot property mappings for contacts
-- They go in harmony_field_assignments, not a separate table
