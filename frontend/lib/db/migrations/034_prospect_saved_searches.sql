-- Saved prospect searches
CREATE TABLE IF NOT EXISTS prospect_saved_searches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       text NOT NULL,
  created_by   text NOT NULL,
  name         text NOT NULL,
  filters      jsonb NOT NULL,
  scope        text NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'workspace')),
  last_run_at  timestamptz,
  run_count    int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prospect_saved_searches_org_idx ON prospect_saved_searches(org_id);
CREATE INDEX IF NOT EXISTS prospect_saved_searches_created_by_idx ON prospect_saved_searches(created_by);

ALTER TABLE prospect_saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation" ON prospect_saved_searches;
CREATE POLICY "org_isolation" ON prospect_saved_searches
  FOR ALL USING (org_id = current_setting('app.org_id', true));
