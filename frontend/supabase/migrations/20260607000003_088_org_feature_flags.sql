-- Beta feature flags per org
CREATE TABLE public.org_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  flag TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- Who enabled it
  enabled_by TEXT, -- user_id
  enabled_at TIMESTAMPTZ,

  -- Override: Refyne staff can force-enable for specific orgs
  -- without the org self-serving it
  staff_override BOOLEAN NOT NULL DEFAULT FALSE,
  staff_override_by TEXT, -- refyne staff user_id
  staff_override_at TIMESTAMPTZ,
  staff_override_note TEXT, -- reason for override

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (org_id, flag)
);

-- Index for flag lookups
CREATE INDEX idx_org_feature_flags_lookup
  ON org_feature_flags(org_id, flag, enabled);

-- Index for staff override queries
CREATE INDEX idx_org_feature_flags_override
  ON org_feature_flags(flag, staff_override)
  WHERE staff_override = TRUE;

-- RLS
ALTER TABLE org_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_feature_flags_read ON org_feature_flags
  FOR SELECT
  USING (org_id = (auth.jwt() ->> 'org_id'));

CREATE POLICY org_feature_flags_write ON org_feature_flags
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- Seed initial flags (all disabled by default)
-- Add new flags here as features are built
INSERT INTO org_feature_flags (org_id, flag, enabled)
SELECT
  ob.org_id,
  flags.flag,
  FALSE
FROM org_billing ob
CROSS JOIN (VALUES
  ('event_list_import'),
  ('contact_dedup'),
  ('beta_features')
) AS flags(flag)
ON CONFLICT (org_id, flag) DO NOTHING;
