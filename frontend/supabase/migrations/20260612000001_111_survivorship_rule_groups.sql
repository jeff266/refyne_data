-- Migration 111: Survivorship Rule Groups (Compound Rules)
-- Creates tables for compound survivorship rules with condition-based matching
-- Used by unified dedup configuration UI

-- Table: dedup_survivorship_rule_groups
-- Groups of conditions that define when a record should survive a merge
CREATE TABLE IF NOT EXISTS dedup_survivorship_rule_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  group_priority INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: dedup_survivorship_rule_conditions
-- Individual conditions within a group (all must match for group to apply)
CREATE TABLE IF NOT EXISTS dedup_survivorship_rule_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES dedup_survivorship_rule_groups(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  operator TEXT NOT NULL CHECK (operator IN ('gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'is_populated', 'is_empty', 'contains')),
  comparison_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_survivorship_groups_org_priority
  ON dedup_survivorship_rule_groups(org_id, group_priority);

CREATE INDEX IF NOT EXISTS idx_survivorship_conditions_group
  ON dedup_survivorship_rule_conditions(group_id);

-- RLS: Row Level Security for org isolation
ALTER TABLE dedup_survivorship_rule_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE dedup_survivorship_rule_conditions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: org isolation for groups
CREATE POLICY survivorship_groups_org_isolation ON dedup_survivorship_rule_groups
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- RLS Policy: org isolation for conditions (via group)
CREATE POLICY survivorship_conditions_org_isolation ON dedup_survivorship_rule_conditions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dedup_survivorship_rule_groups g
      WHERE g.id = group_id
      AND g.org_id = (auth.jwt() ->> 'org_id')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dedup_survivorship_rule_groups g
      WHERE g.id = group_id
      AND g.org_id = (auth.jwt() ->> 'org_id')
    )
  );

-- Trigger: update updated_at on groups
CREATE OR REPLACE FUNCTION update_survivorship_group_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_survivorship_group_timestamp
  BEFORE UPDATE ON dedup_survivorship_rule_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_survivorship_group_timestamp();

-- Comments for documentation
COMMENT ON TABLE dedup_survivorship_rule_groups IS 'Compound survivorship rules: groups of conditions evaluated before field-level rules';
COMMENT ON TABLE dedup_survivorship_rule_conditions IS 'Individual conditions within a survivorship rule group (AND logic)';
COMMENT ON COLUMN dedup_survivorship_rule_groups.group_priority IS 'Lower number = higher priority (evaluated first)';
COMMENT ON COLUMN dedup_survivorship_rule_conditions.operator IS 'Comparison operator: gt, gte, lt, lte, eq, neq, is_populated, is_empty, contains';
