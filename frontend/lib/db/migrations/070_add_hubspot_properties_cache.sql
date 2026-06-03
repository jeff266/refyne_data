-- Migration 070: Add HubSpot properties cache table
--
-- Caches HubSpot property metadata per org per object type to avoid
-- hitting the HubSpot API on every wizard open. TTL: 24 hours.

CREATE TABLE IF NOT EXISTS hubspot_properties_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  object_type TEXT NOT NULL,
  properties JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, object_type)
);

CREATE INDEX IF NOT EXISTS idx_hubspot_properties_cache_org_object
  ON hubspot_properties_cache(org_id, object_type);

COMMENT ON TABLE hubspot_properties_cache IS 'Cached HubSpot property metadata to avoid repeated API calls';
COMMENT ON COLUMN hubspot_properties_cache.properties IS 'Array of property objects with name, label, type, etc.';
COMMENT ON COLUMN hubspot_properties_cache.fetched_at IS 'When the properties were fetched from HubSpot API';
