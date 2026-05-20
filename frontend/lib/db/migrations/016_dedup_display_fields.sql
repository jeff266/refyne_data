-- Add dedup_display_fields column to org_policies
-- This stores the org's selected fields for dedup cluster comparison view

ALTER TABLE org_policies
ADD COLUMN IF NOT EXISTS dedup_display_fields TEXT[]
DEFAULT ARRAY[
  'name',
  'domain',
  'phone',
  'industry',
  'city',
  'state',
  'country',
  'address',
  'linkedin_company_page',
  'lifecyclestage',
  'type'
];

COMMENT ON COLUMN org_policies.dedup_display_fields IS
  'Array of HubSpot property names to display in dedup cluster comparison table. Order determines display order.';
