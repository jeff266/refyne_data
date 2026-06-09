-- Migration 094: Import Rule Sets
-- Saved rule sets for import owner assignment

-- Table for storing saved rule sets
CREATE TABLE public.import_rule_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Index for org queries
CREATE INDEX idx_import_rule_sets_org
  ON import_rule_sets(org_id, updated_at DESC)
  WHERE deleted_at IS NULL;

-- RLS: Required for org isolation
ALTER TABLE import_rule_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_rule_sets_org_isolation
  ON import_rule_sets FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));
