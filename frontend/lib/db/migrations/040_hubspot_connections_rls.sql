/**
 * Migration 040: Add RLS policy for service_role on hubspot_connections
 *
 * The arrangement worker uses service_role to query hubspot_connections.
 * This migration grants service_role full access to the table.
 */

CREATE POLICY IF NOT EXISTS "service_role_full_access"
ON hubspot_connections
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON POLICY "service_role_full_access" ON hubspot_connections IS
'Allow service_role (used by worker) to read/write hubspot_connections';
