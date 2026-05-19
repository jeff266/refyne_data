-- Migration: 024_onboarding_experience.sql
-- World-class onboarding experience

-- Store role + company size from signup questions
-- Stored in Clerk publicMetadata too, but kept here for
-- analytics and personalization without Clerk API calls

ALTER TABLE onboarding_progress
  ADD COLUMN IF NOT EXISTS user_role    text
    CHECK (user_role IN (
      'revops','sales','marketing','agency'
    )),
  ADD COLUMN IF NOT EXISTS company_size text
    CHECK (company_size IN (
      'under_5k','5k_to_50k','over_50k'
    )),
  ADD COLUMN IF NOT EXISTS workspace_name     text,
  ADD COLUMN IF NOT EXISTS score_revealed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS first_merge_at     timestamptz,
  ADD COLUMN IF NOT EXISTS first_normalize_at timestamptz,
  ADD COLUMN IF NOT EXISTS invited_by         text,
    -- Clerk user_id of the inviter (for invited users)
  ADD COLUMN IF NOT EXISTS signup_path        text
    CHECK (signup_path IN (
      'self','agency','invited'
    ));

-- Scan progress events (for the animated scan screen)
CREATE TABLE IF NOT EXISTS scan_progress_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      text        NOT NULL,
  run_id      text        NOT NULL,
  event_type  text        NOT NULL
    CHECK (event_type IN (
      'started','duplicate_found','harmony_checked',
      'score_calculated','completed'
    )),
  message     text        NOT NULL,
  count       int,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scan_events_org_run
  ON scan_progress_events (org_id, run_id, created_at);

ALTER TABLE scan_progress_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation" ON scan_progress_events;
CREATE POLICY "org_isolation" ON scan_progress_events
  FOR ALL USING (org_id = current_setting('app.org_id', true));
