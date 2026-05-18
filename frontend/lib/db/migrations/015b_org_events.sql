CREATE TABLE IF NOT EXISTS org_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      text        NOT NULL,
  actor_id    text        NOT NULL,
  action      text        NOT NULL
    CHECK (action IN (
      'member_invited','member_removed','role_changed',
      'ownership_transferred','agency_offboarded',
      'org_created','policy_changed','limit_changed'
    )),
  target_id   text,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_events_org_date
  ON org_events (org_id, created_at DESC);

ALTER TABLE org_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON org_events
  FOR ALL USING (org_id = current_setting('app.org_id', true));
