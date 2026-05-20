-- Migration 031: Harmonies Library Table
-- Stores preset harmonies from YAML library and custom org harmonies

CREATE TABLE IF NOT EXISTS harmonies (
  id              text PRIMARY KEY,
  org_id          text,
  -- null = preset/library harmony (available to all orgs)
  -- set = custom harmony created by that org
  name            text NOT NULL,
  description     text,
  field           text NOT NULL,
  object_type     text NOT NULL DEFAULT 'company' CHECK (object_type IN ('company', 'contact', 'person')),
  category        text,
  is_preset       boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  rule_count      int,
  yaml_content    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for querying preset harmonies
CREATE INDEX harmonies_preset_idx ON harmonies (is_preset) WHERE org_id IS NULL;

-- Index for org-specific queries
CREATE INDEX harmonies_org_idx ON harmonies (org_id, is_active);

-- RLS policies
ALTER TABLE harmonies ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see preset harmonies and their own org's harmonies
CREATE POLICY "harmonies_read" ON harmonies
  FOR SELECT USING (
    org_id IS NULL OR org_id = current_setting('app.org_id', true)
  );

-- Policy: Users can update their own org's harmonies (not presets)
CREATE POLICY "harmonies_update" ON harmonies
  FOR UPDATE USING (
    org_id IS NOT NULL AND org_id = current_setting('app.org_id', true)
  );

-- Policy: Users can insert their own org's harmonies
CREATE POLICY "harmonies_insert" ON harmonies
  FOR INSERT WITH CHECK (
    org_id IS NOT NULL AND org_id = current_setting('app.org_id', true)
  );

-- Policy: Users can delete their own org's harmonies (not presets)
CREATE POLICY "harmonies_delete" ON harmonies
  FOR DELETE USING (
    org_id IS NOT NULL AND org_id = current_setting('app.org_id', true)
  );

-- Comment for migration tracking
COMMENT ON TABLE harmonies IS 'Migration 031: Harmonies library - preset YAML harmonies and custom org harmonies';
