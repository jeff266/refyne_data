-- Migration 032: Auto-configured field mappings
-- Add columns to support system mappings, portal scoping, and object types

-- Extend field_mappings table
ALTER TABLE field_mappings
  ADD COLUMN IF NOT EXISTS is_system   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS portal_id   text,
  ADD COLUMN IF NOT EXISTS object_type text DEFAULT 'company';

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_field_mappings_org_portal_object
  ON field_mappings(org_id, portal_id, object_type);

CREATE INDEX IF NOT EXISTS idx_field_mappings_system
  ON field_mappings(org_id, is_system) WHERE is_system = true;

-- Cache table for HubSpot properties discovered during schema sync
CREATE TABLE IF NOT EXISTS hubspot_properties_cache (
  org_id          text NOT NULL,
  portal_id       text NOT NULL,
  object_type     text NOT NULL,
  property_name   text NOT NULL,
  property_label  text,
  property_type   text,
  field_type      text,
  is_custom       boolean DEFAULT false,
  is_mapped       boolean DEFAULT false,
  options         jsonb,
  cached_at       timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, portal_id, object_type, property_name)
);

CREATE INDEX IF NOT EXISTS idx_hubspot_properties_org_portal
  ON hubspot_properties_cache(org_id, portal_id, object_type);

CREATE INDEX IF NOT EXISTS idx_hubspot_properties_unmapped
  ON hubspot_properties_cache(org_id, portal_id, object_type, is_mapped)
  WHERE is_mapped = false;

COMMENT ON TABLE hubspot_properties_cache IS 'Cache of all HubSpot properties discovered during OAuth/schema sync. Used to show unmapped custom properties.';
COMMENT ON COLUMN field_mappings.is_system IS 'True for standard HubSpot properties auto-configured by Refyne. These are locked (visible but not deletable).';
COMMENT ON COLUMN field_mappings.portal_id IS 'HubSpot portal ID this mapping applies to. Null = applies to all portals in org.';
COMMENT ON COLUMN field_mappings.object_type IS 'HubSpot object type: company, contact, or deal.';
