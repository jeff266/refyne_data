-- Add friendly_name column to hubspot_connections
ALTER TABLE hubspot_connections
  ADD COLUMN friendly_name text;
