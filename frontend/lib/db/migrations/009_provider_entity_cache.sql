-- Migration: Create provider_entity_cache table
-- Caches enrichment provider responses to avoid redundant API calls.
-- Supports multiple providers per entity with TTL-based expiration.

CREATE TABLE provider_entity_cache (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         text NOT NULL,
  entity_type    text NOT NULL,  -- 'company' | 'contact'
  provider       text NOT NULL,  -- 'apollo' | 'zoominfo' | 'clay' | 'serper' | 'graphiq' | 'yelp'
  provider_id    text NOT NULL,  -- Provider's unique ID for this entity
  domain         text,           -- Normalized domain for companies
  email          text,           -- Email for contacts
  canonical_data jsonb NOT NULL, -- Resolved canonical fields from this provider
  raw_response   jsonb,          -- Original provider response (for debugging/reprocessing)
  retrieved_at   timestamptz NOT NULL DEFAULT now(),
  ttl_expires_at timestamptz NOT NULL,
  hit_count      int NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (org_id, provider, provider_id)
);

-- Index for company lookups by domain
CREATE INDEX idx_provider_entity_cache_company_domain
  ON provider_entity_cache (org_id, domain)
  WHERE entity_type = 'company';

-- Index for contact lookups by email
CREATE INDEX idx_provider_entity_cache_contact_email
  ON provider_entity_cache (org_id, email)
  WHERE entity_type = 'contact';

-- Index for TTL-based eviction queries
CREATE INDEX idx_provider_entity_cache_ttl
  ON provider_entity_cache (ttl_expires_at);

COMMENT ON TABLE provider_entity_cache IS 'Caches enrichment provider responses with TTL-based expiration';
COMMENT ON COLUMN provider_entity_cache.entity_type IS 'Entity type: company or contact';
COMMENT ON COLUMN provider_entity_cache.provider IS 'Enrichment provider: apollo, zoominfo, clay, serper, graphiq, yelp';
COMMENT ON COLUMN provider_entity_cache.canonical_data IS 'Resolved canonical fields from this provider response';
COMMENT ON COLUMN provider_entity_cache.hit_count IS 'Number of cache hits since last refresh';
