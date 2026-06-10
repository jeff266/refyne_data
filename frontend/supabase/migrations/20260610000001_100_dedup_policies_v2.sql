-- Migration 100: Dedup Policies V2
-- Compound signal groups, field exclusions, inactive owner handling, parent/child awareness

-- ================================================================
-- Compound Signal Matching Groups
-- ================================================================

-- Signal groups define custom matching logic
-- OR logic between groups, AND logic within a group
CREATE TABLE public.dedup_signal_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  object_type TEXT NOT NULL DEFAULT 'company',
  name TEXT,
  group_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual conditions within a signal group
CREATE TABLE public.dedup_signal_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES dedup_signal_groups(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  -- 'name'|'domain'|'email'|'phone'|'linkedin_url'|'street'|'city'|'state'|'country'|'industry'|'zip'|'employee_count'
  match_type TEXT NOT NULL DEFAULT 'exact',
  -- 'exact'|'fuzzy'|'normalized'
  fuzzy_threshold NUMERIC(4,3) DEFAULT 0.85,
  -- only used when match_type = 'fuzzy'
  weight INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dedup_signal_groups_org ON dedup_signal_groups(org_id, object_type);
CREATE INDEX idx_dedup_signal_conditions_group ON dedup_signal_conditions(group_id);

-- RLS for signal groups
ALTER TABLE dedup_signal_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY dedup_signal_groups_org_isolation
  ON dedup_signal_groups FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- RLS for signal conditions (via group ownership)
ALTER TABLE dedup_signal_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY dedup_signal_conditions_org_isolation
  ON dedup_signal_conditions FOR ALL
  USING (
    group_id IN (
      SELECT id FROM dedup_signal_groups
      WHERE org_id = (auth.jwt() ->> 'org_id')
    )
  );

-- ================================================================
-- Field-Level Exclusions
-- ================================================================

-- Special handling for specific fields during merge
CREATE TABLE public.dedup_field_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  object_type TEXT NOT NULL DEFAULT 'company',
  field_name TEXT NOT NULL,
  -- HubSpot property name e.g. 'hs_parent_company_id'
  exclusion_type TEXT NOT NULL DEFAULT 'never_merge',
  -- 'never_merge': field never touched during merge
  -- 'union_true': boolean - true if any record is true
  -- 'append': concatenate values with separator
  separator TEXT DEFAULT E'\n',
  -- used when exclusion_type = 'append'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, object_type, field_name)
);

CREATE INDEX idx_dedup_field_exclusions_org ON dedup_field_exclusions(org_id, object_type);

-- RLS for field exclusions
ALTER TABLE dedup_field_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY dedup_field_exclusions_org_isolation
  ON dedup_field_exclusions FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- ================================================================
-- Dedup Config Extensions
-- ================================================================

-- Add inactive owner handling and parent/child awareness
ALTER TABLE dedup_config
  ADD COLUMN IF NOT EXISTS inactive_owner_action TEXT DEFAULT 'warn',
  -- 'warn'|'assign_fallback'|'leave_unassigned'
  ADD COLUMN IF NOT EXISTS inactive_owner_fallback_id TEXT,
  -- HubSpot owner ID for fallback assignment
  ADD COLUMN IF NOT EXISTS parent_child_awareness BOOLEAN DEFAULT FALSE,
  -- never merge parent into child
  ADD COLUMN IF NOT EXISTS require_closed_won_survivor BOOLEAN DEFAULT FALSE;
  -- prefer record with closed won deal as survivor

COMMENT ON COLUMN dedup_config.inactive_owner_action IS
  'How to handle merges when the surviving record has an inactive owner: warn, assign_fallback, leave_unassigned';
COMMENT ON COLUMN dedup_config.inactive_owner_fallback_id IS
  'HubSpot owner ID to assign when inactive_owner_action = assign_fallback';
COMMENT ON COLUMN dedup_config.parent_child_awareness IS
  'When true, never merge a parent company into a child company';
COMMENT ON COLUMN dedup_config.require_closed_won_survivor IS
  'When true, prefer the record with a Closed Won deal as survivor';

-- ================================================================
-- Merge History Extensions
-- ================================================================

-- Track which V2 features were applied during merge
ALTER TABLE dedup_merge_history
  ADD COLUMN IF NOT EXISTS field_exclusions_applied JSONB,
  -- { "Do_Not_Contact__c": "union_true", "Notes": "append" }
  ADD COLUMN IF NOT EXISTS inactive_owner_action TEXT,
  -- what was done with inactive owner
  ADD COLUMN IF NOT EXISTS parent_child_preserved BOOLEAN,
  ADD COLUMN IF NOT EXISTS closed_won_survivor BOOLEAN;
  -- true if closed won rule determined survivor

COMMENT ON COLUMN dedup_merge_history.field_exclusions_applied IS
  'Map of field names to exclusion types applied during this merge';
COMMENT ON COLUMN dedup_merge_history.inactive_owner_action IS
  'Action taken for inactive owner: kept, fallback_assigned, unassigned';
COMMENT ON COLUMN dedup_merge_history.parent_child_preserved IS
  'True if parent/child relationship influenced survivor selection';
COMMENT ON COLUMN dedup_merge_history.closed_won_survivor IS
  'True if closed won priority rule determined the survivor';
