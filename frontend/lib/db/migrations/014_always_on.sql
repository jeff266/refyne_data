-- Migration 014: Always On
-- Proactive nightly monitoring with digest email and Slack alerts

CREATE TABLE workspace_entitlements (
  org_id              text PRIMARY KEY,
  always_on_enabled   boolean NOT NULL DEFAULT false,
  always_on_since     timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE always_on_config (
  org_id                  text PRIMARY KEY,
  scan_time_utc           time NOT NULL DEFAULT '06:00:00',
  digest_enabled          boolean NOT NULL DEFAULT true,
  email_recipients        text[] NOT NULL DEFAULT '{}',
  slack_enabled           boolean NOT NULL DEFAULT false,
  slack_webhook_url       text,
  send_on_no_change       boolean NOT NULL DEFAULT false,
  score_delta_threshold   int NOT NULL DEFAULT 3
                          CHECK (score_delta_threshold BETWEEN 0 AND 100),
  auto_merge_grade_a      boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE digest_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              text NOT NULL,
  connection_id       uuid,
  portal_name         text,
  run_at              timestamptz NOT NULL DEFAULT now(),
  triggered_by        text NOT NULL DEFAULT 'schedule'
                      CHECK (triggered_by IN ('schedule','manual')),
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN (
                        'pending','running','completed','failed','skipped'
                      )),
  score_before        numeric(5,2),
  score_after         numeric(5,2),
  score_delta         numeric(5,2),
  new_pairs_detected  int NOT NULL DEFAULT 0,
  new_insights        int NOT NULL DEFAULT 0,
  records_scanned     int NOT NULL DEFAULT 0,
  digest_sent         boolean NOT NULL DEFAULT false,
  slack_sent          boolean NOT NULL DEFAULT false,
  skipped_reason      text,
  error_message       text,
  digest_payload      jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX digest_runs_org_run_at ON digest_runs (org_id, run_at DESC);

-- Enable RLS
ALTER TABLE workspace_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE always_on_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_runs            ENABLE ROW LEVEL SECURITY;

-- RLS policies for org isolation
CREATE POLICY "org_isolation" ON workspace_entitlements
  FOR ALL USING (org_id = current_setting('app.org_id', true));

CREATE POLICY "org_isolation" ON always_on_config
  FOR ALL USING (org_id = current_setting('app.org_id', true));

CREATE POLICY "org_isolation" ON digest_runs
  FOR ALL USING (org_id = current_setting('app.org_id', true));

-- Dev permissive policies (for anon access)
CREATE POLICY "dev_allow_all" ON workspace_entitlements
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_allow_all" ON always_on_config
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_allow_all" ON digest_runs
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_workspace_entitlements_updated_at
  BEFORE UPDATE ON workspace_entitlements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_always_on_config_updated_at
  BEFORE UPDATE ON always_on_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
