-- Migration 038: Harmony Output Format Selection
-- Adds per-org output format preferences for structured harmonies

-- Add output_format column to harmonies table
-- This stores the org's chosen output format for this harmony
-- Values: 'default', 'abbreviation', 'name', 'iso2', 'iso3', 'e164', 'national', etc.
ALTER TABLE harmonies
ADD COLUMN IF NOT EXISTS output_format text DEFAULT 'default';

-- Add output_formats_available jsonb column to store available formats
-- Format: [{"key": "abbreviation", "label": "Abbreviation (CA)", "default": true}, ...]
ALTER TABLE harmonies
ADD COLUMN IF NOT EXISTS output_formats_available jsonb DEFAULT NULL;

-- Comment for migration tracking
COMMENT ON COLUMN harmonies.output_format IS 'Selected output format key (default uses harmony built-in default)';
COMMENT ON COLUMN harmonies.output_formats_available IS 'Available output formats for structured harmonies (null for simple string output)';

-- For preset harmonies, we need org-specific format preferences
-- Create a table to store per-org overrides for library harmonies
CREATE TABLE IF NOT EXISTS harmony_org_settings (
  org_id text NOT NULL,
  harmony_id text NOT NULL,
  output_format text NOT NULL DEFAULT 'default',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, harmony_id),
  FOREIGN KEY (harmony_id) REFERENCES harmonies(id) ON DELETE CASCADE
);

-- Index for querying org settings
CREATE INDEX harmony_org_settings_org_idx ON harmony_org_settings(org_id);

-- RLS policies
ALTER TABLE harmony_org_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own org's settings
CREATE POLICY "harmony_org_settings_read" ON harmony_org_settings
  FOR SELECT USING (org_id = current_setting('app.org_id', true));

-- Policy: Users can insert their own org's settings
CREATE POLICY "harmony_org_settings_insert" ON harmony_org_settings
  FOR INSERT WITH CHECK (org_id = current_setting('app.org_id', true));

-- Policy: Users can update their own org's settings
CREATE POLICY "harmony_org_settings_update" ON harmony_org_settings
  FOR UPDATE USING (org_id = current_setting('app.org_id', true));

-- Policy: Users can delete their own org's settings
CREATE POLICY "harmony_org_settings_delete" ON harmony_org_settings
  FOR DELETE USING (org_id = current_setting('app.org_id', true));

-- Comment
COMMENT ON TABLE harmony_org_settings IS 'Migration 038: Per-org output format preferences for library harmonies';
