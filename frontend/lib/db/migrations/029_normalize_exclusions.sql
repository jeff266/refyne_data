-- Migration 029: Normalize Exclusions
-- Adds ability to skip/snooze/permanently exclude companies or fields from normalization

CREATE TABLE normalize_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  company_id text NOT NULL,
  field text,
  exclusion_type text NOT NULL CHECK (exclusion_type IN ('skip_once','snooze_7d','snooze_30d','permanent')),
  reason text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE (org_id, company_id, field, exclusion_type)
);

CREATE INDEX normalize_exclusions_org_company ON normalize_exclusions (org_id, company_id);
CREATE INDEX normalize_exclusions_expires ON normalize_exclusions (expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE normalize_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON normalize_exclusions
  FOR ALL USING (org_id = current_setting('app.org_id', true));
