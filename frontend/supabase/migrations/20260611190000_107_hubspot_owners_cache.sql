-- Migration 105: HubSpot Owners Cache Table
-- Created: 2026-06-11
-- Purpose: Cache HubSpot owner data to reduce API calls

-- Create hubspot_owners_cache table
CREATE TABLE IF NOT EXISTS hubspot_owners_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  portal_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Composite unique constraint
  CONSTRAINT hubspot_owners_cache_unique UNIQUE (org_id, portal_id, owner_id)
);

-- Create index for org_id lookups
CREATE INDEX idx_hubspot_owners_cache_org_id ON hubspot_owners_cache(org_id);

-- Create index for cache expiry queries
CREATE INDEX idx_hubspot_owners_cache_cached_at ON hubspot_owners_cache(cached_at);

-- Create composite index for owner lookups
CREATE INDEX idx_hubspot_owners_cache_lookup ON hubspot_owners_cache(org_id, owner_id, cached_at);

-- Enable Row Level Security
ALTER TABLE hubspot_owners_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policy: org isolation
CREATE POLICY hubspot_owners_cache_org_isolation ON hubspot_owners_cache
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- Add comment
COMMENT ON TABLE hubspot_owners_cache IS 'Caches HubSpot owner data with 24-hour TTL to reduce API calls';
