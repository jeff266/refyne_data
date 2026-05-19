-- Migration: Add connection tracking to dedup_pairs
-- Stores which HubSpot connection/portal each dedup pair came from
-- so name lookups query the correct portal

-- Add connection_id and portal_id columns
ALTER TABLE dedup_pairs
  ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES hubspot_connections(id),
  ADD COLUMN IF NOT EXISTS portal_id text;

-- Index for connection-based queries
CREATE INDEX IF NOT EXISTS dedup_pairs_connection_id
  ON dedup_pairs (connection_id);

CREATE INDEX IF NOT EXISTS dedup_pairs_portal_id
  ON dedup_pairs (portal_id);

-- Backfill portal_id for existing pairs (best effort)
-- Try to match record IDs to companies in each portal to determine source
-- This is a best-effort backfill - new pairs will have portal_id set at creation time

COMMENT ON COLUMN dedup_pairs.connection_id IS 'The hubspot_connections.id that scanned this pair';
COMMENT ON COLUMN dedup_pairs.portal_id IS 'The HubSpot portal ID (hub_id) where these companies exist';
