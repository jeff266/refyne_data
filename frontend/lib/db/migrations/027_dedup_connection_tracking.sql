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

-- Backfill existing pairs with GrowthBook portal (8863617)
-- Run manually in Supabase SQL editor:
-- UPDATE dedup_pairs
-- SET portal_id = '8863617'
-- WHERE org_id = 'org_3DuSdb0FBnx7RMLmJSUegrpiNLS'
-- AND portal_id IS NULL;

COMMENT ON COLUMN dedup_pairs.connection_id IS 'The hubspot_connections.id that scanned this pair';
COMMENT ON COLUMN dedup_pairs.portal_id IS 'The HubSpot portal ID (hub_id) where these companies exist';

-- TODO: Update dedup scanner to include these fields when creating pairs
-- Example:
-- await supabase.from('dedup_pairs').insert({
--   org_id: orgId,
--   connection_id: connection.id,
--   portal_id: connection.portal_id,
--   record_a_id: companyIdA,
--   record_b_id: companyIdB,
--   -- ... rest of fields
-- });
