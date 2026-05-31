-- Create harmony_field_assignments table
-- Phase 2: Separate harmony definition from field assignment per org

CREATE TABLE public.harmony_field_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            TEXT,                    -- NULL = global default
  harmony_id        TEXT NOT NULL REFERENCES harmonies(id) ON DELETE CASCADE,
  object_type       TEXT NOT NULL,           -- 'company', 'contact', 'deal'
  canonical_field   TEXT NOT NULL,           -- 'company.phone', 'contact.mobilephone'
  hubspot_property  TEXT NOT NULL,           -- 'phone', 'mobilephone'
  output_format     TEXT,                    -- 'broad', 'specific', 'naics', null=default
  is_active         BOOLEAN DEFAULT true,
  priority          INTEGER DEFAULT 0,       -- lower = higher priority if multiple harmonies on same field
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint using COALESCE for NULL org_id compatibility
CREATE UNIQUE INDEX harmony_field_assignments_unique_idx
ON harmony_field_assignments(
  COALESCE(org_id, ''),
  harmony_id,
  canonical_field
);

-- Index for fast lookup by org + object type
CREATE INDEX idx_harmony_field_assignments_org_object
ON harmony_field_assignments(org_id, object_type, is_active);

-- Index for lookup by harmony
CREATE INDEX idx_harmony_field_assignments_harmony
ON harmony_field_assignments(harmony_id);

COMMENT ON TABLE harmony_field_assignments IS 'Maps harmonies to specific fields per org. Replaces hardcoded DEFAULT_FIELD_MAPPINGS.';
COMMENT ON COLUMN harmony_field_assignments.org_id IS 'NULL = global default assignment, applies to all orgs unless overridden';
COMMENT ON COLUMN harmony_field_assignments.output_format IS 'For lookup harmonies with multiple output formats (e.g., industry: broad/specific/naics)';
COMMENT ON COLUMN harmony_field_assignments.priority IS 'Lower = higher priority. If multiple harmonies apply to same field, use highest priority.';

-- Seed global defaults from existing harmonies
-- These replace the hardcoded DEFAULT_FIELD_MAPPINGS constant
INSERT INTO harmony_field_assignments
  (org_id, harmony_id, object_type, canonical_field, hubspot_property)
VALUES
  -- Company harmonies
  (NULL, 'company-name',         'company', 'company.name',              'name'),
  (NULL, 'company-industry',     'company', 'company.industry',          'industry'),
  (NULL, 'phone',                'company', 'company.phone',             'phone'),
  (NULL, 'linkedin-url',         'company', 'company.linkedin_url',      'linkedin_company_page'),
  (NULL, 'address-country',      'company', 'company.address.country',   'country'),
  (NULL, 'address-state',        'company', 'company.address.state',     'state'),
  (NULL, 'company-domain',       'company', 'company.domain',            'domain'),
  (NULL, 'company-employees',    'company', 'company.employees',         'numberofemployees'),
  (NULL, 'company-revenue',      'company', 'company.revenue',           'annualrevenue'),
  (NULL, 'website-social-media', 'company', 'company.website',           'website'),
  -- Contact harmonies
  (NULL, 'email',                'contact', 'contact.email',             'email'),
  (NULL, 'contact-email-lower',  'contact', 'contact.email',             'email'),
  (NULL, 'contact-phone-e164',   'contact', 'contact.phone',             'phone'),
  (NULL, 'contact-title-standard','contact','contact.jobtitle',          'jobtitle'),
  (NULL, 'contact-name-case',    'contact', 'contact.firstname',         'firstname'),
  (NULL, 'contact-location',     'contact', 'contact.city',              'city'),
  (NULL, 'person-name',          'contact', 'contact.fullname',          'fullname'),
  (NULL, 'person-title',         'contact', 'contact.title',             'title')
ON CONFLICT DO NOTHING;
