-- Migration 025: Sync Health + Interval Configuration
-- Adds sync status tracking and API usage monitoring to hubspot_connections

ALTER TABLE hubspot_connections
  ADD COLUMN IF NOT EXISTS last_sync_at        timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_status    text
    CHECK (last_sync_status IN ('success','failed','running')),
  ADD COLUMN IF NOT EXISTS last_sync_duration_ms int,
  ADD COLUMN IF NOT EXISTS last_sync_error     text,
  ADD COLUMN IF NOT EXISTS api_calls_today     int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS api_calls_month     int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS api_calls_reset_at  timestamptz,
  ADD COLUMN IF NOT EXISTS sync_frequency      text NOT NULL DEFAULT 'nightly'
    CHECK (sync_frequency IN (
      'manual','nightly','every_6h','hourly'
    ));

COMMENT ON COLUMN hubspot_connections.last_sync_at IS
  'Timestamp of the most recent compliance scan completion';

COMMENT ON COLUMN hubspot_connections.last_sync_status IS
  'Status of the most recent sync: success, failed, or running';

COMMENT ON COLUMN hubspot_connections.last_sync_duration_ms IS
  'Duration in milliseconds of the most recent sync';

COMMENT ON COLUMN hubspot_connections.last_sync_error IS
  'Error message if last sync failed';

COMMENT ON COLUMN hubspot_connections.api_calls_today IS
  'Number of HubSpot API calls made today (resets at midnight UTC)';

COMMENT ON COLUMN hubspot_connections.api_calls_month IS
  'Number of HubSpot API calls made this month (resets on the 1st)';

COMMENT ON COLUMN hubspot_connections.api_calls_reset_at IS
  'Timestamp of the last daily reset';

COMMENT ON COLUMN hubspot_connections.sync_frequency IS
  'How often compliance scans run: manual, nightly, every_6h, or hourly';

-- Function to atomically increment API call counters
CREATE OR REPLACE FUNCTION increment_api_calls(connection_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE hubspot_connections
  SET
    api_calls_today = api_calls_today + 1,
    api_calls_month = api_calls_month + 1
  WHERE id = connection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
