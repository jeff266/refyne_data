-- Migration 038: Harmony Creation Wizard
-- Tables for user-created harmonies with HubSpot field scanning

-- Harmonies table - extend existing table with wizard-specific columns
-- Note: harmonies table already exists from migration 031
-- Add missing columns for wizard functionality
ALTER TABLE harmonies ADD COLUMN IF NOT EXISTS approach text CHECK (approach IN ('reference_list', 'rule_based', 'regex'));
ALTER TABLE harmonies ADD COLUMN IF NOT EXISTS created_by text;

-- Harmony rules table
CREATE TABLE harmony_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  harmony_id text NOT NULL REFERENCES harmonies(id) ON DELETE CASCADE,
  input_pattern text NOT NULL,
  normalized_value text NOT NULL,
  match_type text NOT NULL DEFAULT 'exact' CHECK (match_type IN ('exact', 'fuzzy', 'regex')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Harmony scan jobs table
CREATE TABLE harmony_scan_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  harmony_id text NOT NULL REFERENCES harmonies(id) ON DELETE CASCADE,
  org_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scanning', 'completed', 'failed')),
  progress int NOT NULL DEFAULT 0,
  total_records int,
  distinct_values jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for harmonies (create if not exists)
CREATE INDEX IF NOT EXISTS harmonies_org_id_idx ON harmonies (org_id);
CREATE INDEX IF NOT EXISTS harmonies_org_active_idx ON harmonies (org_id, is_active);
CREATE INDEX harmony_rules_harmony_id_idx ON harmony_rules (harmony_id);
CREATE INDEX harmony_rules_sort_order_idx ON harmony_rules (harmony_id, sort_order);
CREATE INDEX harmony_scan_jobs_harmony_id_idx ON harmony_scan_jobs (harmony_id);
CREATE INDEX harmony_scan_jobs_status_idx ON harmony_scan_jobs (status);

-- RLS policies
-- harmonies already has RLS enabled from migration 031
ALTER TABLE harmony_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE harmony_scan_jobs ENABLE ROW LEVEL SECURITY;

-- harmonies RLS policy already exists from migration 031
CREATE POLICY "org_isolation" ON harmony_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM harmonies
      WHERE harmonies.id::text = harmony_rules.harmony_id::text
      AND (harmonies.org_id = current_setting('app.org_id', true) OR harmonies.org_id IS NULL)
    )
  );

CREATE POLICY "org_isolation" ON harmony_scan_jobs
  FOR ALL USING (org_id = current_setting('app.org_id', true));

-- Trigger for updated_at already exists from migration 031
