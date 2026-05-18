-- Migration: Add has_export_scope to hubspot_connections
-- Tracks whether the connection has crm.export scope for Export API access.
-- Super admin connections can use the faster Export API for building company index.

ALTER TABLE hubspot_connections
  ADD COLUMN IF NOT EXISTS has_export_scope boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN hubspot_connections.has_export_scope IS
  'True if connection has crm.export scope, enabling Export API for faster indexing';
